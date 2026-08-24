import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PBC_ORIGIN = 'https://www.pbc.gov.cn'
const LIST_PATH = '/zhengcehuobisi/125207/125217/125925'
const SOURCE = '中国人民银行人民币汇率中间价'
const REQUEST_TIMEOUT_MS = 12_000
const MAX_ROLLBACK_DAYS = 10

const CURRENCIES = {
  USD: { name: '美元', units: 1 },
  EUR: { name: '欧元', units: 1 },
  HKD: { name: '港元', units: 1 },
  JPY: { name: '日元', units: 100 },
  GBP: { name: '英镑', units: 1 },
  AUD: { name: '澳大利亚元', units: 1 },
  SGD: { name: '新加坡元', units: 1 },
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const cachePath = process.env.EXCHANGE_CACHE_PATH || path.join(moduleDir, 'data', 'exchange-rates.json')
const dataDir = path.dirname(cachePath)
let cachePromise
let cacheWritePromise = Promise.resolve()

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('日期格式必须为 YYYY-MM-DD')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('日期无效')
  }
  return parsed
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function previousDay(date) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() - 1)
  return result
}

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'InnoxReceiptOCR/1.0 (+exchange-rate lookup)' },
    })
    if (!response.ok) throw new Error(`央行网站返回 HTTP ${response.status}`)
    return await response.text()
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('访问央行网站超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function parseList(html) {
  const entries = []
  const pattern = /href=['"]([^'"]+)['"][^>]*title=['"](\d{4})年(\d{1,2})月(\d{1,2})日[^'"]*人民币汇率中间价公告['"]/g
  for (const match of html.matchAll(pattern)) {
    const date = `${match[2]}-${match[3].padStart(2, '0')}-${match[4].padStart(2, '0')}`
    entries.push({ date, url: new URL(match[1], PBC_ORIGIN).href })
  }
  return entries
}

async function findAnnouncement(date) {
  let current = assertDate(date)
  for (let offset = 0; offset <= MAX_ROLLBACK_DAYS; offset += 1) {
    const candidate = formatDate(current)
    const page = await findPageForDate(candidate)
    const match = page.find((entry) => entry.date === candidate)
    if (match) return match
    current = previousDay(current)
  }
  throw new Error(`${date} 及之前 ${MAX_ROLLBACK_DAYS} 天内没有找到中间价公告`)
}

async function readListPage(pageNumber) {
  const suffix = pageNumber === 1 ? 'index.html' : `17105-${pageNumber}.html`
  const html = await fetchText(`${PBC_ORIGIN}${LIST_PATH}/${suffix}`)
  const entries = parseList(html)
  if (!entries.length) throw new Error('无法解析央行中间价公告列表')
  const totalMatch = html.match(/totalpage=['"](\d+)['"]/)
  return { entries, totalPages: Number(totalMatch?.[1]) || 1 }
}

async function findPageForDate(date) {
  const first = await readListPage(1)
  const firstNewest = first.entries[0].date
  const firstOldest = first.entries.at(-1).date
  if (date >= firstOldest) return first.entries
  if (date > firstNewest) return first.entries

  let low = 2
  let high = first.totalPages
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const page = await readListPage(middle)
    const newest = page.entries[0].date
    const oldest = page.entries.at(-1).date
    if (date > newest) high = middle - 1
    else if (date < oldest) low = middle + 1
    else return page.entries
  }
  return []
}

function articleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseRate(html, currency) {
  const config = CURRENCIES[currency]
  const text = articleText(html)
  const pattern = new RegExp(`${config.units}${config.name}对人民币(\\d+(?:\\.\\d+)?)元`)
  const match = text.match(pattern)
  if (!match) throw new Error(`央行公告中没有找到 ${currency} 汇率`)
  return Number((Number(match[1]) / config.units).toFixed(10))
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function saveCache(cache) {
  await mkdir(dataDir, { recursive: true })
  const temporaryPath = `${cachePath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, cachePath)
}

export function supportedCurrencies() {
  return Object.keys(CURRENCIES)
}

export async function getPbcExchangeRate(currency, requestedDate) {
  if (!CURRENCIES[currency]) throw new Error(`不支持币种 ${currency}`)
  assertDate(requestedDate)
  const key = `${currency}:${requestedDate}`
  cachePromise ||= loadCache()
  const cache = await cachePromise
  if (cache[key]) {
    return { ...cache[key], rate: Number(Number(cache[key].rate).toFixed(10)), cached: true }
  }

  const announcement = await findAnnouncement(requestedDate)
  const html = await fetchText(announcement.url)
  const result = {
    currency,
    rate: parseRate(html, currency),
    requestedDate,
    date: announcement.date,
    source: SOURCE,
    sourceUrl: announcement.url,
  }
  cache[key] = result
  cacheWritePromise = cacheWritePromise.catch(() => {}).then(() => saveCache(cache))
  await cacheWritePromise
  return { ...result, cached: false }
}
