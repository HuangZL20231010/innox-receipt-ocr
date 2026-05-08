const TAG = '%c[Innox]'
const STYLE_INFO = 'color: #2563eb; font-weight: 600'
const STYLE_OK = 'color: #10b981; font-weight: 600'
const STYLE_WARN = 'color: #f59e0b; font-weight: 600'
const STYLE_ERR = 'color: #ef4444; font-weight: 600'

export const log = {
  info: (...args) => console.log(TAG, STYLE_INFO, ...args),
  ok: (...args) => console.log('%c[Innox] ✓', STYLE_OK, ...args),
  warn: (...args) => console.warn('%c[Innox] ⚠', STYLE_WARN, ...args),
  error: (...args) => console.error('%c[Innox] ✗', STYLE_ERR, ...args),
  group: (label) => console.groupCollapsed(`%c[Innox] ${label}`, STYLE_INFO),
  groupEnd: () => console.groupEnd(),
  time: (label) => console.time(`[Innox] ${label}`),
  timeEnd: (label) => console.timeEnd(`[Innox] ${label}`),
  table: (data) => console.table(data),
}

export function fmtBytes(n) {
  if (n == null || isNaN(n)) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function printBanner({ version, github, wechat }) {
  const css = 'color: #2563eb; font-weight: bold; font-size: 14px'
  console.log(
    '%c📋 Innox 发票整理小助手',
    css + '; padding: 4px 8px; background: #dbeafe; border-radius: 4px'
  )
  console.log(
    `%c版本 %c${version}  %cGitHub %c${github}  %c微信 %c${wechat}`,
    'color: #6b7280',
    'color: #111827; font-weight: 600',
    'color: #6b7280',
    'color: #2563eb',
    'color: #6b7280',
    'color: #111827; font-weight: 600'
  )
  console.log('%c所有数据仅在浏览器本地处理，API Key 不会被上传到本应用任何后端', 'color: #9ca3af; font-style: italic')
}
