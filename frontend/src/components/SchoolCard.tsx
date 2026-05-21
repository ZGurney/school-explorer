import { Link } from 'react-router-dom'
import type { SchoolSummary } from '../api/types'
import { useCompareContext } from '../context/CompareContext'
import OfstedBadge from './OfstedBadge'

const GROUP_LABEL: Record<string, string> = {
  state: 'State', academy: 'Academy', free: 'Free School',
  grammar: 'Grammar', independent: 'Independent',
  sixth_form_college: 'Sixth Form College', utc: 'UTC',
  studio: 'Studio School', pru: 'PRU', state_special: 'Special',
}

function KeyMetric({ s }: { s: SchoolSummary }) {
  if (s.phase === 'Secondary' || s.phase === 'All-through') {
    return (
      <div className="card-stat">
        Attainment 8:{' '}
        {s.ks4_suppressed
          ? <span className="na">small cohort</span>
          : s.attainment_8 !== null
            ? <strong>{s.attainment_8.toFixed(1)}</strong>
            : <span className="na">n/a</span>}
        {s.pct_grade5_english_maths !== null && !s.ks4_suppressed && (
          <span style={{ marginLeft: 8 }}>Gr5+: <strong>{s.pct_grade5_english_maths.toFixed(0)}%</strong></span>
        )}
      </div>
    )
  }
  if (s.phase === 'Primary') {
    return (
      <div className="card-stat">
        Expected RWM:{' '}
        {s.ks2_suppressed
          ? <span className="na">small cohort</span>
          : s.pct_expected_rwm !== null
            ? <strong>{s.pct_expected_rwm.toFixed(0)}%</strong>
            : <span className="na">n/a</span>}
      </div>
    )
  }
  if (s.has_sixth_form || s.phase === '16 plus') {
    return (
      <div className="card-stat">
        A-level avg pts:{' '}
        {s.ks5_suppressed
          ? <span className="na">small cohort</span>
          : s.avg_points_per_alevel_entry !== null
            ? <strong>{s.avg_points_per_alevel_entry.toFixed(1)}</strong>
            : <span className="na">n/a</span>}
      </div>
    )
  }
  return null
}

export default function SchoolCard({ school: s }: { school: SchoolSummary }) {
  const { toggle, isSelected } = useCompareContext()
  const selected = isSelected(s.urn)

  return (
    <div className={`school-card${selected ? ' in-compare' : ''}`}>
      <div className="card-header">
        <Link to={`/schools/${s.urn}`} className="card-name">{s.name}</Link>
        <button
          className={`compare-toggle${selected ? ' active' : ''}`}
          onClick={() => toggle(s.urn, s.name)}
          title={selected ? 'Remove from comparison' : 'Add to comparison'}
        >{selected ? '✓' : '+'}</button>
      </div>

      <div className="card-meta">
        {s.la_name && <span>{s.la_name}</span>}
        {s.phase && <><span className="card-meta-dot">·</span><span>{s.phase}</span></>}
        {s.establishment_group && <><span className="card-meta-dot">·</span><span>{GROUP_LABEL[s.establishment_group] ?? s.establishment_group}</span></>}
        {s.total_pupils !== null && <><span className="card-meta-dot">·</span><span>{s.total_pupils.toLocaleString()} pupils</span></>}
      </div>

      <div className="card-badges">
        <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} leadership={s.ofsted_leadership} quality={s.ofsted_quality} />
        {s.is_selective && <span className="badge badge-selective">Selective</span>}
        {s.has_sixth_form && <span className="badge badge-sixth">6th form</span>}
      </div>

      <KeyMetric s={s} />
    </div>
  )
}
