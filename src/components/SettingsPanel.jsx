import { useState } from 'react'
import { WECHAT_ID } from '../config.js'

export default function SettingsPanel({ settings, onChange }) {
  const [open, setOpen] = useState(!settings.apiKey)
  const [showWechatModal, setShowWechatModal] = useState(false)

  function update(field) {
    return (e) => onChange({ ...settings, [field]: e.target.value })
  }

  async function copyWechat() {
    try {
      await navigator.clipboard.writeText(WECHAT_ID)
      setShowWechatModal(true)
    } catch {
      window.prompt('请手动复制微信号：', WECHAT_ID)
    }
  }

  const apiKeyMissing = !settings.apiKey

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 rounded-lg"
      >
        <span className="flex items-center gap-2 font-medium text-gray-700">
          <span>⚙️</span>
          <span>设置</span>
          {apiKeyMissing && (
            <span className="ml-2 text-xs text-red-500 font-normal">（请先填写 API Key）</span>
          )}
        </span>
        <span className="text-gray-400 text-sm">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-600">DeepSeek API Key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={update('apiKey')}
              placeholder="sk-..."
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center gap-3 text-xs">
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                点这里申请 →
              </a>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={copyWechat}
                className="text-primary-600 hover:underline"
                title={`微信号 ${WECHAT_ID}`}
              >
                向开发者申请体验（点击复制微信）
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-600">团队经办人姓名</span>
            <input
              type="text"
              value={settings.operatorName}
              onChange={update('operatorName')}
              placeholder="例如：张三"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-600">验收日期</span>
            <input
              type="date"
              value={settings.acceptanceDate}
              onChange={update('acceptanceDate')}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        </div>
      )}

      {showWechatModal && (
        <div
          onClick={() => setShowWechatModal(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center animate-popIn"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-9 h-9 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">已复制微信号到剪贴板</h3>
            <p className="text-sm text-gray-500 mb-1">快去添加吧！</p>
            <p className="text-xs text-gray-400 mb-5 font-mono select-all">微信号：{WECHAT_ID}</p>
            <button
              onClick={() => setShowWechatModal(false)}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
