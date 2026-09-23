import assert from 'node:assert/strict'
import {
  assertSafeItemsForDocx,
  getUnsafeInvoiceItemIndex,
} from '../src/lib/receipt-validation.js'

const baseItem = {
  id: 'item-1',
  sourceId: 'pdf-1',
  name: '测试货物',
  model: '',
  qty: 1,
  unitPrice: 100,
  subtotal: 100,
  invoiceTotal: 100,
  currency: 'CNY',
  exchangeRate: 1,
}

assert.equal(
  getUnsafeInvoiceItemIndex([{ ...baseItem, amountValidation: { status: 'passed' } }]),
  -1
)

assert.equal(
  getUnsafeInvoiceItemIndex([{ ...baseItem, amountValidation: { status: 'corrected' } }]),
  -1
)

assert.equal(
  getUnsafeInvoiceItemIndex([{ ...baseItem, amountValidation: { status: 'manual-confirmed' } }]),
  -1
)

for (const status of ['conflict', 'unverified', undefined]) {
  const item = status
    ? { ...baseItem, amountValidation: { status } }
    : { ...baseItem, amountValidation: undefined }
  assert.equal(getUnsafeInvoiceItemIndex([item]), 0, `status ${status || 'missing'} should block`)
  assert.throws(() => assertSafeItemsForDocx([item]), /发票金额未通过校验/)
}

const mismatch = {
  ...baseItem,
  subtotal: 99.99,
  amountValidation: { status: 'passed' },
}
assert.equal(getUnsafeInvoiceItemIndex([mismatch]), 0)
assert.throws(() => assertSafeItemsForDocx([mismatch]), /发票金额未通过校验/)

const manualItem = {
  ...baseItem,
  sourceId: '',
  amountValidation: undefined,
}
assert.equal(getUnsafeInvoiceItemIndex([manualItem]), -1)

console.log('receipt generation guard validation passed')
