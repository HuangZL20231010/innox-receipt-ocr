import { EXTRACT_SYSTEM_PROMPT } from '../prompts/extract.js'

const API_URL = 'https://api.deepseek.com/v1/chat/completions'

export async function extractItems(text, apiKey) {
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key')
  if (!text || text.trim().length === 0) throw new Error('PDF 文本为空，无法识别')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      temperature: 0,
      thinking:{
        type: 'disabled'
      },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`DeepSeek API 错误 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回内容为空')

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek 返回非 JSON 内容：' + content.slice(0, 200))
  }

  const items = Array.isArray(parsed.items) ? parsed.items : []
  return items.map((it) => ({
    name: String(it.name ?? ''),
    model: String(it.model ?? ''),
    qty: Number(it.qty) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    subtotal: Number(it.subtotal) || 0,
    other: '',
  }))
}
