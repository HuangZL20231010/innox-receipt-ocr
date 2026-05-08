import imageCompression from 'browser-image-compression'
import { log, fmtBytes } from './logger.js'

export async function compressImage(file) {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    initialQuality: 0.85,
  }

  log.group(`🖼 压缩图片: ${file.name}`)
  log.info(`原始: ${fmtBytes(file.size)} (${file.type})`)
  const t0 = performance.now()

  let compressed
  try {
    compressed = await imageCompression(file, options)
    log.ok(`压缩后: ${fmtBytes(compressed.size)}（节省 ${(((file.size - compressed.size) / file.size) * 100).toFixed(0)}%），耗时 ${(performance.now() - t0).toFixed(0)}ms`)
  } catch (e) {
    log.warn('压缩失败，使用原图：', e.message)
    compressed = file
  }

  const dataUrl = await imageCompression.getDataUrlFromFile(compressed)
  log.groupEnd()
  return { blob: compressed, dataUrl }
}

export function getImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
