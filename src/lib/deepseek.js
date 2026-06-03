import { EXTRACT_SYSTEM_PROMPT } from '../prompts/extract.js'
import { log } from './logger.js'
import { normalizeMoney, validateFinalInvoiceAmount } from './invoice-total.js'

const API_URL = 'https://api.deepseek.com/v1/chat/completions'

const INVOICE_HINT_RE = /电子发票|发票|价税合计|购买方|销售方|纳税人识别号|invoice|receipt|total/i
const GENERIC_FILENAME_PARTS = new Set(['发票', '其他', 'pdf'])

function cleanField(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[，,、;；]+$/g, '')
    .trim()
}

function compactChineseText(text) {
  return String(text || '')
    .replace(/([0-9])\s*\.\s*([0-9])/g, '$1.$2')
    .replace(/([¥￥$€£])\s+(?=[0-9])/g, '$1')
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function inferInvoiceDate(text, filename = '') {
  const source = `${text || ''} ${filename || ''}`
  const chinese = source.match(/(?:开票日期|日期)[:：\s]*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/)
  if (chinese) return normalizeDate(chinese[1], chinese[2], chinese[3])

  const numeric = source.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  return numeric ? normalizeDate(numeric[1], numeric[2], numeric[3]) : ''
}

function cleanInvoiceName(value) {
  return cleanField(value)
    .replace(/^\*+|\*+$/g, '')
    .split(/规格型号|单位|数量|单价|金额|税率|征收率|税额|合计|价税合计/)[0]
    .replace(/[¥￥$€£0-9].*$/g, '')
    .trim()
}

function inferNameFromInvoiceText(text) {
  const normalized = compactChineseText(text)
  const starred = [...normalized.matchAll(/\*([^*]{1,30})\*([^*]{0,80})/g)]
    .map((match) => {
      const category = cleanInvoiceName(match[1])
      const detail = cleanInvoiceName(match[2])
      if (!category && !detail) return ''
      if (category && detail && category !== detail) return `${category}-${detail}`
      return category || detail
    })
    .filter((name) => name && !/购买方|销售方|纳税人|开户|备注|开票|合计|价税|税额/.test(name))

  if (starred.length === 1) return starred[0]
  if (starred.length > 1) {
    const categories = [
      ...new Set(starred.map((name) => cleanInvoiceName(name.split('-')[0])).filter(Boolean)),
    ]
    if (categories.length === 1) return `${categories[0]}等`
    return `${categories.slice(0, 2).join('、')}等`
  }

  const row = normalized.match(/项目名称.{0,100}?税额(.{2,160}?)(?:合计|价税合计)/)
  const rowName = cleanInvoiceName(row?.[1] || '')
  return rowName || ''
}

function inferAmountFromFilename(filename = '') {
  const base = filename.replace(/\.[^.]+$/i, '')
  const candidates = [...base.matchAll(/(?:^|[-_\s])([0-9]+(?:\.[0-9]{1,2})?)\s*(元)?(?=$|[-_\s])/g)]
    .map((match) => ({
      amount: normalizeMoney(match[1]),
      hasDecimal: match[1].includes('.'),
      hasYuan: Boolean(match[2]),
      index: match.index ?? 0,
    }))
    .filter((item) => item.amount > 0)
  const chosen =
    candidates.find((item) => item.hasDecimal || item.hasYuan) ||
    candidates.find((item) => item.index > 0)

  return chosen?.amount || 0
}

function inferNameFromFilename(filename = '') {
  const base = filename.replace(/\.[^.]+$/i, '')
  const parts = base
    .split(/[-_]/)
    .map((part) => cleanField(part))
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part))
    .filter((part) => !/^[0-9]+(?:\.[0-9]{1,2})?元?$/.test(part))
    .filter((part) => !/^(?:20\d{2})[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(part))
    .filter((part) => !GENERIC_FILENAME_PARTS.has(part.toLowerCase()))

  return parts[0] || ''
}

function inferFallbackFields(text, filename) {
  return {
    name: inferNameFromInvoiceText(text) || inferNameFromFilename(filename),
    invoiceDate: inferInvoiceDate(text, filename),
    filenameAmount: inferAmountFromFilename(filename),
  }
}

