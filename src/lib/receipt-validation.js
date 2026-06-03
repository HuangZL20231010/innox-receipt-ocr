export function getUnsafeInvoiceItemIndex(items) {
  return items.findIndex((item) => {
    if (!item.sourceId) return false
    if (!['passed', 'corrected'].includes(item.amountValidation?.status)) return true
    if (Number(item.invoiceTotal) > 0) {
      return Math.abs(Number(item.subtotal) - Number(item.invoiceTotal)) > 0.01
    }
    return true
  })
}

export function assertSafeItemsForDocx(items) {
  const badIndex = getUnsafeInvoiceItemIndex(items)

  if (badIndex >= 0) {
    throw new Error(`第 ${badIndex + 1} 行发票金额未通过校验，不能生成验收单`)
  }
}
