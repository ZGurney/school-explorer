import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AcademicTab from '../components/detail/AcademicTab'
import ContextTab from '../components/detail/ContextTab'
import DestinationsTab from '../components/detail/DestinationsTab'
import HistoryTab from '../components/detail/HistoryTab'
import OverviewTab from '../components/detail/OverviewTab'
import OfstedBadge, { effectiveOfstedGrade, ofstedCssColor } from '../components/OfstedBadge'
import { useCompareContext } from '../context/CompareContext'
import { useShortlistContext } from '../context/ShortlistContext'
import { useSchool } from '../hooks/useSchools'
import { GLOSSARY } from '../utils/glossary'

const TABS = ['Overview', 'Academic results', 'Destinations', 'Context', 'History'] as const
type Tab = typeof TABS[number]

export default function SchoolDetailPage() {
  const { urn } = useParams<{ urn: string }>()
  const { data, isLoading, isError } = useSchool(urn ? Number(urn) : undefined)
  const [tab, setTab] = useState<Tab>('Overview')
  const { toggle, isSelected } = useCompareContext()
  const shortlist = useShortlistContext()

  if (isLoading) return <div className="page loading">Loading…</div>
  if (isError || !data) return (
    <div className="page" style={{ paddingTop: 32 }}>
      <p className="error-msg">School not found.</p>
      <Link to="/" style={{ color: 'var(--brick)' }}>← Back to search</Link>
    </div>
  )

  const selected = isSelected(data.urn)
  const saved = shortlist.isSaved(data.urn)
  const dataYears = [data.ks2_year, data.ks4_year, data.ks5_year].filter(Boolean).sort()
  const dataYear = dataYears[dataYears.length - 1]
  const showDestinations = data.phase !== 'Primary' || data.destinations_ks4_history.length > 0 || data.destinations_ks5_history.length > 0
  const tabs = showDestinations ? TABS : TABS.filter(t => t !== 'Destinations')

  /* Ofsted colour drives the entire hero panel background */
  const heroBg = ofstedCssColor(effectiveOfstedGrade(data.ofsted_overall, data.ofsted_quality, data.ofsted_leadership))

  return (
    <div className="page">
      {/* ── Dramatic Ofsted-coloured hero panel ─────────────── */}
      <div className="detail-hero" style={{ background: heroBg }}>
        <Link to="/" className="detail-hero-back">← All schools</Link>

        <h1>{data.name}</h1>

        <div className="detail-hero-meta">
          {[data.la_name, data.phase, data.postcode].filter(Boolean).join(' · ')}
          {dataYear && <span style={{ marginLeft: 12, opacity: .6, fontSize: 13 }}>Data: {dataYear}</span>}
        </div>

        <div className="detail-hero-badges">
          <OfstedBadge
            overall={data.ofsted_overall}
            date={data.ofsted_date}
            leadership={data.ofsted_leadership}
            quality={data.ofsted_quality}
          />
          {data.is_selective && <span className="badge badge--selective">Selective</span>}
          {data.has_sixth_form && <span className="badge badge--sixth">Sixth form</span>}
        </div>

        <div className="detail-hero-actions">
          <button
            className={`btn btn-sm ${saved ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => shortlist.toggle(data.urn, data.name)}
          >
            {saved ? '♥ Saved' : '♡ Save to shortlist'}
          </button>
          <button
            className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => toggle(data.urn, data.name)}
          >
            {selected ? '✓ In comparison' : '+ Compare'}
          </button>
        </div>
      </div>

      {!data.ofsted_overall && data.ofsted_date && (
        <div className="info-banner">
          <strong>Ofsted changed how it reports some inspections.</strong> {GLOSSARY.OfstedNewFramework}
        </div>
      )}

      <div className="tabs">
        {tabs.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview'          && <OverviewTab school={data} />}
      {tab === 'Academic results'  && <AcademicTab school={data} />}
      {tab === 'Destinations'      && showDestinations && <DestinationsTab school={data} />}
      {tab === 'Context'           && <ContextTab school={data} />}
      {tab === 'History'           && <HistoryTab school={data} />}
    </div>
  )
}
