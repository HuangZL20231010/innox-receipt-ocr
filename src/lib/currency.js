export const CURRENCIES = [
  { code: 'CNY', symbol: '¥',   label: '人民币 CNY' },
  { code: 'USD', symbol: '$',   label: '美元 USD' },
  { code: 'EUR', symbol: '€',   label: '欧元 EUR' },
  { code: 'HKD', symbol: 'HK$', label: '港币 HKD' },
  { code: 'JPY', symbol: '￥',  label: '日元 JPY' },
  { code: 'GBP', symbol: '£',   label: '英镑 GBP' },
  { code: 'AUD', symbol: 'A$',  label: '澳元 AUD' },
  { code: 'SGD', symbol: 'S$',  label: '新加坡元 SGD' },
]

const SYMBOL_MAP = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]))

export function symbolOf(code) {
  return SYMBOL_MAP[code] || code
}

export function formatMoney(amount, code) {
  const n = Number(amount) || 0
  return `${symbolOf(code || 'CNY')}${n.toFixed(2)}`
}

export function formatRateText(currency, rate, date) {
  if (!currency || currency === 'CNY') return ''
  const r = Number(rate)
  if (!r || isNaN(r)) return ''
  const dateStr = date ? ` (${date})` : ''
  return `汇率: 1 ${currency} = ${r.toFixed(4)} CNY${dateStr}`
}

export function isForeign(code) {
  return code && code !== 'CNY'
}
