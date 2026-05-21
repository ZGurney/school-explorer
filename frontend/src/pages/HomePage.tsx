import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, MapPin, Search, X } from 'lucide-react'
import SchoolCard from '../components/SchoolCard'
import { useBenchmarks, useBoroughs, useSchools } from '../hooks/useSchools'
import type { SchoolFilters } from '../api/types'

const PHASES = [
  { value: '', label: 'All school ages' },
  { value: 'Primary', label: 'Primary school' },
  { value: 'Secondary', label: 'Secondary school' },
  { value: 'All-through', label: 'Reception to sixth form' },
  { value: '16 plus', label: 'Sixth form & colleges' },
]

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'state', label: 'State maintained' },
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
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'ofsted_overall', label: 'Ofsted rating' },
  { value: 'attainment_8', label: 'GCSE average score' },
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

  const { data, isLoading, isError } = useSchools(filters)
  const { data: boroughs } = useBoroughs()
  const { data: benchmarks } = useBenchmarks()

  const update = useCallback((patch: Partial<SchoolFilters>) => {
    setFilters(f => ({ ...f, ...patch, page: 1 }))
  }, [])

  const childStagePatch = useCallback((): Partial<SchoolFilters> => (
    CHILD_STAGES.find(s => s.value === childStage)?.patch ?? {}
  ), [childStage])

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
      if (!response.ok) throw new Error('Postcode not found')
      const payload = await response.json()
      if (!payload.result?.latitude || !payload.result?.longitude) throw new Error('Postcode not found')
      setPostcodeLabel(payload.result.postcode ?? postcode.toUpperCase())
      update({
        ...patch,
        lat: payload.result.latitude,
        lng: payload.result.longitude,
        radius_km: filters.radius_km ?? 2,
        sort_by: undefined,
      })
      setFiltersOpen(false)
    } catch {
      setPostcodeError('Enter a valid UK postcode.')
    } finally {
      setPostcodeLoading(false)
    }
  }

  const handleGuidedStart = async (e: React.FormEvent) => {
    e.preventDefault()
    const stagePatch = childStagePatch()
    if (!postcodeInput.trim()) {
      update(stagePatch)
      setFiltersOpen(false)
      return
    }
    await lookupPostcode(postcodeInput.trim(), stagePatch)
  }

  const handlePostcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const postcode = postcodeInput.trim()
    if (!postcode) return
    await lookupPostcode(postcode, childStagePatch())
  }

  const clearPostcode = () => {
    setPostcodeInput('')
    setPostcodeLabel('')
    setPostcodeError('')
    update({ lat: undefined, lng: undefined, radius_km: undefined })
  }

  const clearAll = () => {
    setFilters({ page: 1, page_size: 25 })
    setSearchInput('')
    setPostcodeInput('')
    setPostcodeLabel('')
    setPostcodeError('')
    setChildStage('')
    setFiltersOpen(false)
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (filters.q) chips.push({ key: 'q', label: `Name: ${filters.q}`, clear: () => { setSearchInput(''); update({ q: undefined }) } })
    if (postcodeLabel) chips.push({ key: 'postcode', label: `Near ${postcodeLabel}`, clear: clearPostcode })
    if (filters.radius_km && postcodeLabel) chips.push({ key: 'radius', label: `${filters.radius_km} km radius`, clear: () => update({ radius_km: 2 }) })
    if (filters.borough) chips.push({ key: 'borough', label: boroughs?.find(b => b.la_code === filters.borough)?.la_name ?? filters.borough, clear: () => update({ borough: undefined }) })
    if (filters.phase) chips.push({ key: 'phase', label: labelFor(PHASES, filters.phase), clear: () => update({ phase: undefined }) })
    if (filters.establishment_group) chips.push({ key: 'type', label: labelFor(TYPES, filters.establishment_group), clear: () => update({ establishment_group: undefined }) })
    if (filters.establishment_groups) {
      chips.push({
        key: 'groups',
        label: filters.establishment_groups.includes('grammar') ? 'State-funded (incl. grammar)' : 'State-funded',
        clear: () => update({ establishment_groups: undefined }),
      })
    }
    if (filters.gender) chips.push({ key: 'gender', label: filters.gender, clear: () => update({ gender: undefined }) })
    if (filters.ofsted_rating) {
      chips.push({
        key: 'ofsted',
        label: filters.ofsted_rating === 'good_or_better' ? 'Good or Outstanding' : `Ofsted: ${filters.ofsted_rating}`,
        clear: () => update({ ofsted_rating: undefined }),
      })
    }
    if (filters.has_sixth_form) chips.push({ key: 'sixth', label: 'Has sixth form', clear: () => update({ has_sixth_form: undefined }) })
    if (filters.is_selective) chips.push({ key: 'selective', label: 'Selective', clear: () => update({ is_selective: undefined }) })
    if (filters.faith_only) chips.push({ key: 'faith', label: 'Faith schools', clear: () => update({ faith_only: undefined }) })
    return chips
  }, [boroughs, filters, postcodeLabel, update])

  const totalPages = data ? Math.ceil(data.total / (filters.page_size ?? 25)) : 0
  const currentPage = filters.page ?? 1

  return (
    <div className="page">
      <section className="hero hero-guided">
        <div>
          <h1>Find the right school for your child</h1>
          <p>Search London schools by location, age group, Ofsted rating, and results.</p>
        </div>
        <form className="guided-search" onSubmit={handleGuidedStart}>
          <label htmlFor="child-stage">
            <span>My child is</span>
            <select id="child-stage" aria-label="My child is" value={childStage} onChange={e => setChildStage(e.target.value)} className="filter-select">
              {CHILD_STAGES.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select>
          </label>
          <label htmlFor="hero-postcode">
            <span>Near postcode</span>
            <input
              id="hero-postcode"
              aria-label="Hero postcode"
              type="text"
              value={postcodeInput}
              onChange={e => setPostcodeInput(e.target.value)}
              placeholder="e.g. N1C 4PF"
              className="filter-input"
            />
          </label>
          <button type="submit" className="btn btn-primary guided-submit" disabled={postcodeLoading}>
            <Search size={17} />
            {postcodeLoading ? 'Finding...' : 'Find schools'}
          </button>
        </form>
        {postcodeError && <p className="filter-error">{postcodeError}</p>}
      </section>

      <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
        <Filter size={18} />
        Filters
        {activeChips.length > 0 && <span className="nav-count">{activeChips.length}</span>}
      </button>

      {filtersOpen && <button className="filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}

      <div className="home-grid">
        <aside className={`sidebar${filtersOpen ? ' open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-title">Filters</div>
            <button type="button" className="sidebar-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <X size={18} />
            </button>
          </div>
          <button type="button" className="link-button clear-top" onClick={clearAll}>Clear filters</button>

          <div className="filter-group">
            <label className="filter-label" htmlFor="school-name-filter">School name</label>
            <input
              id="school-name-filter"
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Start typing a school name"
              className="filter-input"
            />
          </div>

          <form onSubmit={handlePostcodeSearch} className="filter-group">
            <label className="filter-label" htmlFor="filter-postcode">Near postcode</label>
            <div className="filter-search-row">
              <input
                id="filter-postcode"
                aria-label="Filter postcode"
                type="text"
                value={postcodeInput}
                onChange={e => setPostcodeInput(e.target.value)}
                placeholder="e.g. N1C 4PF"
                className="filter-input"
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={postcodeLoading}>
                <MapPin size={14} />
                {postcodeLoading ? '...' : 'Go'}
              </button>
            </div>
            {postcodeLabel && (
              <>
                <select
                  value={filters.radius_km ?? 2}
                  onChange={e => update({ radius_km: Number(e.target.value) })}
                  className="filter-select"
                  style={{ marginTop: 8 }}
                >
                  {RADII.map(r => <option key={r} value={r}>{r} km radius</option>)}
                </select>
                <button type="button" className="link-button" onClick={clearPostcode}>
                  Clear {postcodeLabel}
                </button>
              </>
            )}
            {postcodeError && <p className="filter-error">{postcodeError}</p>}
          </form>

          <div className="filter-group">
            <label className="filter-label" htmlFor="borough-filter">Borough</label>
            <select
              id="borough-filter"
              value={filters.borough ?? ''}
              onChange={e => update({ borough: e.target.value || undefined })}
              className="filter-select"
            >
              <option value="">All boroughs</option>
              {boroughs?.map(b => <option key={b.la_code} value={b.la_code}>{b.la_name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="phase-filter">Child's school age</label>
            <select
              id="phase-filter"
              value={filters.phase ?? ''}
              onChange={e => update({ phase: e.target.value || undefined })}
              className="filter-select"
            >
              {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="school-type-filter">School type</label>
            <select
              id="school-type-filter"
              value={filters.establishment_group ?? ''}
              onChange={e => update({ establishment_group: e.target.value || undefined, establishment_groups: undefined })}
              className="filter-select"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="gender-filter">Gender</label>
            <select
              id="gender-filter"
              value={filters.gender ?? ''}
              onChange={e => update({ gender: e.target.value || undefined })}
              className="filter-select"
            >
              {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.ofsted_rating === 'good_or_better'}
                onChange={e => update({ ofsted_rating: e.target.checked ? 'good_or_better' : undefined })}
              />
              Good or Outstanding Ofsted
            </label>
            <label className="checkbox-label" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={filters.has_sixth_form === true}
                onChange={e => update({ has_sixth_form: e.target.checked ? true : undefined })}
              />
              Has sixth form
            </label>
            <label className="checkbox-label" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={filters.is_selective === true}
                onChange={e => update({ is_selective: e.target.checked ? true : undefined })}
              />
              Selective grammar schools
            </label>
            <label className="checkbox-label" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={filters.faith_only === true}
                onChange={e => update({ faith_only: e.target.checked ? true : undefined })}
              />
              Faith schools
            </label>
          </div>
        </aside>

        <div className="results-panel">
          {isLoading && <div className="loading">Loading schools...</div>}
          {isError && <p className="error-msg">Failed to load schools. Is the API running?</p>}

          {data && (
            <>
              <div className="results-toolbar">
                <span className="results-count">
                  {data.total === 0
                    ? 'No schools found'
                    : postcodeLabel
                      ? `${data.total.toLocaleString()} schools within ${filters.radius_km ?? 2} km of ${postcodeLabel}`
                      : `Showing ${(currentPage - 1) * (filters.page_size ?? 25) + 1}-${Math.min(currentPage * (filters.page_size ?? 25), data.total)} of ${data.total.toLocaleString()} schools`}
                </span>
                <div className="results-controls">
                  <select
                    value={filters.sort_by ?? (filters.lat !== undefined ? '' : 'name')}
                    onChange={e => update({ sort_by: e.target.value || undefined })}
                    className="filter-select"
                    style={{ width: 210 }}
                  >
                    {filters.lat !== undefined && <option value="">Nearest first</option>}
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select
                    value={filters.page_size}
                    onChange={e => update({ page_size: Number(e.target.value) })}
                    className="filter-select"
                    style={{ width: 'auto' }}
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>

              {activeChips.length > 0 && (
                <div className="active-filters" aria-label="Active filters">
                  {activeChips.map(chip => (
                    <button key={chip.key} type="button" className="filter-chip" onClick={chip.clear}>
                      {chip.label}
                      <X size={13} />
                    </button>
                  ))}
                  <button type="button" className="link-button" onClick={clearAll}>Clear all</button>
                </div>
              )}

              {activeChips.length > 0 && data.total > 100 && (
                <p className="narrowing-hint">A shorter list is easier to compare. Add a postcode, school age, or Ofsted filter to narrow the results.</p>
              )}

              <div className="cards-grid">
                {data.results.map(s => <SchoolCard key={s.urn} school={s} benchmarks={benchmarks} />)}
              </div>

              {data.total > (filters.page_size ?? 25) && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  >
                    Prev
                  </button>
                  <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
