import { useEffect, useRef, useState } from 'react'

export default function DonationWidget() {
  const [open, setOpen] = useState(false)
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handlePointerDown = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  return (
    <aside
      ref={widgetRef}
      className="fixed left-[calc(50%+524px)] top-1/2 z-40 hidden -translate-y-1/2 xl:block"
      aria-label="支持本站"
    >
      {open && (
        <section
          id="donation-panel"
          role="dialog"
          aria-labelledby="donation-title"
          className="absolute right-full top-1/2 mr-3 w-[340px] -translate-y-1/2 animate-popIn overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <HeartIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 id="donation-title" className="text-base font-semibold text-gray-800">
                  支持本站持续运行
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">自愿支持，量力而行</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="关闭支持本站面板"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            <p className="text-sm leading-6 text-gray-600">
              您的支持将优先用于本站云服务器租金及相关运行费用；扣除实际费用后如有结余，将全部捐赠给“韩红爱心慈善基金会”。
            </p>

            <div className="mt-4 rounded-xl bg-emerald-50 p-3">
              <div className="mb-2.5 flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
                <WechatIcon className="h-4 w-4" />
                <span>请使用微信扫一扫</span>
              </div>
              <img
                src={`${import.meta.env.BASE_URL}wechat-donation-qr.jpg`}
                alt="微信支付收款码"
                className="mx-auto block w-[250px] rounded-lg bg-white shadow-sm"
              />
            </div>

            <p className="mt-3 text-center text-xs text-gray-400">
              感谢你对这个小工具的支持
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="donation-panel"
        className={`group flex min-w-[148px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-white shadow-[0_10px_28px_rgba(37,99,235,0.28)] transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          open
            ? 'border-primary-700 bg-primary-700'
            : 'border-primary-600 bg-gradient-to-br from-primary-500 to-primary-700 hover:-translate-y-0.5 hover:shadow-[0_13px_32px_rgba(37,99,235,0.36)]'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
          <HeartIcon className="h-5 w-5 fill-white/20 transition-transform group-hover:scale-110" />
        </span>
        <span>
          <span className="block text-sm font-semibold">支持本站</span>
          <span className="mt-0.5 block text-[11px] font-normal text-blue-100">
            维持服务运行
          </span>
        </span>
      </button>
    </aside>
  )
}

function HeartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function WechatIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.7 3C4.9 3 1 6.2 1 10.2c0 2.2 1.2 4.2 3.1 5.5l-.8 2.5 2.9-1.5c1.1.4 2.3.7 3.5.7h.5a6.4 6.4 0 0 1-.3-1.9c0-3.8 3.5-6.9 7.9-6.9h.6C17.5 5.4 14 3 9.7 3Zm-2.9 5.5c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2S8 6.6 8 7.3s-.5 1.2-1.2 1.2Zm5.8 0c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2Z" />
      <path d="M23 15.4c0-3.3-3.3-6-7.3-6s-7.3 2.7-7.3 6 3.3 6 7.3 6c1 0 2-.2 2.9-.5l2.4 1.2-.6-2.1c1.6-1.1 2.6-2.7 2.6-4.6Zm-9.7-.8c-.5 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Zm4.9 0c-.5 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Z" />
    </svg>
  )
}
