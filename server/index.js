import http from 'node:http'
import { getPbcExchangeRate, supportedCurrencies } from './pbc-exchange-rate.js'

const host = process.env.EXCHANGE_API_HOST || '127.0.0.1'
const port = Number(process.env.EXCHANGE_API_PORT || 3001)

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? 'public, max-age=3600' : 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function localToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json(response, 200, { ok: true })
  }
  if (request.method !== 'GET' || url.pathname !== '/api/exchange-rate') {
    return json(response, 404, { error: '接口不存在' })
  }

  const currency = (url.searchParams.get('currency') || '').toUpperCase()
  const date = url.searchParams.get('date') || localToday()
  if (!supportedCurrencies().includes(currency)) {
    return json(response, 400, { error: `不支持币种 ${currency || '(空)'}` })
  }

  try {
    return json(response, 200, await getPbcExchangeRate(currency, date))
  } catch (error) {
    console.error(`[exchange-rate] ${currency} ${date}:`, error)
    const isInputError = /日期格式|日期无效|不支持币种/.test(error.message)
    return json(response, isInputError ? 400 : 502, { error: error.message })
  }
})

server.listen(port, host, () => {
  console.log(`Exchange-rate API listening on http://${host}:${port}`)
})
