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
  // Use the best available rating signal
  const effectiveGrade = overall ?? leadership ?? quality ?? null

  if (!effectiveGrade && !date) {
    return <span className="badge badge-uninspected">Not inspected</span>
  }

  if (!effectiveGrade) {
    return <span className="badge badge-new">Inspected (new framework)</span>
  }

  const cls = GRADE_CLASS[effectiveGrade] ?? 'badge badge-new'
  const label = overall ? effectiveGrade : `${effectiveGrade} (leadership)`
  return <span className={cls}>{label}</span>
}
