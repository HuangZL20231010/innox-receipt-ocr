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
import { log, fmtBytes } from './logger.js'
import { formatMoney } from './currency.js'
import { assertSafeItemsForDocx } from './receipt-validation.js'

const FONT = 'PingFang SC'
const TABLE_FONT = '仿宋'
const TITLE = '深圳科创学院采购验收单（团队自采）'

const COL_WIDTHS = [853, 1758, 1200, 1200, 1074, 1311, 1123]
const FIRST_TWO = COL_WIDTHS[0] + COL_WIDTHS[1]
const LAST_FIVE = COL_WIDTHS.slice(2).reduce((a, b) => a + b, 0)
const FULL_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0)

const SINGLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const TABLE_BORDERS = {
  top: SINGLE_BORDER,
  bottom: SINGLE_BORDER,
  left: SINGLE_BORDER,
  right: SINGLE_BORDER,
  insideHorizontal: SINGLE_BORDER,
  insideVertical: SINGLE_BORDER,
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

function textRun(text, { bold = false, size = 28, font = FONT } = {}) {
  return new TextRun({ text: String(text ?? ''), font, bold, size })
}

function paragraph(text, { bold = false, size = 28, alignment = AlignmentType.LEFT, font = FONT } = {}) {
  return new Paragraph({
    alignment,
    children: [textRun(text, { bold, size, font })],
  })
}

function cell({ children, width, columnSpan, alignment, verticalAlign = VerticalAlign.CENTER, borders }) {
  return new TableCell({
    width: width != null ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan,
    verticalAlign,
    borders,
    children:
      children ??
      [new Paragraph({ alignment: alignment ?? AlignmentType.LEFT, children: [] })],
  })
}

function textCell(
  textOrLines,
  {
    width,
    columnSpan,
    bold = false,
    size = 28,
    alignment = AlignmentType.LEFT,
    verticalAlign = VerticalAlign.CENTER,
    borders,
    font = TABLE_FONT,
  } = {}
) {
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines]
  return cell({
    width,
    columnSpan,
    verticalAlign,
    borders,
    children: lines.map((line) => paragraph(line, { bold, size, alignment, font })),
  })
}

function emptyCell({ width, columnSpan, borders } = {}) {
  return cell({ width, columnSpan, borders })
}

function row(children, height) {
  return new TableRow({
    height: height != null ? { value: height, rule: HeightRule.ATLEAST } : undefined,
    children,
  })
}

function buildHeaderRow() {
  const headers = ['序号', '货物/服务名称', '型号参数', '送达数量', '单价', '金额小计', '其他']
  return row(
    headers.map((text, i) =>
      textCell(text, {
        width: COL_WIDTHS[i],
        bold: true,
        alignment: AlignmentType.CENTER,
      })
    ),
    624
  )
}

function buildItemRow(item, index) {
  const fields = [
    String(index + 1),
    item.name || '',
    item.model || '',
    item.qty != null ? String(item.qty) : '',
    item.unitPrice != null ? formatMoney(item.unitPrice, item.currency) : '',
    item.subtotal != null ? formatMoney(item.subtotal, item.currency) : '',
    item.other || '',
  ]
  return row(
    fields.map((text, i) =>
      textCell(text, {
        width: COL_WIDTHS[i],
        alignment: i === 0 || i >= 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
      })
    ),
    510
  )
}

function buildTotalRow(totalCNY) {
  return row(
    [
      textCell('金额合计', {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        alignment: AlignmentType.CENTER,
      }),
      textCell(`RMB ${totalCNY.toFixed(2)}`, {
        width: LAST_FIVE,
        columnSpan: 5,
      }),
    ],
    510
  )
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
  const maxW = isPortrait ? 160 : 260
  const maxH = isPortrait ? 260 : 170
  const { width, height } = fitImage(item.dims.width, item.dims.height, maxW, maxH)
  return new TableCell({
    borders: NO_BORDERS,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
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
    borders: NO_BORDERS,
    children: [new Paragraph({ children: [] })],
  })
}

