import { useQueries } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import type { SchoolDetail } from '../api/types'
import OfstedBadge from '../components/OfstedBadge'
import StatValue from '../components/StatValue'
import { useCompareContext } from '../context/CompareContext'
import { useShortlistContext } from '../context/ShortlistContext'

function KeyMetric({ s }: { s: SchoolDetail }) {
  if (s.phase === 'Primary') return <StatValue value={s.pct_expected_rwm} suppressed={s.ks2_suppressed} suffix="%" />
  if (s.phase === 'Secondary' || s.phase === 'All-through') return <StatValue value={s.attainment_8} suppressed={s.ks4_suppressed} />
  return <StatValue value={s.avg_points_per_alevel_entry} suppressed={s.ks5_suppressed} />
}

export default function ShortlistPage() {
  const { saved, remove } = useShortlistContext()
  const compare = useCompareContext()
  const navigate = useNavigate()

  const queries = useQueries({
    queries: saved.map(s => ({
      queryKey: ['school', s.urn],
      queryFn: () => api.get(`/schools/${s.urn}`).then(r => r.data as SchoolDetail),
      staleTime: 60_000,
    })),
  })
  const schools = queries.map(q => q.data).filter((s): s is SchoolDetail => Boolean(s))

  const addAllToCompare = () => {
    schools.slice(0, 5).forEach(s => compare.add(s.urn, s.name))
    navigate(`/compare?urns=${schools.slice(0, 5).map(s => s.urn).join(',')}`)
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontOpticalSizing: 'auto', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 6 }}>
            My Shortlist
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {saved.length === 0 ? 'Saved schools will appear here.' : `${saved.length} saved school${saved.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button className="btn btn-primary" disabled={schools.length < 2} onClick={addAllToCompare}>
          Compare shortlist
        </button>
      </div>

      {saved.length === 0 && (
        <div className="empty-state">
          <p>No schools saved yet.</p>
          <Link to="/" className="btn btn-primary">Search schools</Link>
        </div>
      )}

      {saved.length > 0 && schools.length === 0 && <div className="loading">Loading shortlist…</div>}

      <div className="shortlist-list">
        {schools.map(s => (
          <div key={s.urn} className="shortlist-item">
            <div>
              <Link to={`/schools/${s.urn}`} className="shortlist-name">{s.name}</Link>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {s.la_name && <span>{s.la_name}</span>}
                {s.phase && <><span>·</span><span>{s.phase}</span></>}
                {s.postcode && <><span>·</span><span>{s.postcode}</span></>}
              </div>
            </div>
            <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} leadership={s.ofsted_leadership} quality={s.ofsted_quality} />
            <div className="shortlist-metric"><KeyMetric s={s} /></div>
            <button className="btn btn-ghost btn-sm" onClick={() => compare.toggle(s.urn, s.name)}>
              {compare.isSelected(s.urn) ? '✓ In compare' : '+ Compare'}
            </button>
            <button className="btn btn-danger-ghost" onClick={() => remove(s.urn)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
