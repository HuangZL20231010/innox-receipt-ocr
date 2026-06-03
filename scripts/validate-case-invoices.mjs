import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { findFinalInvoiceTotal } from '../src/lib/invoice-total.js'

const caseDir = process.argv[2] || process.env.CASE_INVOICE_DIR
assert.ok(caseDir, '请传入案例发票目录：node scripts/validate-case-invoices.mjs <dir>')

function expectedAmountFromFilename(filename) {
  const match = filename.match(/-([0-9]+(?:\.[0-9]{1,2})?)元-/)
  return match ? Math.round(Number(match[1]) * 100) / 100 : null
}

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

const entries = await fs.readdir(caseDir)
const invoiceFiles = entries.filter((name) => /-发票\.pdf$/i.test(name))
assert.ok(invoiceFiles.length > 0, `未找到单张发票 PDF：${caseDir}`)

const failures = []
const methods = new Map()

for (const filename of invoiceFiles) {
  const expected = expectedAmountFromFilename(filename)
  if (expected == null) continue

  const text = await extractPdfText(path.join(caseDir, filename))
  const result = findFinalInvoiceTotal(text)
  const actual = result?.amount
  const ok = actual != null && Math.abs(expected - actual) <= 0.01

  methods.set(result?.method || 'none', (methods.get(result?.method || 'none') || 0) + 1)

  if (!ok) {
    failures.push({
      filename,
      expected,
      actual,
      method: result?.method || '',
      source: result?.source || '',
    })
  }
}

if (failures.length > 0) {
  console.table(failures)
  throw new Error(`案例发票金额校验失败：${failures.length}/${invoiceFiles.length}`)
}

console.log(
  `case invoice validation passed: ${invoiceFiles.length}/${invoiceFiles.length}`,
  Object.fromEntries(methods)
)
