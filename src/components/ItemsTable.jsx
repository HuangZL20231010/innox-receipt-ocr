import CurrencySelect from './CurrencySelect.jsx'
import { symbolOf, isForeign, formatRateText } from '../lib/currency.js'

const NUMERIC_FIELDS = new Set(['qty', 'unitPrice', 'subtotal', 'exchangeRate'])

export default function ItemsTable({ items, onUpdate, onDelete, onAdd, onCurrencyChange, onDateChange }) {
  const totalCNY = items.reduce(
    (sum, it) => sum + (Number(it.subtotal) || 0) * (Number(it.exchangeRate) || 1),
    0
  )

  function setField(id, field, raw) {
    let value = raw
    if (NUMERIC_FIELDS.has(field)) {
      const n = parseFloat(raw)
      value = isNaN(n) ? 0 : n
    }
    onUpdate(id, field, value)
    // 用户手改汇率 → 同步更新 其他 列
    if (field === 'exchangeRate') {
      const item = items.find((x) => x.id === id)
      if (item && isForeign(item.currency)) {
        onUpdate(id, 'other', formatRateText(item.currency, value, item.invoiceDate))
      }
    }
  }

  function isMismatch(it) {
    const calc = Number(it.qty) * Number(it.unitPrice)
    return (
      Math.abs(calc - Number(it.subtotal)) > 0.01 &&
      Number(it.qty) > 0 &&
      Number(it.unitPrice) > 0
    )
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-gray-800">
          <span className="mr-2">📊</span>
          采购明细
          <span className="ml-2 text-sm font-normal text-gray-500">（识别后可手动修改）</span>
        </h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm text-primary-600 border border-primary-500 rounded hover:bg-primary-50"
        >
          + 新增一行
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="px-2 py-2 border border-gray-200 w-12">序号</th>
              <th className="px-2 py-2 border border-gray-200">货物/服务名称</th>
              <th className="px-2 py-2 border border-gray-200">型号参数</th>
              <th className="px-2 py-2 border border-gray-200 w-12">数量</th>
              <th className="px-2 py-2 border border-gray-200 w-28">单价</th>
              <th className="px-2 py-2 border border-gray-200 w-20">金额小计</th>
              <th className="px-2 py-2 border border-gray-200 min-w-[180px]">其他</th>
              <th className="px-2 py-2 border border-gray-200 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 border border-gray-200">
                  暂无明细，请上传 PDF 发票或点击"新增一行"
                </td>
              </tr>
            )}
            {items.map((it, idx) => {
              const warn = isMismatch(it)
              const foreign = isForeign(it.currency)
              const sym = symbolOf(it.currency || 'CNY')
              const cnySubtotal = Number(it.subtotal) * (Number(it.exchangeRate) || 1)

              return (
                <tr key={it.id} className={warn ? 'bg-yellow-50' : ''}>
                  <td className="border border-gray-200 px-2 text-center text-gray-500 align-top pt-2">
                    {idx + 1}
                  </td>
                  <td className="border border-gray-200 align-top">
                    <input
                      value={it.name}
                      onChange={(e) => setField(it.id, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50"
                    />
                  </td>
                  <td className="border border-gray-200 align-top">
                    <input
                      value={it.model}
                      onChange={(e) => setField(it.id, 'model', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50"
                    />
                  </td>
                  <td className="border border-gray-200 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={it.qty}
                      onChange={(e) => setField(it.id, 'qty', e.target.value)}
                      className="w-10 px-1 py-1.5 outline-none focus:bg-primary-50 text-right"
                    />
                  </td>

                  {/* 单价 */}
                  <td className="border border-gray-200 align-top">
                    <div className="flex items-center justify-end gap-0.5 px-1 py-1">
                      <CurrencySelect
                        value={it.currency}
                        onChange={(c) => onCurrencyChange(it.id, c)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => setField(it.id, 'unitPrice', e.target.value)}
                        className="w-16 px-1 py-0.5 outline-none focus:bg-primary-50 text-right"
                      />
                    </div>
                    {foreign && (
                      <div className="px-1.5 pb-1 text-[11px] text-gray-400 text-right">
                        ≈ ¥{(Number(it.unitPrice) * (Number(it.exchangeRate) || 1)).toFixed(2)}
                      </div>
                    )}
                  </td>

                  {/* 小计 */}
                  <td className="border border-gray-200 align-top">
                    <div className="flex items-center justify-end gap-0.5 px-1 py-1">
                      <span className="text-gray-400 text-xs shrink-0">{sym}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.subtotal}
                        onChange={(e) => setField(it.id, 'subtotal', e.target.value)}
                        className={`w-16 px-1 py-0.5 outline-none focus:bg-primary-50 text-right ${
                          warn ? 'text-orange-600 font-medium' : ''
                        }`}
                        title={warn ? '注意：单价 × 数量 ≠ 小计' : ''}
                      />
                    </div>
                    {foreign && (
                      <div className="px-1.5 pb-1 text-[11px] text-primary-600 text-right">
                        ≈ ¥{cnySubtotal.toFixed(2)}
                      </div>
                    )}
                  </td>

                  {/* 其他 */}
                  <td className="border border-gray-200 align-top">
                    <input
                      value={it.other}
                      onChange={(e) => setField(it.id, 'other', e.target.value)}
                      placeholder={foreign ? '汇率信息（自动生成，可改）' : ''}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50 text-xs"
                    />
                    {foreign && (
                      <div className="px-2 pb-1.5 pt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        <label className="flex items-center gap-1">
                          <span>日期</span>
                          <input
                            type="date"
                            value={it.invoiceDate || ''}
                            onChange={(e) => onDateChange(it.id, e.target.value)}
                            className="px-1 py-0.5 border border-gray-200 rounded text-xs"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          <span>汇率</span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={it.exchangeRate}
                            onChange={(e) => setField(it.id, 'exchangeRate', e.target.value)}
                            className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs text-right"
                          />
                        </label>
                      </div>
                    )}
                  </td>

                  <td className="border border-gray-200 text-center align-top pt-2">
                    <button
                      onClick={() => onDelete(it.id)}
                      className="px-2 py-1 text-gray-400 hover:text-red-500"
                      title="删除此行"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={5} className="border border-gray-200 px-3 py-2 text-right">
                  金额合计（人民币）
                </td>
                <td className="border border-gray-200 px-3 py-2 text-right text-primary-700">
                  RMB {totalCNY.toFixed(2)}
                </td>
                <td colSpan={2} className="border border-gray-200"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
