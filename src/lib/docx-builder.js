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
const TITLE = '采购验收单（货物类）'

const COL_WIDTHS = [562, 1843, 1701, 992, 1134, 1418, 1701]
const FIRST_TWO = COL_WIDTHS[0] + COL_WIDTHS[1]
const FIRST_FOUR = COL_WIDTHS.slice(0, 4).reduce((a, b) => a + b, 0)
const LAST_THREE = COL_WIDTHS.slice(4).reduce((a, b) => a + b, 0)
const LAST_FIVE = COL_WIDTHS.slice(2).reduce((a, b) => a + b, 0)
const FULL_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0)

const SINGLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const NIL_BORDER = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
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

function textRun(text, { bold = false, size = 28 } = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, bold, size })
}

function paragraph(text, { bold = false, size = 28, alignment = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment,
    children: [textRun(text, { bold, size })],
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
  } = {}
) {
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines]
  return cell({
    width,
    columnSpan,
    verticalAlign,
    borders,
    children: lines.map((line) => paragraph(line, { bold, size, alignment })),
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
  const headers = ['序号', '货物名称', '规格型号', '送达数量', '单价', '金额小计', '其他']
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

function buildAcceptanceQuestionRow(question, answer, height) {
  return row(
    [
      textCell(question, {
        width: FIRST_FOUR,
        columnSpan: 4,
      }),
      textCell(answer, {
        width: LAST_THREE,
        columnSpan: 3,
        alignment: AlignmentType.CENTER,
      }),
    ],
    height
  )
}

function buildOpinionRows() {
  return [
    row(
      [
        textCell('学院验收意见：', {
          width: FULL_WIDTH,
          columnSpan: 7,
          verticalAlign: VerticalAlign.BOTTOM,
          borders: { bottom: NIL_BORDER },
        }),
      ],
      454
    ),
    row(
      [
        textCell('年  月  日', {
          width: FULL_WIDTH,
          columnSpan: 7,
          alignment: AlignmentType.RIGHT,
          verticalAlign: VerticalAlign.BOTTOM,
          borders: { top: NIL_BORDER },
        }),
      ],
      2154
    ),
  ]
}

export async function buildDocx({ items, screenshots }) {
  assertSafeItemsForDocx(items)

  const totalCNY = items.reduce(
    (sum, item) => sum + (Number(item.subtotal) || 0) * (Number(item.exchangeRate) || 1),
    0
  )

  const rows = [
    buildHeaderRow(),
    ...items.map((item, idx) => buildItemRow(item, idx)),
    buildTotalRow(totalCNY),
    buildSectionTitleRow('验收照片'),
    await buildPhotoContentRow(screenshots),
    buildSectionTitleRow('验收内容'),
    buildAcceptanceQuestionRow(
      '1.供应商是否在规定日期内送货；收货方验收货物外观包装完好；能正常使用；',
      '是',
      704
    ),
    buildAcceptanceQuestionRow(
      '2.需要安装、培训或施工的货物是否已执行安装、培训或施工；',
      '是',
      397
    ),
    buildAcceptanceQuestionRow(
      '3.货物发票内，填写的客户名称、合计金额、数量、品名和规格，经核对与本单位（或招标文件）要求是否一致；',
      '是',
      397
    ),
    buildAcceptanceQuestionRow(
      '4.货物如涉及保修，其使用说明、保修卡及售后服务承诺是否明确；',
      '是',
      397
    ),
    buildAcceptanceQuestionRow('5.收到的货物是否需要执行特殊验收。', '否', 397),
    ...buildOpinionRows(),
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
            margin: { top: 1440, right: 1797, bottom: 1440, left: 1797 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [textRun(TITLE, { bold: true, size: 44 })],
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
