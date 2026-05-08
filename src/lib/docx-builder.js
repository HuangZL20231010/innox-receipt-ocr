import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  HeightRule,
} from 'docx'
import { saveAs } from 'file-saver'
import { getImageDimensions } from './compress.js'

const FONT = 'PingFang SC'

const COL_WIDTHS = [853, 1758, 1200, 1200, 1074, 1311, 1123]
const FIRST_TWO = COL_WIDTHS[0] + COL_WIDTHS[1] // 2611
const LAST_FIVE = COL_WIDTHS[2] + COL_WIDTHS[3] + COL_WIDTHS[4] + COL_WIDTHS[5] + COL_WIDTHS[6] // 5908
const FULL_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0) // 8519

const SINGLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const TABLE_BORDERS = {
  top: SINGLE_BORDER,
  bottom: SINGLE_BORDER,
  left: SINGLE_BORDER,
  right: SINGLE_BORDER,
  insideHorizontal: SINGLE_BORDER,
  insideVertical: SINGLE_BORDER,
}

function textRun(text, { bold = false, size = 24 } = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, bold, size })
}

function paragraph(text, { bold = false, size = 24, alignment = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment,
    children: [textRun(text, { bold, size })],
  })
}

function cell({ children, width, columnSpan, alignment }) {
  return new TableCell({
    width: width != null ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    children:
      children ??
      [new Paragraph({ alignment: alignment ?? AlignmentType.LEFT, children: [] })],
  })
}

function textCell(textOrLines, { width, columnSpan, bold = false, size = 24, alignment = AlignmentType.LEFT } = {}) {
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines]
  return cell({
    width,
    columnSpan,
    children: lines.map((line) => paragraph(line, { bold, size, alignment })),
  })
}

function emptyCell({ width, columnSpan } = {}) {
  return cell({ width, columnSpan })
}

function buildHeaderRow() {
  const headers = ['序号', '货物/服务名称', '型号参数', '送达数量', '单价', '金额小计', '其他']
  return new TableRow({
    children: headers.map((text, i) =>
      textCell(text, { width: COL_WIDTHS[i], bold: true, size: 24 })
    ),
  })
}

function buildItemRow(item, index) {
  const fields = [
    String(index + 1),
    item.name || '',
    item.model || '',
    item.qty != null ? String(item.qty) : '',
    item.unitPrice != null ? Number(item.unitPrice).toFixed(2) : '',
    item.subtotal != null ? Number(item.subtotal).toFixed(2) : '',
    item.other || '',
  ]
  return new TableRow({
    height: { value: 485, rule: HeightRule.ATLEAST },
    children: fields.map((text, i) => textCell(text, { width: COL_WIDTHS[i], size: 24 })),
  })
}

function buildTotalRow(total) {
  return new TableRow({
    children: [
      textCell('金额合计', { width: FIRST_TWO, columnSpan: 2, size: 24 }),
      textCell(`RMB ${total.toFixed(2)}`, { width: LAST_FIVE, columnSpan: 5, size: 24 }),
    ],
  })
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

function fitImage(natW, natH, maxW, maxH) {
  const ratio = Math.min(maxW / natW, maxH / natH, 1)
  return { width: Math.round(natW * ratio), height: Math.round(natH * ratio) }
}

function detectImageType(blob) {
  const ext = (blob.type || 'image/png').split('/')[1]?.toLowerCase()
  if (ext === 'jpeg' || ext === 'jpg') return 'jpg'
  if (ext === 'png') return 'png'
  if (ext === 'gif') return 'gif'
  if (ext === 'bmp') return 'bmp'
  return 'png'
}

function makeImageCell(item, isPortrait) {
  const maxW = isPortrait ? 160 : 240
  const maxH = isPortrait ? 300 : 180
  const { width, height } = fitImage(item.dims.width, item.dims.height, maxW, maxH)
  return new TableCell({
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: item.buf,
            transformation: { width, height },
            type: item.type,
          }),
        ],
      }),
    ],
  })
}

