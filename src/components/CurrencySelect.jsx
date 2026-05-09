import { CURRENCIES } from '../lib/currency.js'

export default function CurrencySelect({ value, onChange, className = '' }) {
  return (
    <select
      value={value || 'CNY'}
      onChange={(e) => onChange(e.target.value)}
      className={`px-0.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white hover:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500 ${className}`}
      title="货币"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code}
        </option>
      ))}
    </select>
  )
}
