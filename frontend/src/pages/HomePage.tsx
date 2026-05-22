import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, List, Map, MapPin, Search, X } from 'lucide-react'
import SchoolCard from '../components/SchoolCard'
import { useBoroughs, useSchoolMapPoints, useSchools } from '../hooks/useSchools'
import type { SchoolFilters } from '../api/types'

const SchoolMap = lazy(() => import('../components/SchoolMap'))

const PHASES = [
  { value: '', label: 'All ages' },
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'All-through', label: 'All-through' },
  { value: '16 plus', label: 'Sixth form & colleges' },
]

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'state', label: 'State' },
  { value: 'academy', label: 'Academy' },
  { value: 'free', label: 'Free school' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'independent', label: 'Independent' },
  { value: 'sixth_form_college', label: 'Sixth form college' },
]

const GENDERS = [
  { value: '', label: 'Any gender' },
  { value: 'Mixed', label: 'Mixed' },
  { value: 'Boys', label: 'Boys' },
  { value: 'Girls', label: 'Girls' },
]

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'ofsted_overall', label: 'Ofsted rating' },
  { value: 'attainment_8', label: 'GCSE avg score' },
  { value: 'pct_expected_rwm', label: 'Reading, writing & maths' },
  { value: 'avg_points_per_alevel_entry', label: 'A-level points' },
]

const CHILD_STAGES = [
  { value: '', label: "I'm not sure yet", patch: {} },
  { value: 'primary', label: 'Starting primary school', patch: { phase: 'Primary', establishment_groups: 'state,academy,free' } },
  { value: 'secondary', label: 'Starting secondary school', patch: { phase: 'Secondary', establishment_groups: 'state,academy,free,grammar' } },
  { value: 'sixth', label: 'Looking for sixth form', patch: { has_sixth_form: true } },
]

const RADII = [0.5, 1, 2, 5, 10]

function labelFor(options: { value: string; label: string }[], value?: string) {
  if (!value) return ''
  return options.find(o => o.value === value)?.label ?? value
}

