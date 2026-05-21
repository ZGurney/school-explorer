interface Props {
  value: number | string | boolean | null | undefined
  suppressed?: boolean | null
  suffix?: string
  decimals?: number
}

export default function StatValue({ value, suppressed, suffix = '', decimals = 1 }: Props) {
  if (suppressed) return <span style={{ color: '#6b7280' }}>N/A — small cohort</span>
  if (value === null || value === undefined) return <span style={{ color: '#9ca3af' }}>Not available</span>
  if (typeof value === 'number') return <>{value.toFixed(decimals)}{suffix}</>
  return <>{String(value)}{suffix}</>
}
