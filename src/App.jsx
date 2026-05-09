import { useState } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import SettingsPanel from './components/SettingsPanel.jsx'
import PdfUploader from './components/PdfUploader.jsx'
import ImageUploader from './components/ImageUploader.jsx'
import ItemsTable from './components/ItemsTable.jsx'
import GenerateButton from './components/GenerateButton.jsx'
import { parsePDF } from './lib/pdf.js'
import { extractItems } from './lib/deepseek.js'
import { compressImage } from './lib/compress.js'
import { fetchRate } from './lib/exchange.js'
import { formatRateText, isForeign } from './lib/currency.js'
import { WECHAT_ID, GITHUB_URL } from './config.js'

const today = () => new Date().toISOString().split('T')[0]

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function App() {
  const [settings, setSettings] = useLocalStorage('innox-receipt-settings', {
    apiKey: '',
    operatorName: '',
    acceptanceDate: today(),
  })
  const [pdfFiles, setPdfFiles] = useState([])
  const [items, setItems] = useState([])
  const [screenshots, setScreenshots] = useState([])

  async function processPdf(entry, apiKey) {
    const updateStatus = (patch) =>
      setPdfFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, ...patch } : f)))

    try {
      updateStatus({ status: 'parsing', error: '' })
      const text = await parsePDF(entry.file)

      updateStatus({ status: 'extracting' })
      const extracted = await extractItems(text, apiKey)

      const newItems = extracted.map((it) => ({
        id: uid(),
        sourceId: entry.id,
        ...it,
      }))
      setItems((prev) => [...prev, ...newItems])

      updateStatus({ status: 'done', itemCount: newItems.length })

      // 异步给外币条目拉汇率
      newItems.forEach((item) => {
        if (isForeign(item.currency)) {
          autoFetchRate(item.id, item.currency, item.invoiceDate)
        }
      })
    } catch (e) {
      updateStatus({ status: 'error', error: e.message || String(e) })
    }
  }

  async function autoFetchRate(itemId, currency, date) {
    try {
      const { rate, actualDate } = await fetchRate(currency, date)
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                exchangeRate: rate,
                invoiceDate: it.invoiceDate || actualDate,
                other: formatRateText(currency, rate, actualDate),
              }
            : it
        )
      )
    } catch (e) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, other: `⚠ 汇率获取失败：${e.message}，请手动填写` }
            : it
        )
      )
    }
  }

  function handleCurrencyChange(itemId, newCurrency) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it
        if (newCurrency === 'CNY') {
          return { ...it, currency: 'CNY', exchangeRate: 1, other: '' }
        }
        return { ...it, currency: newCurrency, exchangeRate: 1, other: '正在获取汇率…' }
      })
    )
    if (newCurrency !== 'CNY') {
      const item = items.find((x) => x.id === itemId)
      autoFetchRate(itemId, newCurrency, item?.invoiceDate || '')
    }
  }

  function handleInvoiceDateChange(itemId, newDate) {
    const item = items.find((x) => x.id === itemId)
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, invoiceDate: newDate } : it))
    )
    if (item && isForeign(item.currency)) {
      autoFetchRate(itemId, item.currency, newDate)
    }
  }

  function handleAddPdf(files) {
    const entries = files.map((file) => ({
      id: uid(),
      file,
      name: file.name,
      status: 'parsing',
    }))
    setPdfFiles((prev) => [...prev, ...entries])
    const apiKey = settings.apiKey
    entries.forEach((entry) => processPdf(entry, apiKey))
  }

  function handleDeletePdf(id) {
    setPdfFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function handleRetryPdf(id) {
    const entry = pdfFiles.find((f) => f.id === id)
    if (!entry) return
    setItems((prev) => prev.filter((it) => it.sourceId !== id))
    processPdf(entry, settings.apiKey)
  }

  async function handleAddImages(files) {
    for (const file of files) {
      try {
        const { blob, dataUrl } = await compressImage(file)
        setScreenshots((prev) => [
          ...prev,
          { id: uid(), name: file.name, blob, dataUrl },
        ])
      } catch (e) {
        console.error('压缩失败：', e)
      }
    }
  }

  function handleDeleteImage(id) {
    setScreenshots((prev) => prev.filter((s) => s.id !== id))
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  function deleteItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function addEmptyItem() {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: '',
        model: '',
        qty: 1,
        unitPrice: 0,
        subtotal: 0,
        currency: 'CNY',
        exchangeRate: 1,
        invoiceDate: '',
        other: '',
      },
    ])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="w-11 h-11 object-contain rounded shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Innox 发票整理小助手</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              上传发票和购买截图，一键生成《深圳科创学院采购验收单（团队自采）》
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        <SettingsPanel settings={settings} onChange={setSettings} />
        <PdfUploader
          pdfFiles={pdfFiles}
          onAdd={handleAddPdf}
          onDelete={handleDeletePdf}
          onRetry={handleRetryPdf}
        />
        <ImageUploader
          screenshots={screenshots}
          onAdd={handleAddImages}
          onDelete={handleDeleteImage}
        />
        <ItemsTable
          items={items}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAdd={addEmptyItem}
          onCurrencyChange={handleCurrencyChange}
          onDateChange={handleInvoiceDateChange}
        />
        <GenerateButton items={items} screenshots={screenshots} settings={settings} />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-4">
        <div className="max-w-5xl mx-auto px-5 py-5 text-center text-xs text-gray-500 space-y-2">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-600 hover:text-primary-600"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>GitHub 仓库</span>
            </a>
            <span className="text-gray-300">|</span>
            <span>
              💬 微信：
              <span className="font-mono select-all text-gray-700">{WECHAT_ID}</span>
            </span>
          </div>
          <p className="text-gray-400">所有数据仅存于浏览器本地，API Key 不会上传到任何服务器</p>
        </div>
      </footer>
    </div>
  )
}
