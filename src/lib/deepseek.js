import { EXTRACT_SYSTEM_PROMPT } from '../prompts/extract.js'
import { log } from './logger.js'

const API_URL = 'https://api.deepseek.com/v1/chat/completions'

export async function extractItems(text, apiKey) {
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

  const items = Array.isArray(parsed.items) ? parsed.items : []
  const normalized = items.map((it) => ({
    name: String(it.name ?? ''),
    model: String(it.model ?? ''),
    qty: Number(it.qty) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    subtotal: Number(it.subtotal) || 0,
    other: '',
  }))

  log.ok(`抽取出 ${normalized.length} 个项目`)
  if (normalized.length > 0) log.table(normalized)
  log.groupEnd()

  return normalized
}