function makeEmptyImageCell() {
  return new TableCell({
    children: [new Paragraph({ children: [] })],
  })
}

async function buildPhotoRow(screenshots) {
  const children = [paragraph('验收照片', { size: 24 })]

  if (screenshots.length === 0) {
    children.push(new Paragraph({ children: [] }))
    return new TableRow({
      children: [cell({ width: FULL_WIDTH, columnSpan: 7, children })],
    })
  }

  const items = []
  for (const s of screenshots) {
    const dims = await getImageDimensions(s.blob)
    const buf = await s.blob.arrayBuffer()
    items.push({
      dims,
      buf,
      type: detectImageType(s.blob),
      isPortrait: dims.height >= dims.width,
    })
  }

  const groups = []
  for (const it of items) {
    const last = groups[groups.length - 1]
    if (!last || last.isPortrait !== it.isPortrait) {
      groups.push({ isPortrait: it.isPortrait, items: [it] })
    } else {
      last.items.push(it)
    }
  }

  for (const g of groups) {
    const colCount = g.isPortrait ? 3 : 2
    const rows = []
    for (let i = 0; i < g.items.length; i += colCount) {
      const slice = g.items.slice(i, i + colCount)
      const tcs = slice.map((it) => makeImageCell(it, g.isPortrait))
      while (tcs.length < colCount) tcs.push(makeEmptyImageCell())
      rows.push(new TableRow({ children: tcs }))
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows,
      })
    )
  }

  return new TableRow({
    children: [cell({ width: FULL_WIDTH, columnSpan: 7, children })],
  })
}

function buildAcceptContentRow() {
  return new TableRow({
    height: { value: 728, rule: HeightRule.ATLEAST },
    children: [
      textCell('验收内容', {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
      textCell('☐合格   ☐不合格', {
        width: LAST_FIVE,
        columnSpan: 5,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
    ],
  })
}

function buildDateRow(dateStr) {
  const d = new Date(dateStr)
  const formatted = isNaN(d) ? dateStr : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
  return new TableRow({
    height: { value: 928, rule: HeightRule.ATLEAST },
    children: [
      textCell('验收时间', {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
      textCell(formatted, {
        width: LAST_FIVE,
        columnSpan: 5,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
    ],
  })
}

function buildSignatureRow(labelLines, value) {
  return new TableRow({
    height: { value: 885, rule: HeightRule.ATLEAST },
    children: [
      textCell(labelLines, {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
      textCell(value || '', {
        width: LAST_FIVE,
        columnSpan: 5,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
    ],
  })
}

export async function buildDocx({ items, screenshots, settings }) {
  const total = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0)

  const rows = [
    buildHeaderRow(),
    ...items.map((it, idx) => buildItemRow(it, idx)),
    buildTotalRow(total),
    await buildPhotoRow(screenshots),
    buildAcceptContentRow(),
    buildDateRow(settings.acceptanceDate),
    buildSignatureRow(['团队经办人', '签字确认'], settings.operatorName),
    buildSignatureRow(['辅导老师', '签字确认'], ''),
  ]

  const table = new Table({
    columnWidths: COL_WIDTHS,
    borders: TABLE_BORDERS,
    rows,
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1800, bottom: 1440, left: 1800 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [textRun('深圳科创学院采购验收单（团队自采）', { bold: true, size: 40 })],
          }),
          new Paragraph({ children: [] }),
          table,
          new Paragraph({ children: [] }),
        ],
      },
    ],
  })

  return await Packer.toBlob(doc)
}

export async function downloadDocx(payload) {
  const blob = await buildDocx(payload)
  const date = payload.settings.acceptanceDate?.replace(/-/g, '') || 'output'
  saveAs(blob, `深圳科创学院采购验收单_${date}.docx`)
}