function enrichUnverifiedAmount(amountCheck, amount, currency) {
  if (amountCheck.invoiceTotal > 0 || amount <= 0) return amountCheck

  return {
    ...amountCheck,
    invoiceTotal: amount,
    invoiceCurrency: currency || amountCheck.invoiceCurrency || 'CNY',
    message: '未通过金额校验，查阅问题：已生成待核对明细，但未能在发票正文中完成最终金额校验',
  }
}

export function normalizeExtractedItems(text, parsed = {}, options = {}) {
  const filename = options.filename || ''
  const aiItems = Array.isArray(parsed.items) ? parsed.items : []
  const rawItem = parsed.item || aiItems[0] || {}
  const inferred = inferFallbackFields(text, filename)
  const amountCheck = validateFinalInvoiceAmount(
    text,
    rawItem.subtotal,
    parsed.invoiceTotal ?? parsed.totalAmount
  )

  const qty = Number(rawItem.qty) > 0 ? Number(rawItem.qty) : 1
  const aiAmount =
    normalizeMoney(rawItem.subtotal) || normalizeMoney(parsed.invoiceTotal ?? parsed.totalAmount)
  const displayAmount =
    normalizeMoney(amountCheck.invoiceTotal) || aiAmount || inferred.filenameAmount || 0
  const currency = String(
    amountCheck.invoiceCurrency || rawItem.currency || parsed.currency || 'CNY'
  ).toUpperCase()
  const displayAmountCheck = enrichUnverifiedAmount(amountCheck, displayAmount, currency)
  const name = cleanField(rawItem.name) || inferred.name || '待核对采购项目'
  const invoiceDate = cleanField(rawItem.invoiceDate || parsed.invoiceDate || inferred.invoiceDate)
  const shouldCreate = displayAmount > 0 || cleanField(rawItem.name) || inferred.name || INVOICE_HINT_RE.test(text)

  if (!shouldCreate) return []

  return [
    {
      name,
      model: cleanField(rawItem.model),
      qty,
      unitPrice: displayAmount > 0 && qty > 0 ? Math.round((displayAmount / qty) * 100) / 100 : 0,
      subtotal: displayAmount,
      currency,
      invoiceDate,
      invoiceTotal: displayAmountCheck.invoiceTotal,
      amountValidation: displayAmountCheck,
      exchangeRate: 1,
      other: cleanField(rawItem.other),
    },
  ]
}

export async function extractItems(text, apiKey, options = {}) {
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key')
  if (!text || text.trim().length === 0) throw new Error('PDF 文本为空，无法识别')

  log.group('🤖 调用 DeepSeek 抽取')
  log.info(`输入文本长度: ${text.length} 字符`)
  const t0 = performance.now()

  const requestBody = {
    model: 'deepseek-v4-flash',
    temperature: 0,
    thinking: {
      type: 'disabled',
    },
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
  }

  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })
  } catch (e) {
    log.error('网络请求失败：', e.message)
    log.groupEnd()
    throw new Error(`无法连接 DeepSeek API：${e.message}`)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    log.error(`HTTP ${res.status}：`, errText)
    log.groupEnd()
    throw new Error(`DeepSeek API 错误 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const elapsed = (performance.now() - t0).toFixed(0)

  if (data?.usage) {
    log.info(
      `Tokens: prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens}`
    )
  }
  log.info(`耗时 ${elapsed}ms`)

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    log.error('DeepSeek 返回内容为空，完整响应：', data)
    log.groupEnd()
    throw new Error('DeepSeek 返回内容为空')
  }

  log.group('📥 DeepSeek 原始返回')
  console.log(content)
  log.groupEnd()

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    log.error('返回非 JSON，无法解析')
    log.groupEnd()
    throw new Error('DeepSeek 返回非 JSON 内容：' + content.slice(0, 200))
  }

  const normalized = normalizeExtractedItems(text, parsed, options)

  log.ok(`抽取出 ${normalized.length} 条发票汇总明细`)
  if (normalized.length > 0) log.table(normalized)
  log.groupEnd()

  return normalized
}
