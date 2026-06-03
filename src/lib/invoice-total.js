const CURRENCY_HINTS = [
  ['HKD', /HK\$|HKD|港币/i],
  ['USD', /US\$|USD|\$/i],
  ['EUR', /EUR|€/i],
  ['GBP', /GBP|£/i],
  ['JPY', /JPY|日元/i],
  ['AUD', /A\$|AUD/i],
  ['SGD', /S\$|SGD/i],
  ['CNY', /RMB|CNY|¥|￥|人民币|元/i],
]

const AMOUNT_RE =
  /(?:(HK\$|US\$|A\$|S\$|RMB|CNY|USD|EUR|GBP|JPY|AUD|SGD|¥|￥|\$|€|£)\s*((?:[0-9]\s*){1,12}\.\s*[0-9]\s*[0-9])|([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})))/gi

const CN_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  壹: 1,
  贰: 2,
  叁: 3,
  肆: 4,
  伍: 5,
  陆: 6,
  柒: 7,
  捌: 8,
  玖: 9,
}

const CN_SMALL_UNITS = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
}

const CN_BIG_UNITS = {
  万: 10000,
  亿: 100000000,
}

const CN_MONEY_RE =
  /[零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖十拾百佰千仟万亿]+[元圆](?:[零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖]+角)?(?:[零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖]+分)?(?:整|正)?/g

const STRONG_TOTAL_PATTERNS = [
  {
    name: '价税合计',
    pattern: /价税合计[^0-9¥￥$€£]{0,120}(?:小写)?/i,
    preferLast: true,
  },
  {
    name: '小写金额',
    pattern: /(?:（|\()?小写(?:）|\))?/i,
    preferLast: false,
  },
  {
    name: '合计金额',
    pattern: /(?:合计金额|总金额|应付金额|实付金额|支付金额)[^0-9¥￥$€£]{0,50}/i,
    preferLast: false,
  },
  {
    name: 'Total',
    pattern:
      /(?:grand total|total amount|amount due|total due|paid amount|(?<!tax\s)(?<!discount\s)(?<!shipping\s)\btotal\b(?!\s*(?:tax|discount|qty|quantity|items?|shipping|subtotal)))[^0-9$€£¥￥]{0,50}/i,
    preferLast: false,
  },
]

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function sameMoney(a, b) {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= 0.01
}

function toHalfWidth(text) {
  return String(text || '').replace(/[０-９．，（）]/g, (ch) => {
    const code = ch.charCodeAt(0)
    if (code >= 0xff10 && code <= 0xff19) return String.fromCharCode(code - 0xfee0)
    if (ch === '．') return '.'
    if (ch === '，') return ','
    if (ch === '（') return '('
    if (ch === '）') return ')'
    return ch
  })
}

