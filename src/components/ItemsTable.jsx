const NUMERIC_FIELDS = new Set(['qty', 'unitPrice', 'subtotal'])

export default function ItemsTable({ items, onUpdate, onDelete, onAdd }) {
  const total = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0)

  function setField(id, field, raw) {
    let value = raw
    if (NUMERIC_FIELDS.has(field)) {
      const n = parseFloat(raw)
      value = isNaN(n) ? 0 : n
    }
    onUpdate(id, field, value)
  }

  function isMismatch(it) {
    const calc = Number(it.qty) * Number(it.unitPrice)
    return Math.abs(calc - Number(it.subtotal)) > 0.01 && Number(it.qty) > 0 && Number(it.unitPrice) > 0
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
              <th className="px-2 py-2 border border-gray-200 w-16">数量</th>
              <th className="px-2 py-2 border border-gray-200 w-24">单价</th>
              <th className="px-2 py-2 border border-gray-200 w-24">金额小计</th>
              <th className="px-2 py-2 border border-gray-200">其他</th>
              <th className="px-2 py-2 border border-gray-200 w-14"></th>
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
              return (
                <tr key={it.id} className={warn ? 'bg-yellow-50' : ''}>
                  <td className="border border-gray-200 px-2 text-center text-gray-500">{idx + 1}</td>
                  <td className="border border-gray-200">
                    <input
                      value={it.name}
                      onChange={(e) => setField(it.id, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50"
                    />
                  </td>
                  <td className="border border-gray-200">
                    <input
                      value={it.model}
                      onChange={(e) => setField(it.id, 'model', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50"
                    />
                  </td>
                  <td className="border border-gray-200">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={it.qty}
                      onChange={(e) => setField(it.id, 'qty', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50 text-right"
                    />
                  </td>
                  <td className="border border-gray-200">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) => setField(it.id, 'unitPrice', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50 text-right"
                    />
                  </td>
                  <td className="border border-gray-200">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.subtotal}
                      onChange={(e) => setField(it.id, 'subtotal', e.target.value)}
                      className={`w-full px-2 py-1.5 outline-none focus:bg-primary-50 text-right ${warn ? 'text-orange-600 font-medium' : ''}`}
                      title={warn ? '注意：单价 × 数量 ≠ 小计' : ''}
                    />
                  </td>
                  <td className="border border-gray-200">
                    <input
                      value={it.other}
                      onChange={(e) => setField(it.id, 'other', e.target.value)}
                      className="w-full px-2 py-1.5 outline-none focus:bg-primary-50"
                    />
                  </td>
                  <td className="border border-gray-200 text-center">
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
                  金额合计
                </td>
                <td className="border border-gray-200 px-3 py-2 text-right text-primary-700">
                  RMB {total.toFixed(2)}
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
