/* ── Ofsted colour utilities ─────────────────────────────────
   These are the single source of truth for mapping an Ofsted
   rating string to the design system's quality colour tokens.
   Import these wherever you need to apply Ofsted colour:
     - card bands (.card-band class)
     - detail page hero background (inline style)
     - badges
   ──────────────────────────────────────────────────────────── */

/**
 * Resolve the effective Ofsted grade for display purposes.
 * The new inspection framework may give sub-grades without an overall —
 * in that case we use quality of education as the primary signal, then leadership.
 */
export function effectiveOfstedGrade(
  overall: string | null | undefined,
  quality?: string | null,
  leadership?: string | null,
): string | null {
  return overall ?? quality ?? leadership ?? null
}

/** Returns the CSS band class for the left-edge card strip */
export function ofstedBandClass(grade: string | null | undefined): string {
  if (grade === 'Outstanding')            return 'band--outstanding'
  if (grade === 'Good')                   return 'band--good'
  if (grade === 'Requires improvement')   return 'band--ri'
  if (grade === 'Inadequate')             return 'band--inadequate'
  return 'band--uninspected'
}

/** Returns the raw CSS colour value for inline styles (e.g. detail hero bg) */
export function ofstedCssColor(grade: string | null | undefined): string {
  if (grade === 'Outstanding')            return 'var(--outstanding)'
  if (grade === 'Good')                   return 'var(--good)'
  if (grade === 'Requires improvement')   return 'var(--ri)'
  if (grade === 'Inadequate')             return 'var(--inadequate)'
  return 'var(--ink)'
}

/** Returns the badge class for inline Ofsted rating chips */
function ofstedBadgeClass(overall: string | null | undefined): string {
  if (overall === 'Outstanding')          return 'badge badge--outstanding'
  if (overall === 'Good')                 return 'badge badge--good'
  if (overall === 'Requires improvement') return 'badge badge--ri'
  if (overall === 'Inadequate')           return 'badge badge--inadequate'
  return 'badge badge--uninspected'
}

interface Props {
  overall: string | null
  date: string | null
  leadership?: string | null
  quality?: string | null
}

export default function OfstedBadge({ overall, date, leadership, quality }: Props) {
  if (!overall && !leadership && !quality && !date) {
    return <span className="badge badge--uninspected">Not inspected</span>
  }

  if (!overall) {
    return (
      <span
        className="badge badge--new"
        title="Ofsted's newer framework grades specific areas rather than always giving one overall rating."
      >
        New Ofsted framework
      </span>
    )
  }

  return <span className={ofstedBadgeClass(overall)}>{overall}</span>
}
