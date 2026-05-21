import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AcademicTab from '../components/detail/AcademicTab'
import ContextTab from '../components/detail/ContextTab'
import DestinationsTab from '../components/detail/DestinationsTab'
import HistoryTab from '../components/detail/HistoryTab'
import OverviewTab from '../components/detail/OverviewTab'
import OfstedBadge from '../components/OfstedBadge'
import { useCompareContext } from '../context/CompareContext'
import { useSchool } from '../hooks/useSchools'

const TABS = ['Overview', 'Academic results', 'Destinations', 'Context', 'History'] as const
type Tab = typeof TABS[number]

export default function SchoolDetailPage() {
  const { urn } = useParams<{ urn: string }>()
  const { data, isLoading, isError } = useSchool(urn ? Number(urn) : undefined)
  const [tab, setTab] = useState<Tab>('Overview')
  const { toggle, isSelected } = useCompareContext()

  if (isLoading) return <div className="page loading">Loading…</div>
  if (isError || !data) return (
    <div className="page" style={{ paddingTop: 32 }}>
      <p className="error-msg">School not found.</p>
      <Link to="/">← Back to search</Link>
    </div>
  )

  const selected = isSelected(data.urn)

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--gray-500)' }}>← All schools</Link>

      <div className="detail-header-bar">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px' }}>{data.name}</h1>
          <div style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 6 }}>
            {[data.la_name, data.phase, data.postcode].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <OfstedBadge overall={data.ofsted_overall} date={data.ofsted_date} />
          {data.is_selective && <span className="badge badge-selective">Selective</span>}
          <button
            className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => toggle(data.urn, data.name)}
          >
            {selected ? '✓ In comparison' : '+ Compare'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab school={data} />}
      {tab === 'Academic results' && <AcademicTab school={data} />}
      {tab === 'Destinations' && <DestinationsTab school={data} />}
      {tab === 'Context' && <ContextTab school={data} />}
      {tab === 'History' && <HistoryTab school={data} />}
    </div>
  )
}
