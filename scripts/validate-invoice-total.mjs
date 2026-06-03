import assert from 'node:assert/strict'
import {
  findFinalInvoiceTotal,
  validateFinalInvoiceAmount,
} from '../src/lib/invoice-total.js'
import { normalizeExtractedItems } from '../src/lib/deepseek.js'

const cases = [
  {
    name: 'Chinese tax-included lowercase total wins',
    text: '合计 ¥3968.95 ¥515.98 价税合计(大写) 肆仟肆佰捌拾肆圆玖角叁分 (小写) ¥4484.93 备注 5596645A',
    amount: 4484.93,
    currency: 'CNY',
  },
  {
    name: 'Chinese amount plus tax derives final total',
    text: '合计 ¥3968.95 ¥515.98 备注 5596645A',
    amount: 4484.93,
    currency: 'CNY',
  },
  {
    name: 'Chinese single total fallback',
    text: '项目名称 服务费 合计 ¥36.00 开票日期 2025年06月30日',
    amount: 36,
    currency: 'CNY',
  },
  {
    name: 'English total',
    text: 'Description: Subscription Total: $20.00 Date: 2024-03-15',
    amount: 20,
    currency: 'USD',
  },
  {
    name: 'Full-width Chinese amount',
    text: '价税合计（小写）￥４４８４．９３',
    amount: 4484.93,
    currency: 'CNY',
  },
  {
    name: 'Spaced Chinese final amount',
    text: '合计 ¥1 6. 9 9 ¥0. 1 7 价税合计（大写）壹拾柒圆壹角陆分（小写）¥1 7. 1 6',
    amount: 17.16,
    currency: 'CNY',
  },
  {
    name: 'English subtotal and tax interference',
    text: 'Subtotal $100.00 Tax $10.00 Total $110.00',
    amount: 110,
    currency: 'USD',
  },
  {
    name: 'English total tax interference',
    text: 'Total Tax $10.00 Grand Total $110.00',
    amount: 110,
    currency: 'USD',
  },
  {
    name: 'Chinese uppercase lowercase beats weak doubled sum',
    text: '合计 价税合计(大写) (小写) 柒拾圆零陆分 ¥70.06 项目明细 ¥70.06 ¥70.06',
    amount: 70.06,
    currency: 'CNY',
  },
  {
    name: 'Repeated Chinese final keyword uses later valid total',
    text: '价税合计 表头 项目名称 规格型号 单位 数量 单价 金额 税率 税额 *食品*点心 合计 ¥7.00 ¥0.42 价税合计(大写) 柒圆肆角贰分 (小写) ¥7.42',
    amount: 7.42,
    currency: 'CNY',
  },
]

for (const item of cases) {
  const result = findFinalInvoiceTotal(item.text)
  assert.ok(result, `${item.name}: expected a result`)
  assert.equal(result.amount, item.amount, `${item.name}: amount`)
  assert.equal(result.currency, item.currency, `${item.name}: currency`)
}

const corrected = validateFinalInvoiceAmount(cases[0].text, 150.12, 150.12)
assert.equal(corrected.status, 'corrected')
assert.equal(corrected.invoiceTotal, 4484.93)

const passed = validateFinalInvoiceAmount(cases[0].text, 4484.93, 4484.93)
assert.equal(passed.status, 'passed')
assert.equal(passed.invoiceTotal, 4484.93)

const conflict = validateFinalInvoiceAmount(
  '合计 ¥100.00 ¥13.00 价税合计(小写) ¥112.00',
  112,
  112
)
assert.equal(conflict.status, 'conflict')
assert.equal(conflict.invoiceTotal, 112)

const unverified = validateFinalInvoiceAmount('无金额文本', 99, 99)
assert.equal(unverified.status, 'unverified')
assert.equal(unverified.invoiceTotal, 0)

const weakDoubled = validateFinalInvoiceAmount(
  '合计 价税合计(大写) (小写) 柒拾圆零陆分 ¥70.06 项目明细 ¥70.06 ¥70.06',
  70.06,
  70.06
)
assert.equal(weakDoubled.status, 'passed')
assert.equal(weakDoubled.invoiceTotal, 70.06)

const emptyAiWithVerifiedAmount = normalizeExtractedItems(
  '电子发票 购买方 示例采购单位 销售方 示例电子商务有限公司 项目名称 规格型号 单位 数量 单价 金额 税率 税额 *食品*点心 合计 ¥7.00 ¥0.42 价税合计(大写) 柒圆肆角贰分 (小写) ¥7.42',
  { items: [] },
  { filename: '2-其他-7.42元-示例电子商务有限公司-2025.11.23-发票.pdf' }
)
assert.equal(emptyAiWithVerifiedAmount.length, 1)
assert.equal(emptyAiWithVerifiedAmount[0].subtotal, 7.42)
assert.equal(emptyAiWithVerifiedAmount[0].amountValidation.status, 'passed')

const emptyAiWithFilenameFallback = normalizeExtractedItems(
  '电子发票 购买方 示例采购单位 销售方 示例食品有限公司 项目名称 食品',
  { items: [] },
  { filename: '1-其他-11.90-示例食品有限公司-2025.11.23-发票.pdf' }
)
assert.equal(emptyAiWithFilenameFallback.length, 1)
assert.equal(emptyAiWithFilenameFallback[0].subtotal, 11.9)
assert.equal(emptyAiWithFilenameFallback[0].amountValidation.status, 'unverified')

console.log('invoice total validation passed')
