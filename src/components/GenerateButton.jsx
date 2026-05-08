import { useState } from 'react'
import { downloadDocx } from '../lib/docx-builder.js'

export default function GenerateButton({ items, screenshots, settings }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function validate() {
    if (items.length === 0) return '至少需要一条采购明细'
    if (!settings.acceptanceDate) return '请填写验收日期'
    return ''
  }

  async function handle() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setLoading(true)
    try {
      await downloadDocx({ items, screenshots, settings })
    } catch (e) {
      setError(e.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="text-center">
      <button
        onClick={handle}
        disabled={loading}
        className="px-8 py-3 bg-primary-600 text-white text-base font-medium rounded-lg shadow hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '生成中…' : '🚀 生成采购验收单 Word 文件'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-400">文件将自动下载到浏览器默认下载目录</p>
    </section>
  )
}
