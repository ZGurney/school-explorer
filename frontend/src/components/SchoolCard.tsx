import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import type { SchoolSummary } from '../api/types'
import { useCompareContext } from '../context/CompareContext'
import { useShortlistContext } from '../context/ShortlistContext'
import { GLOSSARY } from '../utils/glossary'
import OfstedBadge from './OfstedBadge'
import Tooltip from './Tooltip'

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
        <Tooltip text={GLOSSARY['Attainment 8']}>Attainment 8</Tooltip>:{' '}
        {s.ks4_suppressed
          ? <span className="na">small cohort</span>
          : s.attainment_8 !== null
            ? <strong>{s.attainment_8.toFixed(1)}</strong>
            : <span className="na">n/a</span>}
        {s.pct_grade5_english_maths !== null && !s.ks4_suppressed && (
          <span style={{ marginLeft: 8 }}><Tooltip text={GLOSSARY['Grade 5+ E&M']}>Gr5+</Tooltip>: <strong>{s.pct_grade5_english_maths.toFixed(0)}%</strong></span>
        )}
      </div>
    )
  }
  if (s.phase === 'Primary') {
    return (
      <div className="card-stat">
        <Tooltip text={GLOSSARY.RWM}>Expected RWM</Tooltip>:{' '}
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
  const shortlist = useShortlistContext()
  const selected = isSelected(s.urn)
  const saved = shortlist.isSaved(s.urn)

  return (
    <div className={`school-card${selected ? ' in-compare' : ''}`}>
      <div className="card-header">
        <Link to={`/schools/${s.urn}`} className="card-name">{s.name}</Link>
        <div className="card-actions">
          <button
            className={`shortlist-toggle${saved ? ' active' : ''}`}
            onClick={() => shortlist.toggle(s.urn, s.name)}
            aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
            title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
          >
            <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`compare-toggle${selected ? ' active' : ''}`}
            onClick={() => toggle(s.urn, s.name)}
            aria-label={selected ? 'Remove from comparison' : 'Add to comparison'}
            title={selected ? 'Remove from comparison' : 'Add to comparison'}
          >
            <span className="compare-symbol">{selected ? '✓' : '+'}</span>
            <span className="compare-label">Compare</span>
          </button>
        </div>
      </div>

      <div className="card-meta">
        {s.la_name && <span>{s.la_name}</span>}
        {s.phase && <><span className="card-meta-dot">·</span><span>{s.phase}</span></>}
        {s.establishment_group && <><span className="card-meta-dot">·</span><span>{GROUP_LABEL[s.establishment_group] ?? s.establishment_group}</span></>}
        {s.total_pupils !== null && <><span className="card-meta-dot">·</span><span>{s.total_pupils.toLocaleString()} pupils</span></>}
        {s.distance_km !== null && s.distance_km !== undefined && <><span className="card-meta-dot">·</span><span>{s.distance_km.toFixed(1)} km away</span></>}
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
