import imageCompression from 'browser-image-compression'

export async function compressImage(file) {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    initialQuality: 0.85,
  }

  let compressed
  try {
    compressed = await imageCompression(file, options)
  } catch (e) {
    compressed = file
  }

  const dataUrl = await imageCompression.getDataUrlFromFile(compressed)
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
