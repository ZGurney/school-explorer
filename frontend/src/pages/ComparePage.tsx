import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { BenchmarkSummary, SchoolFilters } from '../api/types'
import StatValue from '../components/StatValue'
import Tooltip from '../components/Tooltip'
import { useCompareContext } from '../context/CompareContext'
import { useBenchmarks, useCompare, useSchools } from '../hooks/useSchools'
import { GLOSSARY } from '../utils/glossary'

function SearchModal({ onAdd, onClose, existingUrns }: {
  onAdd: (urn: number, name: string) => void
  onClose: () => void
  existingUrns: number[]
}) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [filters] = useState<SchoolFilters>({ page: 1, page_size: 10 })

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 350)
    return () => clearTimeout(id)
  }, [q])

  const { data } = useSchools({ ...filters, q: debouncedQ || undefined })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add school to compare</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <input
          autoFocus
          type="text"
          placeholder="Search by name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="filter-input"
          style={{ marginBottom: 12 }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {data?.results.map(s => {
            const already = existingUrns.includes(s.urn)
            return (
              <div
                key={s.urn}
                className={`search-result-item${already ? ' disabled' : ''}`}
                onClick={() => { if (!already) { onAdd(s.urn, s.name); onClose() } }}
              >
                <div className="search-result-name">{s.name}</div>
                <div className="search-result-meta">{s.la_name} · {s.phase ?? '—'}</div>
                {already && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Already added</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function fmt(v: number | null | undefined, suffix = '', decimals = 1) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--gray-400)' }}>–</span>
  return <>{v.toFixed(decimals)}{suffix}</>
}

type School = NonNullable<ReturnType<typeof useCompare>['data']>[0]

const METRICS: {
  label: string
  glossary?: string
  get: (s: School) => React.ReactNode
  numVal?: (s: School) => number | null
  benchmark?: keyof BenchmarkSummary
  benchmarkSuffix?: string
  higher: 1 | -1 | null
}[] = [
  { label: 'Phase', get: s => s.phase ?? '–', higher: null },
  { label: 'Type', get: s => s.establishment_group ?? '–', higher: null },
  { label: 'Pupils', get: s => s.total_pupils?.toLocaleString() ?? '–', higher: 1 },
  {
    label: 'Ofsted',
    get: s => {
      const grade = s.ofsted_overall ?? s.ofsted_leadership ?? s.ofsted_quality
      return (
        <div>
          <span>{grade ?? '–'}</span>
          {s.ofsted_date && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{new Date(s.ofsted_date).toLocaleDateString('en-GB')}</div>}
        </div>
      )
    },
    higher: null,
  },
  { label: 'Attainment 8', glossary: GLOSSARY['Attainment 8'], get: s => <StatValue value={s.attainment_8} suppressed={s.ks4_suppressed} />, numVal: s => s.attainment_8, benchmark: 'ks4_attainment_8', higher: 1 },
  { label: 'Progress 8', glossary: GLOSSARY['Progress 8'], get: s => <StatValue value={s.progress_8} suppressed={s.ks4_suppressed} />, numVal: s => s.progress_8, benchmark: 'ks4_progress_8', higher: 1 },
  { label: 'Grade 5+ E&M', glossary: GLOSSARY['Grade 5+ E&M'], get: s => <StatValue value={s.pct_grade5_english_maths} suppressed={s.ks4_suppressed} suffix="%" />, numVal: s => s.pct_grade5_english_maths, benchmark: 'ks4_pct_grade5_english_maths', benchmarkSuffix: '%', higher: 1 },
  { label: 'Avg A-level pts', get: s => <StatValue value={s.avg_points_per_alevel_entry} suppressed={s.ks5_suppressed} />, numVal: s => s.avg_points_per_alevel_entry, benchmark: 'ks5_avg_points', higher: 1 },
  { label: '% Expected RWM', glossary: GLOSSARY.RWM, get: s => <StatValue value={s.pct_expected_rwm} suppressed={s.ks2_suppressed} suffix="%" />, numVal: s => s.pct_expected_rwm, benchmark: 'ks2_pct_expected_rwm', benchmarkSuffix: '%', higher: 1 },
  { label: 'FSM eligible %', glossary: GLOSSARY['FSM eligible'], get: s => fmt(s.pct_fsm6, '%'), numVal: s => s.pct_fsm6, higher: -1 },
  { label: 'Income/pupil', get: s => s.income_per_pupil !== null ? `£${s.income_per_pupil.toLocaleString()}` : '–', higher: null },
]

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const compare = useCompareContext()

  const urnStrings = searchParams.get('urns')?.split(',').filter(Boolean) ?? []
  const urns = urnStrings.map(Number).filter(n => !isNaN(n)).slice(0, 5)

  const { data: schools, isLoading } = useCompare(urns)
  const { data: benchmarks } = useBenchmarks()

  useEffect(() => {
    if (urns.length === 0 && compare.selected.length > 0) {
      setSearchParams({ urns: compare.selected.map(s => s.urn).join(',') })
    }
  }, [])

  const addSchool = (urn: number, name: string) => {
    const next = [...urns, urn].slice(0, 5)
    setSearchParams({ urns: next.join(',') })
    compare.add(urn, name)
  }

  const removeSchool = (urn: number) => {
    setSearchParams({ urns: urns.filter(u => u !== urn).join(',') })
    compare.remove(urn)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Link to="/" style={{ fontSize: 13, color: 'var(--gray-500)' }}>← Back to search</Link>
          <h1 style={{ marginTop: 8, fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px' }}>Compare schools</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" disabled={urns.length === 0} onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
          {urns.length < 5 && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add school</button>
          )}
        </div>
      </div>

      {urns.length < 2 && (
        <div className="empty-state">
          <p>Add at least 2 schools to start comparing.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add school</button>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
              Or search for schools →
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="loading">Loading…</div>}

      {schools && schools.length >= 2 && (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-sm)' }}>
          <table className="compare-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}><span className="metric-label">Metric</span></th>
                {schools.map(s => (
                  <th key={s.urn} style={{ minWidth: 180, maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div>
                      <Link to={`/schools/${s.urn}`} style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</Link>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginTop: 3 }}>
                      {s.la_name} · {s.phase ?? '—'}
                    </div>
                    <button
                      className="btn btn-danger-ghost"
                      style={{ marginTop: 6 }}
                      onClick={() => removeSchool(s.urn)}
                    >
                      Remove
                    </button>
                  </th>
                ))}
                <th style={{ minWidth: 130, maxWidth: 150 }}>
                  <span className="metric-label">London avg</span>
                </th>
                {urns.length < 5 && (
                  <th>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>+ Add</button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(m => {
                const vals = schools.map(s => m.numVal ? m.numVal(s) : null)
                const validVals = vals.filter((v): v is number => v !== null)
                const best = validVals.length > 1 && m.higher !== null
                  ? (m.higher === 1 ? Math.max(...validVals) : Math.min(...validVals))
                  : null
                const worst = validVals.length > 1 && m.higher !== null
                  ? (m.higher === 1 ? Math.min(...validVals) : Math.max(...validVals))
                  : null

                return (
                  <tr key={m.label}>
                    <td>
                      <span className="metric-label">
                        {m.glossary ? <Tooltip text={m.glossary}>{m.label}</Tooltip> : m.label}
                      </span>
                    </td>
                    {schools.map(s => {
                      const v = m.numVal ? m.numVal(s) : null
                      const isBest = best !== null && v === best
                      const isWorst = worst !== null && v === worst && v !== best
                      return (
                        <td
                          key={s.urn}
                          className={`cell-value${isBest ? ' cell-best' : isWorst ? ' cell-worst' : ''}`}
                        >
                          {m.get(s)}
                        </td>
                      )
                    })}
                    <td className="cell-value">
                      {m.benchmark && benchmarks ? fmt(benchmarks[m.benchmark], m.benchmarkSuffix ?? '') : '–'}
                    </td>
                    {urns.length < 5 && <td />}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <SearchModal
          onAdd={addSchool}
          onClose={() => setShowModal(false)}
          existingUrns={urns}
        />
      )}
    </div>
  )
}