function normalizeText(text) {
  return toHalfWidth(text)
    .replace(/([0-9])\s*\.\s*([0-9])/g, '$1.$2')
    .replace(/([¥￥$€£])\s+(?=[0-9])/g, '$1')
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAmount(value) {
  const cleaned = String(value ?? '').replace(/[,\s]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? roundMoney(n) : 0
}

function parseChineseInteger(value) {
  let result = 0
  let section = 0
  let number = 0

  for (const ch of String(value || '')) {
    if (ch in CN_DIGITS) {
      number = CN_DIGITS[ch]
    } else if (ch in CN_SMALL_UNITS) {
      section += (number || 1) * CN_SMALL_UNITS[ch]
      number = 0
    } else if (ch in CN_BIG_UNITS) {
      result += (section + number) * CN_BIG_UNITS[ch]
      section = 0
      number = 0
    }
  }

  return result + section + number
}

function parseChineseMoney(value) {
  const text = String(value || '').replace(/圆/g, '元')
  const yuanPart = text.split('元')[0] || ''
  const jiao = text.match(/([零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖])角/)?.[1]
  const fen = text.match(/([零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖])分/)?.[1]
  const amount =
    parseChineseInteger(yuanPart) +
    (jiao ? CN_DIGITS[jiao] / 10 : 0) +
    (fen ? CN_DIGITS[fen] / 100 : 0)

  return roundMoney(amount)
}

function detectCurrency(raw, context) {
  const haystack = `${raw || ''} ${context || ''}`
  const found = CURRENCY_HINTS.find(([, re]) => re.test(haystack))
  return found?.[0] || 'CNY'
}

function collectAmounts(segment) {
  return [...String(segment || '').matchAll(AMOUNT_RE)]
    .map((match) => ({
      raw: match[0].trim(),
      amount: parseAmount(match[2] || match[3]),
      index: match.index ?? 0,
    }))
    .filter((m) => m.amount > 0)
}

function makeCandidate({ amount, currency, method, source, strength = 'strong' }) {
  return {
    amount: roundMoney(amount),
    currency: currency || 'CNY',
    method,
    source: String(source || '').slice(0, 100).trim(),
    strength,
  }
}

function candidateAfterKeyword(text, { name, pattern, preferLast }, windowSize = 180) {
  const idx = text.search(pattern)
  if (idx < 0) return null

  const segment = text.slice(idx, idx + windowSize)
  const amounts = collectAmounts(segment)
  if (amounts.length === 0) return null

  const chosen = preferLast ? amounts[amounts.length - 1] : amounts[0]
  return makeCandidate({
    amount: chosen.amount,
    currency: detectCurrency(chosen.raw, segment),
    method: name,
    source: segment,
    strength: 'strong',
  })
}

function globalPattern(pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return new RegExp(pattern.source, flags)
}

function candidatesAfterKeyword(text, config, windowSize = 180) {
  return [...text.matchAll(globalPattern(config.pattern))]
    .reverse()
    .map((match) => {
      const segment = text.slice(match.index, match.index + windowSize)
      const amounts = collectAmounts(segment)
      if (amounts.length === 0) return null

      const chosen = config.preferLast ? amounts[amounts.length - 1] : amounts[0]
      return makeCandidate({
        amount: chosen.amount,
        currency: detectCurrency(chosen.raw, segment),
        method: config.name,
        source: segment,
        strength: 'strong',
      })
    })
    .filter(Boolean)
}

function collectStrongFinalCandidates(text) {
  const candidates = []
  for (const config of STRONG_TOTAL_PATTERNS) {
    const found = candidatesAfterKeyword(text, config)
    for (const candidate of found) {
      if (!candidates.some((x) => sameMoney(x.amount, candidate.amount))) {
        candidates.push(candidate)
      }
    }
  }
  return candidates
}

function findMatchingAmountPair(amounts, target, beforeIndex = Infinity) {
  const prior = amounts.filter((item) => item.index < beforeIndex)

  for (let i = prior.length - 1; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if (sameMoney(prior[i].amount + prior[j].amount, target)) {
        return [prior[j], prior[i]]
      }
    }
  }

  return null
}

function findChineseUppercaseTotal(text) {
  const matches = [...text.matchAll(CN_MONEY_RE)].reverse()

  for (const match of matches) {
    const upperAmount = parseChineseMoney(match[0])
    if (!upperAmount) continue

    const start = Math.max(0, match.index - 260)
    const end = Math.min(text.length, match.index + match[0].length + 160)
    const segment = text.slice(start, end)
    const upperIndexInSegment = match.index - start
    const upperEndInSegment = upperIndexInSegment + match[0].length
    const amounts = collectAmounts(segment)
    const matchingLower =
      amounts.find((item) => item.index > upperEndInSegment && sameMoney(item.amount, upperAmount)) ||
      amounts.find((item) => sameMoney(item.amount, upperAmount))
    const pair = findMatchingAmountPair(amounts, upperAmount, matchingLower?.index ?? upperIndexInSegment)

    if (matchingLower) {
      return {
        ...makeCandidate({
          amount: matchingLower.amount,
          currency: detectCurrency(matchingLower.raw, segment),
          method: pair ? '中文大写/小写+金额税额校验' : '中文大写/小写',
          source: segment,
          strength: 'strong',
        }),
        crossCheck: pair
          ? {
              amount: roundMoney(pair[0].amount + pair[1].amount),
              method: '金额+税额',
              source: segment,
            }
          : undefined,
      }
    }

    if (pair) {
      return makeCandidate({
        amount: upperAmount,
        currency: detectCurrency(pair[0].raw, segment),
        method: '中文大写+金额税额校验',
        source: segment,
        strength: 'strong',
      })
    }
  }

  return null
}

function findSummedChineseTotal(text) {
  const matches = [...text.matchAll(/合计/gi)].reverse()

  for (const match of matches) {
    const segment = text.slice(match.index, match.index + 600)
    const amounts = collectAmounts(segment)
    if (amounts.length < 2) continue

    for (let i = amounts.length - 1; i >= 2; i--) {
      const finalAmount = amounts[i]
      const pair = findMatchingAmountPair(amounts, finalAmount.amount, finalAmount.index)
      if (!pair) continue

      return makeCandidate({
        amount: finalAmount.amount,
        currency: detectCurrency(finalAmount.raw, segment),
        method: '金额+税额=价税合计',
        source: segment,
        strength: 'strong',
      })
    }

    const summed = roundMoney(amounts[0].amount + amounts[1].amount)
    return makeCandidate({
      amount: summed,
      currency: detectCurrency(amounts[0].raw, segment),
      method: '金额+税额',
      source: segment,
      strength: 'derived',
    })
  }

  return null
}

function findSingleChineseTotal(text) {
  const matches = [...text.matchAll(/合计/gi)].reverse()

  for (const match of matches) {
    const segment = text.slice(match.index, match.index + 100)
    if (/价税合计/.test(segment)) continue

    const amounts = collectAmounts(segment)
    if (amounts.length !== 1) continue

    return makeCandidate({
      amount: amounts[0].amount,
      currency: detectCurrency(amounts[0].raw, segment),
      method: '合计',
      source: segment,
      strength: 'fallback',
    })
  }

  return null
}

function withCrossCheck(primary, derived) {
  if (!primary || !derived) return primary
  if (primary.crossCheck) return primary
  if (derived.strength !== 'strong' && primary.method?.includes('中文大写/小写')) return primary

  if (!sameMoney(primary.amount, derived.amount)) {
    return {
      ...primary,
      conflict: {
        amount: derived.amount,
        method: derived.method,
        source: derived.source,
      },
    }
  }

  return {
    ...primary,
    crossCheck: {
      amount: derived.amount,
      method: derived.method,
      source: derived.source,
    },
  }
}

export function findFinalInvoiceTotal(text) {
  const normalized = normalizeText(text)
  if (!normalized) return null

  const strong = collectStrongFinalCandidates(normalized)[0]
  const upper = findChineseUppercaseTotal(normalized)
  const derived = findSummedChineseTotal(normalized)
  const fallback = findSingleChineseTotal(normalized)

  if (upper) {
    return withCrossCheck(upper, derived)
  }

  if (derived?.method === '金额+税额=价税合计') {
    return derived
  }

  return withCrossCheck(strong || derived || fallback, derived)
}

export function normalizeMoney(value) {
  return parseAmount(value)
}

export function validateFinalInvoiceAmount(text, aiAmount, parsedTotal) {
  const detected = findFinalInvoiceTotal(text)
  const ai = normalizeMoney(aiAmount)
  const parsed = normalizeMoney(parsedTotal)
  const checkedAmount = parsed || ai

  if (!detected) {
    return {
      invoiceTotal: 0,
      invoiceCurrency: '',
      status: 'unverified',
      message: '未通过金额校验，查阅问题',
      aiAmount: checkedAmount,
    }
  }

  if (detected.conflict) {
    return {
      invoiceTotal: detected.amount,
      invoiceCurrency: detected.currency,
      status: 'conflict',
      message: `未通过金额校验，查阅问题：${detected.method}=${detected.amount.toFixed(2)}，${detected.conflict.method}=${detected.conflict.amount.toFixed(2)}`,
      source: detected.source,
      crossCheck: detected.conflict,
      aiAmount: checkedAmount,
    }
  }

  const corrected = checkedAmount > 0 && !sameMoney(checkedAmount, detected.amount)

  return {
    invoiceTotal: detected.amount,
    invoiceCurrency: detected.currency,
    status: corrected ? 'corrected' : 'passed',
    message: corrected
      ? '金额已按发票最终金额修正'
      : '已通过金额校验',
    source: detected.source,
    method: detected.method,
    crossCheck: detected.crossCheck,
    aiAmount: checkedAmount,
  }
}
