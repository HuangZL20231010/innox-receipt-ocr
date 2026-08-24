import { log } from './logger.js'

const BASE = '/api/exchange-rate'
const cache = new Map() // key: `${currency}-${date}` → { rate, actualDate }

export async function fetchRate(currency, date) {
  if (!currency || currency === 'CNY') {
    return { rate: 1, actualDate: date || '' }
  }

  const key = `${currency}-${date || 'latest'}`
  if (cache.has(key)) {
    log.info(`💱 命中缓存：${key} = ${cache.get(key).rate}`)
    return cache.get(key)
  }

  const requestedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
  const params = new URLSearchParams({ currency })
  if (requestedDate) params.set('date', requestedDate)
  const url = `${BASE}?${params}`

  log.info(`💱 拉取央行中间价 ${currency} → CNY (${requestedDate || 'latest'})`)
  const t0 = performance.now()

  let res
  try {
    res = await fetch(url)
  } catch (e) {
    log.error('💱 网络错误：', e.message)
    throw new Error(`无法连接汇率服务：${e.message}`)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    log.error(`💱 HTTP ${res.status}`, data)
    throw new Error(data?.error || `汇率获取失败 (${res.status})`)
  }

  const data = await res.json()
  const rate = data?.rate
  const actualDate = data?.date || date || ''
  if (!rate || isNaN(rate)) {
    log.error('💱 汇率字段缺失：', data)
    throw new Error('汇率数据缺失')
  }

  log.ok(
    `💱 ${currency} → CNY = ${rate}（${actualDate}），耗时 ${(performance.now() - t0).toFixed(0)}ms`
  )

  const result = { rate, actualDate, source: data.source || '', sourceUrl: data.sourceUrl || '' }
  cache.set(key, result)
  return result
}

export function clearRateCache() {
  cache.clear()
}