export default function HomePage() {
  const [filters, setFilters] = useState<SchoolFilters>({ page: 1, page_size: 25 })
  const [searchInput, setSearchInput] = useState('')
  const [postcodeInput, setPostcodeInput] = useState('')
  const [postcodeLabel, setPostcodeLabel] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [postcodeLoading, setPostcodeLoading] = useState(false)
  const [childStage, setChildStage] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedMapUrn, setSelectedMapUrn] = useState<number | null>(null)
  const [mapWithinRadius, setMapWithinRadius] = useState(false)

  const { data, isLoading, isError } = useSchools(filters)
  const hasLocation = filters.lat !== undefined && filters.lng !== undefined
  const { data: mapData, isLoading: mapLoading } = useSchoolMapPoints(filters, viewMode === 'map', mapWithinRadius && hasLocation)
  const { data: boroughs } = useBoroughs()
  const mapPoints = mapData?.results ?? []
  const mapNearbyCount = hasLocation
    ? mapPoints.filter(s => s.distance_km != null && s.distance_km <= (filters.radius_km ?? 2)).length
    : 0

  const update = useCallback((patch: Partial<SchoolFilters>) => {
    setFilters(f => ({ ...f, ...patch, page: 1 }))
    setSelectedMapUrn(null)
  }, [])

  useEffect(() => {
    const value = searchInput.trim()
    const timeout = window.setTimeout(() => {
      setFilters(f => ({ ...f, q: value || undefined, page: 1 }))
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const lookupPostcode = async (postcode: string, patch: Partial<SchoolFilters> = {}) => {
    setPostcodeLoading(true)
    setPostcodeError('')
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
      if (!response.ok) throw new Error('not found')
      const payload = await response.json()
      if (!payload.result?.latitude || !payload.result?.longitude) throw new Error('not found')
      setPostcodeLabel(payload.result.postcode ?? postcode.toUpperCase())
      update({ ...patch, lat: payload.result.latitude, lng: payload.result.longitude, radius_km: filters.radius_km ?? 2, sort_by: undefined })
      setFiltersOpen(false)
    } catch {
      setPostcodeError('Enter a valid UK postcode.')
    } finally {
      setPostcodeLoading(false)
    }
  }

  const handleGuidedStart = async (e: React.FormEvent) => {
    e.preventDefault()
    const stagePatch = CHILD_STAGES.find(s => s.value === childStage)?.patch ?? {}
    if (!postcodeInput.trim()) { update(stagePatch); return }
    await lookupPostcode(postcodeInput.trim(), stagePatch)
  }

  const handlePostcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const postcode = postcodeInput.trim()
    if (!postcode) return
    await lookupPostcode(postcode)
  }

  const clearPostcode = () => {
    setPostcodeInput('')
    setPostcodeLabel('')
    setPostcodeError('')
    setMapWithinRadius(false)
    update({ lat: undefined, lng: undefined, radius_km: undefined })
  }

  const clearAll = () => {
    setFilters({ page: 1, page_size: 25 })
    setSearchInput('')
    setPostcodeInput('')
    setPostcodeLabel('')
    setPostcodeError('')
    setChildStage('')
    setMapWithinRadius(false)
    setFiltersOpen(false)
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (filters.q) chips.push({ key: 'q', label: `Name: ${filters.q}`, clear: () => { setSearchInput(''); update({ q: undefined }) } })
    if (postcodeLabel) chips.push({ key: 'postcode', label: `Near ${postcodeLabel}`, clear: clearPostcode })
    if (filters.radius_km && postcodeLabel) chips.push({ key: 'radius', label: `${filters.radius_km} km`, clear: () => update({ radius_km: 2 }) })
    if (filters.borough) chips.push({ key: 'borough', label: boroughs?.find(b => b.la_code === filters.borough)?.la_name ?? filters.borough, clear: () => update({ borough: undefined }) })
    if (filters.phase) chips.push({ key: 'phase', label: labelFor(PHASES, filters.phase), clear: () => update({ phase: undefined }) })
    if (filters.establishment_group) chips.push({ key: 'type', label: labelFor(TYPES, filters.establishment_group), clear: () => update({ establishment_group: undefined }) })
    if (filters.establishment_groups) chips.push({ key: 'groups', label: 'Mainstream state', clear: () => update({ establishment_groups: undefined }) })
    if (filters.gender) chips.push({ key: 'gender', label: filters.gender, clear: () => update({ gender: undefined }) })
    if (filters.ofsted_rating === 'good_or_better') chips.push({ key: 'ofsted', label: 'Good or Outstanding', clear: () => update({ ofsted_rating: undefined }) })
    if (filters.has_sixth_form) chips.push({ key: 'sixth', label: 'Has sixth form', clear: () => update({ has_sixth_form: undefined }) })
    if (filters.is_selective) chips.push({ key: 'selective', label: 'Selective', clear: () => update({ is_selective: undefined }) })
    if (filters.faith_only) chips.push({ key: 'faith', label: 'Faith schools', clear: () => update({ faith_only: undefined }) })
    return chips
  }, [boroughs, filters, postcodeLabel])

  const totalPages = data ? Math.ceil(data.total / (filters.page_size ?? 25)) : 0
  const currentPage = filters.page ?? 1

  return (
    <div>
      {/* ── Full-bleed dark hero — shares --ink bg with topbar ── */}
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-eyebrow">London School Explorer</p>
          <h1 className="hero-headline">Every school<br />in London.</h1>
          <p className="hero-sub">Search by location, age, Ofsted rating, and results.</p>

          <form className="hero-search" onSubmit={handleGuidedStart}>
            <div className="hero-search-field">
              <label htmlFor="hero-stage">My child is</label>
              <select id="hero-stage" value={childStage} onChange={e => setChildStage(e.target.value)}>
                {CHILD_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="hero-search-divider" />
            <div className="hero-search-field">
              <label htmlFor="hero-postcode">Near postcode</label>
              <input
                id="hero-postcode"
                type="text"
                value={postcodeInput}
                onChange={e => setPostcodeInput(e.target.value)}
                placeholder="e.g. N1C 4PF"
              />
            </div>
            <button type="submit" className="hero-search-btn" disabled={postcodeLoading}>
              <Search size={16} strokeWidth={2.5} />
              {postcodeLoading ? 'Finding…' : 'Find schools'}
            </button>
          </form>
          {postcodeError && <p className="hero-search-error">{postcodeError}</p>}

          <div className="hero-chips">
            <button type="button" className={`hero-chip${filters.phase === 'Primary' ? ' active' : ''}`} onClick={() => update({ phase: filters.phase === 'Primary' ? undefined : 'Primary' })}>Primary</button>
            <button type="button" className={`hero-chip${filters.phase === 'Secondary' ? ' active' : ''}`} onClick={() => update({ phase: filters.phase === 'Secondary' ? undefined : 'Secondary' })}>Secondary</button>
            <button type="button" className={`hero-chip${filters.ofsted_rating === 'good_or_better' ? ' active' : ''}`} onClick={() => update({ ofsted_rating: filters.ofsted_rating === 'good_or_better' ? undefined : 'good_or_better' })}>Outstanding or Good</button>
            <button type="button" className={`hero-chip${filters.is_selective ? ' active' : ''}`} onClick={() => update({ is_selective: filters.is_selective ? undefined : true })}>Grammar schools</button>
          </div>
        </div>
      </section>

      {/* ── Sticky horizontal filter bar ──────────────────────── */}
      <div className="filter-bar-wrap">
        <div className="filter-bar">
          <div className="filter-bar-left">
            <div className="filter-search">
              <span className="filter-search-icon"><Search size={13} strokeWidth={2} /></span>
              <input
                type="text"
                className="filter-search-input"
                placeholder="School name…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                aria-label="Search by school name"
              />
            </div>

            {postcodeLabel ? (
              <div className="postcode-chip">
                <MapPin size={12} strokeWidth={2.5} />
                {postcodeLabel}
                <select
                  value={filters.radius_km ?? 2}
                  onChange={e => update({ radius_km: Number(e.target.value) })}
                  style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--brick)', cursor: 'pointer', outline: 'none', padding: '0 4px' }}
                  aria-label="Radius"
                >
                  {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
                </select>
                <button onClick={clearPostcode} aria-label="Clear postcode"><X size={13} strokeWidth={2.5} /></button>
              </div>
            ) : (
              <form onSubmit={handlePostcodeSearch} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div className="filter-search">
                  <span className="filter-search-icon"><MapPin size={13} strokeWidth={2} /></span>
                  <input
                    type="text"
                    className="filter-search-input"
                    placeholder="Postcode…"
                    value={postcodeInput}
                    onChange={e => setPostcodeInput(e.target.value)}
                    aria-label="Near postcode"
                  />
                </div>
                {postcodeInput && (
                  <button type="submit" className="btn btn-primary btn-sm" disabled={postcodeLoading}>
                    {postcodeLoading ? '…' : 'Go'}
                  </button>
                )}
              </form>
            )}

            <div className="filter-sep" />

            <div className={`filter-pill${filters.borough ? ' filter-pill--active' : ''}`}>
              <select value={filters.borough ?? ''} onChange={e => update({ borough: e.target.value || undefined })} aria-label="Borough">
                <option value="">All boroughs</option>
                {boroughs?.map(b => <option key={b.la_code} value={b.la_code}>{b.la_name}</option>)}
              </select>
            </div>
            <div className={`filter-pill${filters.phase ? ' filter-pill--active' : ''}`}>
              <select value={filters.phase ?? ''} onChange={e => update({ phase: e.target.value || undefined })} aria-label="School age">
                {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className={`filter-pill${filters.establishment_group ? ' filter-pill--active' : ''}`}>
              <select value={filters.establishment_group ?? ''} onChange={e => update({ establishment_group: e.target.value || undefined, establishment_groups: undefined })} aria-label="School type">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className={`filter-pill${filters.gender ? ' filter-pill--active' : ''}`}>
              <select value={filters.gender ?? ''} onChange={e => update({ gender: e.target.value || undefined })} aria-label="Gender">
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>

            <div className="filter-sep" />

            <button type="button" className={`filter-toggle${filters.ofsted_rating === 'good_or_better' ? ' filter-toggle--active' : ''}`} onClick={() => update({ ofsted_rating: filters.ofsted_rating === 'good_or_better' ? undefined : 'good_or_better' })}>Good or Outstanding</button>
            <button type="button" className={`filter-toggle${filters.has_sixth_form ? ' filter-toggle--active' : ''}`} onClick={() => update({ has_sixth_form: filters.has_sixth_form ? undefined : true })}>Sixth form</button>
            <button type="button" className={`filter-toggle${filters.is_selective ? ' filter-toggle--active' : ''}`} onClick={() => update({ is_selective: filters.is_selective ? undefined : true })}>Selective</button>
          </div>

          <div className="filter-bar-right">
            <div className="filter-sort">
              <select value={filters.sort_by ?? (filters.lat !== undefined ? '' : 'name')} onChange={e => update({ sort_by: e.target.value || undefined })} aria-label="Sort by">
                {filters.lat !== undefined && <option value="">Nearest first</option>}
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {data && (
              <span className="results-count">{data.total.toLocaleString()} school{data.total !== 1 ? 's' : ''}</span>
            )}
            <div className="view-toggle" aria-label="Choose results view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
                <List size={14} /> List
              </button>
              <button type="button" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>
                <Map size={14} /> Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile filter button ───────────────────────────────── */}
      <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
        <Filter size={18} />
        Filters
        {activeChips.length > 0 && <span className="nav-count">{activeChips.length}</span>}
      </button>

      <div className="mobile-view-toggle" aria-label="Choose results view">
        <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
          <List size={14} /> List
        </button>
        <button type="button" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>
          <Map size={14} /> Map
        </button>
      </div>

      {filtersOpen && <button className="filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`sidebar${filtersOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">Filters</div>
          <button type="button" className="sidebar-close btn btn-ghost btn-sm" onClick={() => setFiltersOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <button type="button" className="link-button clear-top" onClick={clearAll}>Clear all filters</button>

        <div className="filter-group">
          <label className="filter-label" htmlFor="m-name">School name</label>
          <input id="m-name" type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Start typing…" className="filter-input" />
        </div>
        <form onSubmit={handlePostcodeSearch} className="filter-group">
          <label className="filter-label" htmlFor="m-postcode">Near postcode</label>
          <div className="filter-search-row">
            <input id="m-postcode" type="text" value={postcodeInput} onChange={e => setPostcodeInput(e.target.value)} placeholder="e.g. N1C 4PF" className="filter-input" />
            <button type="submit" className="btn btn-primary btn-sm" disabled={postcodeLoading}><MapPin size={14} />{postcodeLoading ? '…' : 'Go'}</button>
          </div>
          {postcodeLabel && (
            <>
              <select value={filters.radius_km ?? 2} onChange={e => update({ radius_km: Number(e.target.value) })} className="filter-select" style={{ marginTop: 8 }}>
                {RADII.map(r => <option key={r} value={r}>{r} km radius</option>)}
              </select>
              <button type="button" className="link-button" onClick={clearPostcode} style={{ marginTop: 6 }}>Clear {postcodeLabel}</button>
            </>
          )}
          {postcodeError && <p className="filter-error">{postcodeError}</p>}
        </form>
        <div className="filter-group">
          <label className="filter-label" htmlFor="m-borough">Borough</label>
          <select id="m-borough" value={filters.borough ?? ''} onChange={e => update({ borough: e.target.value || undefined })} className="filter-select">
            <option value="">All boroughs</option>
            {boroughs?.map(b => <option key={b.la_code} value={b.la_code}>{b.la_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="m-phase">School age</label>
          <select id="m-phase" value={filters.phase ?? ''} onChange={e => update({ phase: e.target.value || undefined })} className="filter-select">
            {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="m-type">School type</label>
          <select id="m-type" value={filters.establishment_group ?? ''} onChange={e => update({ establishment_group: e.target.value || undefined, establishment_groups: undefined })} className="filter-select">
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="m-gender">Gender</label>
          <select id="m-gender" value={filters.gender ?? ''} onChange={e => update({ gender: e.target.value || undefined })} className="filter-select">
            {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="checkbox-label"><input type="checkbox" checked={filters.ofsted_rating === 'good_or_better'} onChange={e => update({ ofsted_rating: e.target.checked ? 'good_or_better' : undefined })} />Good or Outstanding Ofsted</label>
          <label className="checkbox-label" style={{ marginTop: 8 }}><input type="checkbox" checked={filters.has_sixth_form === true} onChange={e => update({ has_sixth_form: e.target.checked ? true : undefined })} />Has sixth form</label>
          <label className="checkbox-label" style={{ marginTop: 8 }}><input type="checkbox" checked={filters.is_selective === true} onChange={e => update({ is_selective: e.target.checked ? true : undefined })} />Selective grammar</label>
          <label className="checkbox-label" style={{ marginTop: 8 }}><input type="checkbox" checked={filters.faith_only === true} onChange={e => update({ faith_only: e.target.checked ? true : undefined })} />Faith schools</label>
        </div>
      </aside>

      {/* ── Results ───────────────────────────────────────────── */}
      <div className="results-area">
        {isLoading && <div className="loading">Loading schools…</div>}
        {isError && <p className="error-msg">Failed to load schools. Is the API running?</p>}

        {data && (
          <>
            {activeChips.length > 0 && (
              <div className="active-chips" aria-label="Active filters">
                {activeChips.map(chip => (
                  <button key={chip.key} type="button" className="chip" onClick={chip.clear}>
                    {chip.label}<X size={12} strokeWidth={2.5} />
                  </button>
                ))}
                <button type="button" className="chip-clear-all" onClick={clearAll}>Clear all</button>
              </div>
            )}

            {data.total > 100 && (
              <p className="narrowing-hint">A shorter list is easier to compare. Add a postcode, age group, or Ofsted filter.</p>
            )}

            {data.total === 0 ? (
              <div className="empty-state">
                <p>No schools match these filters.</p>
                <button className="btn btn-primary" onClick={clearAll}>Clear all filters</button>
              </div>
            ) : viewMode === 'map' ? (
              <div className="school-map-layout">
                <div className="school-map-results">
                  <div className="school-map-results-head">
                    <strong>{filters.lat !== undefined ? 'Nearest matches' : 'Matching schools'}</strong>
                    <span>
                      Showing {data.results.length} list card{data.results.length === 1 ? '' : 's'}
                      {mapData && hasLocation
                        ? `; map shows ${mapData.total.toLocaleString()} London school${mapData.total === 1 ? '' : 's'}${mapWithinRadius ? '' : `, ${mapNearbyCount.toLocaleString()} within ${(filters.radius_km ?? 2).toLocaleString()} km`}.`
                        : mapData
                          ? `; map shows ${mapData.total.toLocaleString()} London school${mapData.total === 1 ? '' : 's'}.`
                          : '.'}
                    </span>
                  </div>
                  <div className="cards-grid cards-grid--map">
                    {data.results.map(s => (
                      <SchoolCard
                        key={s.urn}
                        school={s}
                        mapSelected={selectedMapUrn === s.urn}
                        onMapFocus={() => setSelectedMapUrn(s.urn)}
                      />
                    ))}
                  </div>
                  {data.total > (filters.page_size ?? 25) && (
                    <div className="pagination pagination--compact">
                      <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>← Prev</button>
                      <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                      <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>Next →</button>
                    </div>
                  )}
                </div>
                <Suspense fallback={<div className="school-map-placeholder">Loading map…</div>}>
                  <SchoolMap
                    points={mapPoints}
                    mapTotal={mapData?.total ?? 0}
                    truncated={mapData?.truncated ?? false}
                    filters={filters}
                    postcodeLabel={postcodeLabel}
                    isLoading={mapLoading}
                    hasLocation={hasLocation}
                    nearbyCount={mapNearbyCount}
                    withinRadius={mapWithinRadius && hasLocation}
                    onWithinRadiusChange={setMapWithinRadius}
                    selectedUrn={selectedMapUrn}
                    onSelect={setSelectedMapUrn}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="cards-grid">
                {data.results.map(s => <SchoolCard key={s.urn} school={s} />)}
              </div>
            )}

            {viewMode === 'list' && data.total > (filters.page_size ?? 25) && (
              <div className="pagination">
                <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>← Prev</button>
                <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
