interface Props {
  overall: string | null
  date: string | null
  leadership?: string | null
  quality?: string | null
  size?: 'sm' | 'md'
}

const GRADE_CLASS: Record<string, string> = {
  Outstanding: 'badge badge-outstanding',
  Good: 'badge badge-good',
  'Requires improvement': 'badge badge-ri',
  Inadequate: 'badge badge-inadequate',
}

export default function OfstedBadge({ overall, date, leadership, quality }: Props) {
  if (!overall && !leadership && !quality && !date) {
    return <span className="badge badge-uninspected">Not inspected</span>
  }

  if (!overall) {
    return (
      <span
        className="badge badge-new"
        title="Ofsted's newer framework grades specific areas rather than always giving one overall rating."
      >
        New Ofsted framework
      </span>
    )
  }

  const cls = GRADE_CLASS[overall] ?? 'badge badge-new'
  return <span className={cls}>{overall}</span>
}
