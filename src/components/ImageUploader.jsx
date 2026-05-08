import { useRef, useState } from 'react'

export default function ImageUploader({ screenshots, onAdd, onDelete }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
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
        <span className="mr-2">🖼</span>
        2. 上传购买截图
        <span className="ml-2 text-sm font-normal text-gray-500">（仅作为验收照片附在 Word 中，不识别）</span>
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
        <p className="text-gray-600">拖拽图片到此处，或点击选择文件</p>
        <p className="text-xs text-gray-400 mt-1">支持 jpg / png / webp，自动压缩</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {screenshots.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {screenshots.map((s) => (
            <div
              key={s.id}
              className="relative group border border-gray-200 rounded overflow-hidden bg-gray-50"
            >
              <img
                src={s.dataUrl}
                alt={s.name}
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-end justify-between p-2 transition-colors">
                <span className="text-xs text-white opacity-0 group-hover:opacity-100 truncate max-w-[60%]">
                  {s.name}
                </span>
                <button
                  onClick={() => onDelete(s.id)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-white text-red-600 rounded shadow hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
