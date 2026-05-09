import { log } from './logger.js'

const BASE = 'https://api.frankfurter.dev/v1'
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

  const path = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'latest'
  const url = `${BASE}/${path}?base=${currency}&symbols=CNY`

  log.info(`💱 拉取汇率 ${currency} → CNY (${path})`)
  const t0 = performance.now()

  let res
  try {
    res = await fetch(url)
  } catch (e) {
    log.error('💱 网络错误：', e.message)
    throw new Error(`无法连接汇率服务：${e.message}`)
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    log.error(`💱 HTTP ${res.status}`, txt)
    throw new Error(`汇率获取失败 (${res.status})`)
  }

  const data = await res.json()
  const rate = data?.rates?.CNY
  const actualDate = data?.date || date || ''
  if (!rate || isNaN(rate)) {
    log.error('💱 汇率字段缺失：', data)
    throw new Error('汇率数据缺失')
  }

  log.ok(
    `💱 ${currency} → CNY = ${rate}（${actualDate}），耗时 ${(performance.now() - t0).toFixed(0)}ms`
  )

  const result = { rate, actualDate }
  cache.set(key, result)
  return result
}

export function clearRateCache() {
  cache.clear()
}
