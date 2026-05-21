import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SchoolFilters, SchoolSummary } from '../api/types'
import OfstedBadge from '../components/OfstedBadge'
import { useCompareContext } from '../context/CompareContext'
import { useBoroughs, useSchools } from '../hooks/useSchools'

const PHASES = [
  { value: '', label: 'All phases' },
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'All-through', label: 'All-through' },
  { value: '16 plus', label: '16+' },
]

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'state', label: 'State' },
  { value: 'academy', label: 'Academy' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'independent', label: 'Independent' },
]

interface Metric {
  key: string
  label: string
  shortLabel: string
  phases: string[]  // empty = all
  render: (s: SchoolSummary) => React.ReactNode
}

const METRICS: Metric[] = [
  {
    key: 'ofsted_overall',
    label: 'Ofsted rating',
    shortLabel: 'Ofsted',
    phases: [],
    render: s => <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} leadership={s.ofsted_leadership} quality={s.ofsted_quality} />,
  },
  {
    key: 'attainment_8',
    label: 'Attainment 8',
    shortLabel: 'Attainment 8',
    phases: ['Secondary', 'All-through'],
    render: s => s.ks4_suppressed
      ? <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>suppressed</span>
      : s.attainment_8 !== null
        ? <strong>{s.attainment_8.toFixed(1)}</strong>
        : <span style={{ color: 'var(--gray-400)' }}>—</span>,
  },
  {
    key: 'pct_grade5_english_maths',
    label: 'Grade 5+ English & Maths',
    shortLabel: 'Gr5+ E&M',
    phases: ['Secondary', 'All-through'],
    render: s => s.ks4_suppressed
      ? <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>suppressed</span>
      : s.pct_grade5_english_maths !== null
        ? <strong>{s.pct_grade5_english_maths.toFixed(1)}%</strong>
        : <span style={{ color: 'var(--gray-400)' }}>—</span>,
  },
  {
    key: 'pct_expected_rwm',
    label: 'Expected standard RWM',
    shortLabel: '% Exp RWM',
    phases: ['Primary'],
    render: s => s.ks2_suppressed
      ? <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>suppressed</span>
      : s.pct_expected_rwm !== null
        ? <strong>{s.pct_expected_rwm.toFixed(0)}%</strong>
        : <span style={{ color: 'var(--gray-400)' }}>—</span>,
  },
  {
    key: 'avg_points_per_alevel_entry',
    label: 'Avg A-level points',
    shortLabel: 'A-level pts',
    phases: ['16 plus'],
    render: s => s.ks5_suppressed
      ? <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>suppressed</span>
      : s.avg_points_per_alevel_entry !== null
        ? <strong>{s.avg_points_per_alevel_entry.toFixed(1)}</strong>
        : <span style={{ color: 'var(--gray-400)' }}>—</span>,
  },
]

const OFSTED_ORDER = ['Outstanding', 'Good', 'Requires improvement', 'Inadequate']

function SummaryStats({ data }: { data: { total: number; results: SchoolSummary[] } | undefined }) {
  if (!data) return null

  const counts: Record<string, number> = {}
  for (const s of data.results) {
    // Use the best available grade signal
    const grade = s.ofsted_overall ?? s.ofsted_leadership ?? s.ofsted_quality ?? null
    const k = grade ?? (s.ofsted_date ? 'Inspected (new)' : 'Not inspected')
    counts[k] = (counts[k] ?? 0) + 1
  }

  const chips = [
    { label: 'Outstanding', color: '#166534', bg: '#dcfce7' },
    { label: 'Good', color: 'var(--blue-800)', bg: 'var(--blue-100)' },
    { label: 'Requires improvement', label_short: 'Req. impr.', color: '#92400e', bg: '#fef3c7' },
    { label: 'Inadequate', color: '#991b1b', bg: '#fee2e2' },
    { label: 'Inspected (new)', label_short: 'New framework', color: 'var(--gray-500)', bg: 'var(--gray-100)' },
    { label: 'Not inspected', color: 'var(--gray-400)', bg: 'var(--gray-100)' },
  ].filter(c => counts[c.label])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#fff', border: '1px solid var(--gray-200)',
        borderRadius: 20, padding: '5px 14px', fontSize: 13,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{data.total.toLocaleString()}</span>
        <span style={{ color: 'var(--gray-500)' }}>schools</span>
      </div>
      {chips.map(c => (
        <div key={c.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: c.bg, borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600,
          color: c.color,
        }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{counts[c.label]}</span>
          {'label_short' in c ? c.label_short : c.label}
        </div>
      ))}
    </div>
  )
}

