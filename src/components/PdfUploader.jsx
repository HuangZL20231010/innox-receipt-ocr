import { useRef, useState } from 'react'

const STATUS_LABELS = {
  parsing: { text: '⏳ 解析 PDF…', cls: 'text-blue-600 bg-blue-50' },
  extracting: { text: '🤖 AI 识别中…', cls: 'text-blue-600 bg-blue-50' },
  done: { text: '✅ 已识别', cls: 'text-green-700 bg-green-50' },
  error: { text: '❌ 失败', cls: 'text-red-600 bg-red-50' },
}

export default function PdfUploader({ pdfFiles, onAdd, onDelete, onRetry }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (files.length === 0) return
    onAdd(files)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h2 className="font-medium text-gray-800 mb-3">
        <span className="mr-2">📄</span>
        1. 上传发票 PDF
        <span className="ml-2 text-sm font-normal text-gray-500">（自动识别项目和金额）</span>
      </h2>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer border-2 border-dashed rounded-lg py-10 text-center transition-colors ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <p className="text-gray-600">拖拽 PDF 文件到此处，或点击选择文件</p>
        <p className="text-xs text-gray-400 mt-1">支持多文件批量上传</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {pdfFiles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pdfFiles.map((f) => {
            const s = STATUS_LABELS[f.status] ?? STATUS_LABELS.parsing
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded border border-gray-100"
              >
                <span className="text-2xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{f.name}</p>
                  {f.status === 'done' && (
                    <p className="text-xs text-gray-500">识别出 {f.itemCount ?? 0} 个项目</p>
                  )}
                  {f.status === 'error' && (
                    <p className="text-xs text-red-500">{f.error}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${s.cls}`}>{s.text}</span>
                {f.status === 'error' && (
                  <button
                    onClick={() => onRetry(f.id)}
                    className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
                  >
                    重试
                  </button>
                )}
                <button
                  onClick={() => onDelete(f.id)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                  title="移除"
                >
                  删除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
