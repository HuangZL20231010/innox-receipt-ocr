import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { log, fmtBytes } from './logger.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export async function parsePDF(file) {
  log.group(`📄 解析 PDF: ${file.name} (${fmtBytes(file.size)})`)
  const t0 = performance.now()
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    log.info(`页数: ${pdf.numPages}`)

    const allText = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item) => item.str).join(' ')
      allText.push(pageText)
      log.info(`第 ${i} 页：${pageText.length} 字符`)
    }

    const text = allText.join('\n').trim()
    if (!text) {
      log.warn('PDF 未提取到文字（可能是扫描件）')
      throw new Error('该 PDF 未提取到任何文字（可能为扫描件，请上传电子发票）')
    }
    log.ok(`完成，共 ${text.length} 字符，耗时 ${(performance.now() - t0).toFixed(0)}ms`)
    log.group('📜 PDF 提取的完整文本')
    console.log(text)
    log.groupEnd()
    return text
  } catch (e) {
    log.error('PDF 解析失败：', e.message)
    throw e
  } finally {
    log.groupEnd()
  }
}