const GROUP_LABEL: Record<string, string> = {
  state: 'State', academy: 'Academy', free: 'Free School',
  grammar: 'Grammar', independent: 'Independent',
  sixth_form_college: 'Sixth Form College', utc: 'UTC', pru: 'PRU',
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<SchoolFilters>({
    page: 1, page_size: 50, sort_by: 'ofsted_overall',
  })
  const [activeMetric, setActiveMetric] = useState<string>('ofsted_overall')

  const { data, isLoading } = useSchools(filters)
  const { data: boroughs } = useBoroughs()
  const { toggle, isSelected } = useCompareContext()

  const update = useCallback((patch: Partial<SchoolFilters>) => {
    setFilters(f => ({ ...f, ...patch, page: 1 }))
  }, [])

  const selectMetric = (key: string) => {
    setActiveMetric(key)
    update({ sort_by: key })
    // Auto-set phase filter for phase-specific metrics
    const m = METRICS.find(m => m.key === key)
    if (m && m.phases.length === 1) {
      update({ sort_by: key, phase: m.phases[0] })
    } else if (m && m.phases.length === 0) {
      update({ sort_by: key })
    }
  }

  const metric = METRICS.find(m => m.key === activeMetric) ?? METRICS[0]

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px' }}>School Rankings</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Rank and filter all London schools by academic performance or Ofsted rating.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
        padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <div className="filter-label" style={{ marginBottom: 4 }}>Borough</div>
          <select value={filters.borough ?? ''} onChange={e => update({ borough: e.target.value || undefined })} className="filter-select" style={{ width: 170 }}>
            <option value="">All boroughs</option>
            {boroughs?.map(b => <option key={b.la_code} value={b.la_code}>{b.la_name}</option>)}
          </select>
        </div>
        <div>
          <div className="filter-label" style={{ marginBottom: 4 }}>Phase</div>
          <select value={filters.phase ?? ''} onChange={e => update({ phase: e.target.value || undefined })} className="filter-select" style={{ width: 140 }}>
            {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div className="filter-label" style={{ marginBottom: 4 }}>Type</div>
          <select value={filters.establishment_group ?? ''} onChange={e => update({ establishment_group: e.target.value || undefined })} className="filter-select" style={{ width: 140 }}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, paddingBottom: 1 }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.has_sixth_form === true} onChange={e => update({ has_sixth_form: e.target.checked ? true : undefined })} />
            6th form
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.is_selective === true} onChange={e => update({ is_selective: e.target.checked ? true : undefined })} />
            Selective
          </label>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setFilters({ page: 1, page_size: 50, sort_by: activeMetric }) }}
        >
          Clear
        </button>
      </div>

      {/* Metric tabs */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', alignSelf: 'center', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rank by</span>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => selectMetric(m.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              borderColor: activeMetric === m.key ? 'var(--blue-600)' : 'var(--gray-200)',
              background: activeMetric === m.key ? 'var(--blue-700)' : '#fff',
              color: activeMetric === m.key ? '#fff' : 'var(--gray-700)',
              transition: 'all .15s',
            }}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <SummaryStats data={data} />

      {/* Rankings table */}
      {isLoading && <div className="loading">Loading…</div>}

      {data && data.results.length === 0 && (
        <div className="empty-state"><p>No schools match the current filters.</p></div>
      )}

      {data && data.results.length > 0 && (
        <>
          <div style={{
            background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'center', width: 48, fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>School</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Borough · Phase · Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {metric.label}
                  </th>
                  {activeMetric !== 'ofsted_overall' && (
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Ofsted</th>
                  )}
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', width: 60 }}>Cmp</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((s, i) => {
                  const rank = (filters.page ?? 1) === 1 ? i + 1 : ((filters.page ?? 1) - 1) * (filters.page_size ?? 50) + i + 1
                  const selected = isSelected(s.urn)
                  return (
                    <tr
                      key={s.urn}
                      style={{
                        borderBottom: '1px solid var(--gray-100)',
                        background: selected ? 'var(--blue-50)' : rank <= 3 ? '#fffbeb' : 'transparent',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (!selected && rank > 3) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--gray-50)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected ? 'var(--blue-50)' : rank <= 3 ? '#fffbeb' : 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {rank <= 3
                          ? <span style={{ fontSize: 16 }}>{['🥇','🥈','🥉'][rank - 1]}</span>
                          : <span style={{ fontSize: 13, color: 'var(--gray-400)', fontWeight: 600 }}>{rank}</span>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/schools/${s.urn}`} style={{ fontWeight: 600, fontSize: 14, color: 'var(--blue-700)' }}>
                          {s.name}
                        </Link>
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          {s.is_selective && <span className="badge badge-selective" style={{ fontSize: 10 }}>Selective</span>}
                          {s.has_sixth_form && <span className="badge badge-sixth" style={{ fontSize: 10 }}>6th form</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {s.la_name}
                        {s.phase && <span style={{ color: 'var(--gray-300)', margin: '0 4px' }}>·</span>}
                        {s.phase}
                        {s.establishment_group && <span style={{ color: 'var(--gray-300)', margin: '0 4px' }}>·</span>}
                        {s.establishment_group ? (GROUP_LABEL[s.establishment_group] ?? s.establishment_group) : ''}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {metric.render(s)}
                      </td>
                      {activeMetric !== 'ofsted_overall' && (
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} leadership={s.ofsted_leadership} quality={s.ofsted_quality} />
                        </td>
                      )}
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => toggle(s.urn, s.name)}
                          className={`compare-toggle${selected ? ' active' : ''}`}
                          title={selected ? 'Remove from comparison' : 'Add to comparison'}
                          style={{ margin: '0 auto' }}
                        >{selected ? '✓' : '+'}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.total > (filters.page_size ?? 50) && (
            <div className="pagination">
              <button className="btn btn-ghost btn-sm" disabled={(filters.page ?? 1) === 1}
                onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>← Prev</button>
              <span className="pagination-info">
                Page {filters.page ?? 1} of {Math.ceil(data.total / (filters.page_size ?? 50))}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={(filters.page ?? 1) * (filters.page_size ?? 50) >= data.total}
                onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>Next →</button>
            </div>
          )}
          <p style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 12, marginTop: 12 }}>
            Showing {Math.min((filters.page_size ?? 50), data.results.length)} of {data.total.toLocaleString()} schools · Schools without data for this metric appear at the bottom
          </p>
        </>
      )}
    </div>
  )
}
