import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { findFinalInvoiceTotal } from '../src/lib/invoice-total.js'

const folder = process.argv[2] || process.env.CHINESE_INVOICE_DIR
assert.ok(folder, '请传入中文发票目录：node scripts/validate-chinese-invoice-folder.mjs <dir>')

async function extractPdfText(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath))
  const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise
  const pages = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join(' '))
  }

  return pages.join('\n').trim()
}

function isChineseInvoice(text) {
  return /电子发票|价税合计|购买方|销售方|纳税人识别号/.test(text)
}

const entries = await fs.readdir(folder)
const pdfFiles = entries.filter((name) => /\.pdf$/i.test(name))
assert.ok(pdfFiles.length > 0, `未找到 PDF：${folder}`)

const results = []
const failures = []

for (const filename of pdfFiles) {
  const filePath = path.join(folder, filename)
  const text = await extractPdfText(filePath)
  if (!isChineseInvoice(text)) continue

  const result = findFinalInvoiceTotal(text)
  const ok =
    !!result &&
    !result.conflict &&
    result.method?.includes('中文大写/小写') &&
    !!result.crossCheck

  const row = {
    filename,
    amount: result?.amount ?? null,
    currency: result?.currency ?? '',
    method: result?.method ?? '',
    crossChecked: !!result?.crossCheck,
  }
  results.push(row)

  if (!ok) failures.push(row)
}

assert.ok(results.length > 0, `未找到中国电子发票：${folder}`)

if (failures.length > 0) {
  console.table(failures)
  throw new Error(`中国发票内部金额校验失败：${failures.length}/${results.length}`)
}

console.table(results)
console.log(`chinese invoice folder validation passed: ${results.length}/${results.length}`)
