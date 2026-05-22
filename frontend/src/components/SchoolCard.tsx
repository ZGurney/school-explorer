import { Link } from 'react-router-dom'
import { Heart, MapPin } from 'lucide-react'
import type { SchoolSummary } from '../api/types'
import { useCompareContext } from '../context/CompareContext'
import { useShortlistContext } from '../context/ShortlistContext'
import { useBenchmarks } from '../hooks/useSchools'
import { GLOSSARY } from '../utils/glossary'
import { effectiveOfstedGrade, ofstedBandClass } from './OfstedBadge'
import OfstedBadge from './OfstedBadge'
import Tooltip from './Tooltip'

const GROUP_LABEL: Record<string, string> = {
  state: 'State', academy: 'Academy', free: 'Free School',
  grammar: 'Grammar', independent: 'Independent',
  sixth_form_college: 'Sixth Form College', utc: 'UTC',
  studio: 'Studio School', pru: 'Alternative provision', state_special: 'Special school',
  other: 'Other',
}

function BenchmarkNote({ value, avg }: { value: number | null | undefined; avg: number | null | undefined }) {
  if (value == null || avg == null) return null
  const diff = value - avg
  if (Math.abs(diff) < 0.5) return <div className="card-benchmark avg">≈ London avg</div>
  return diff > 0
    ? <div className="card-benchmark up">↑ Above London avg</div>
    : <div className="card-benchmark down">↓ Below London avg</div>
}

function KeyMetric({ s }: { s: SchoolSummary }) {
  const { data: benchmarks } = useBenchmarks()

  if (s.phase === 'Secondary' || s.phase === 'All-through') {
    const v = s.attainment_8
    return (
      <div className="card-metric">
        <div className="card-metric-label">
          <Tooltip text={GLOSSARY['Attainment 8']}>GCSE avg score</Tooltip>
        </div>
        {s.ks4_suppressed
          ? <div className="card-metric-value na">small cohort</div>
          : v != null
            ? <div className="card-metric-value">{v.toFixed(1)}</div>
            : <div className="card-metric-value na">n/a</div>}
        {!s.ks4_suppressed && <BenchmarkNote value={v} avg={benchmarks?.ks4_attainment_8} />}
      </div>
    )
  }

  if (s.phase === 'Primary') {
    const v = s.pct_expected_rwm
    return (
      <div className="card-metric">
        <div className="card-metric-label">
          <Tooltip text={GLOSSARY.RWM}>Reading, writing & maths</Tooltip>
        </div>
        {s.ks2_suppressed
          ? <div className="card-metric-value na">small cohort</div>
          : v != null
            ? <div className="card-metric-value">{v.toFixed(0)}%</div>
            : <div className="card-metric-value na">n/a</div>}
        {!s.ks2_suppressed && <BenchmarkNote value={v} avg={benchmarks?.ks2_pct_expected_rwm} />}
      </div>
    )
  }

  if (s.has_sixth_form || s.phase === '16 plus') {
    const v = s.avg_points_per_alevel_entry
    return (
      <div className="card-metric">
        <div className="card-metric-label">A-level avg pts</div>
        {s.ks5_suppressed
          ? <div className="card-metric-value na">small cohort</div>
          : v != null
            ? <div className="card-metric-value">{v.toFixed(1)}</div>
            : <div className="card-metric-value na">n/a</div>}
        {!s.ks5_suppressed && <BenchmarkNote value={v} avg={benchmarks?.ks5_avg_points} />}
      </div>
    )
  }

  return null
}

interface Props {
  school: SchoolSummary
  mapSelected?: boolean
  onMapFocus?: (school: SchoolSummary) => void
}

export default function SchoolCard({ school: s, mapSelected = false, onMapFocus }: Props) {
  const { toggle, isSelected } = useCompareContext()
  const shortlist = useShortlistContext()
  const selected = isSelected(s.urn)
  const saved = shortlist.isSaved(s.urn)

  return (
    <div
      className={`school-card${selected ? ' in-compare' : ''}${mapSelected ? ' map-selected' : ''}`}
      onClick={e => {
        if (!onMapFocus) return
        const target = e.target as HTMLElement
        if (target.closest('a, button, input, select')) return
        onMapFocus(s)
      }}
    >
      {/* Iconic Ofsted quality band — falls back to sub-grades for the new framework */}
      <div className={`card-band ${ofstedBandClass(effectiveOfstedGrade(s.ofsted_overall, s.ofsted_quality, s.ofsted_leadership))}`} aria-hidden="true" />

      <div className="card-body">
        <div className="card-header">
          <Link to={`/schools/${s.urn}`} className="card-name">{s.name}</Link>
          <div className="card-actions">
            <button
              className={`btn-icon${saved ? ' saved' : ''}`}
              onClick={() => shortlist.toggle(s.urn, s.name)}
              aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
            >
              <Heart size={12} fill={saved ? 'currentColor' : 'none'} strokeWidth={2.5} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              className={`btn-icon${selected ? ' compared' : ''}`}
              onClick={() => toggle(s.urn, s.name)}
              aria-label={selected ? 'Remove from comparison' : 'Add to comparison'}
            >
              {selected ? '✓' : '+'} Compare
            </button>
            {onMapFocus && (
              <button
                className="btn-icon"
                onClick={() => onMapFocus(s)}
                aria-label={`Show ${s.name} on map`}
              >
                <MapPin size={12} strokeWidth={2.5} /> Map
              </button>
            )}
          </div>
        </div>

        <div className="card-meta">
          {s.la_name && <span>{s.la_name}</span>}
          {s.phase && <><span className="card-meta-dot">·</span><span>{s.phase}</span></>}
          {s.establishment_group && <><span className="card-meta-dot">·</span><span>{GROUP_LABEL[s.establishment_group] ?? s.establishment_group}</span></>}
          {s.total_pupils != null && <><span className="card-meta-dot">·</span><span>{s.total_pupils.toLocaleString()} pupils</span></>}
          {s.distance_km != null && <><span className="card-meta-dot">·</span><span>{s.distance_km.toFixed(1)} km</span></>}
        </div>

        <div className="card-footer">
          <div className="card-badges">
            <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} leadership={s.ofsted_leadership} quality={s.ofsted_quality} />
            {s.is_selective && <span className="badge badge--selective">Selective</span>}
            {s.has_sixth_form && <span className="badge badge--sixth">6th form</span>}
          </div>
          <KeyMetric s={s} />
        </div>
      </div>
    </div>
  )
}