async function buildPhotoContentRow(screenshots) {
  if (screenshots.length === 0) {
    return row([emptyCell({ width: FULL_WIDTH, columnSpan: 7 })], 2324)
  }

  const photoItems = []
  for (const s of screenshots) {
    const dims = await getImageDimensions(s.blob)
    const buf = await s.blob.arrayBuffer()
    photoItems.push({
      dims,
      buf,
      type: detectImageType(s.blob),
      isPortrait: dims.height >= dims.width,
    })
  }

  const children = []
  const groups = []
  for (const item of photoItems) {
    const last = groups[groups.length - 1]
    if (!last || last.isPortrait !== item.isPortrait) {
      groups.push({ isPortrait: item.isPortrait, items: [item] })
    } else {
      last.items.push(item)
    }
  }

  for (const group of groups) {
    const colCount = group.isPortrait ? 3 : 2
    const rows = []
    for (let i = 0; i < group.items.length; i += colCount) {
      const slice = group.items.slice(i, i + colCount)
      const cells = slice.map((item) => makeImageCell(item, group.isPortrait))
      while (cells.length < colCount) cells.push(makeEmptyImageCell())
      rows.push(new TableRow({ children: cells }))
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows,
      })
    )
  }

  return row([cell({ width: FULL_WIDTH, columnSpan: 7, children })], 2324)
}

function buildSectionTitleRow(text) {
  return row(
    [
      textCell(text, {
        width: FULL_WIDTH,
        columnSpan: 7,
        bold: true,
        alignment: AlignmentType.CENTER,
      }),
    ],
    510
  )
}

function buildAcceptanceCheckRow() {
  return row(
    [
      textCell('验收内容', {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        alignment: AlignmentType.CENTER,
      }),
      textCell('□合格 □不合格', {
        width: LAST_FIVE,
        columnSpan: 5,
        alignment: AlignmentType.CENTER,
        font: 'Apple Symbols',
      }),
    ],
    728
  )
}

function buildAcceptanceDateRow(date) {
  return row(
    [
      textCell('验收时间', {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        alignment: AlignmentType.CENTER,
      }),
      textCell(date ? (() => { const [y, m, d] = date.split('-'); return `${y}年${parseInt(m)}月${parseInt(d)}日` })() : '年  月  日', {
        width: LAST_FIVE,
        columnSpan: 5,
        alignment: AlignmentType.CENTER,
      }),
    ],
    928
  )
}

function buildSignatureRow(label, height) {
  return row(
    [
      textCell(label, {
        width: FIRST_TWO,
        columnSpan: 2,
        bold: true,
        alignment: AlignmentType.CENTER,
      }),
      emptyCell({ width: LAST_FIVE, columnSpan: 5 }),
    ],
    height
  )
}

export async function buildDocx({ items, screenshots, settings = {} }) {
  assertSafeItemsForDocx(items)

  const totalCNY = items.reduce(
    (sum, item) => sum + (Number(item.subtotal) || 0) * (Number(item.exchangeRate) || 1),
    0
  )

  const dateStr = settings.acceptanceDate || ''

  const rows = [
    buildHeaderRow(),
    ...items.map((item, idx) => buildItemRow(item, idx)),
    buildTotalRow(totalCNY),
    buildSectionTitleRow('验收照片'),
    await buildPhotoContentRow(screenshots),
    buildAcceptanceCheckRow(),
    buildAcceptanceDateRow(dateStr),
    buildSignatureRow(['团队经办人', '签字确认'], 885),
    buildSignatureRow(['辅导老师', '签字确认'], 852),
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
          run: { font: TABLE_FONT },
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
            children: [textRun(TITLE, { bold: true, size: 40, font: 'PingFang SC' })],
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
  log.group('📝 生成 Word 文档')
  log.info(`项目数: ${payload.items.length}，截图数: ${payload.screenshots.length}`)
  log.info(`经办人: ${payload.settings.operatorName || '(未填)'}`)
  log.info(`验收日期: ${payload.settings.acceptanceDate}`)
  const t0 = performance.now()
  try {
    const blob = await buildDocx(payload)
    const date = payload.settings.acceptanceDate?.replace(/-/g, '') || 'output'
    const filename = `采购验收单_${date}.docx`
    saveAs(blob, filename)
    log.ok(`生成成功: ${filename} (${fmtBytes(blob.size)})，耗时 ${(performance.now() - t0).toFixed(0)}ms`)
  } catch (e) {
    log.error('生成失败：', e.message)
    throw e
  } finally {
    log.groupEnd()
  }
}
