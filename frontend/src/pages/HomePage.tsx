import { useCallback, useState } from 'react'
import SchoolCard from '../components/SchoolCard'
import { useBoroughs, useSchools } from '../hooks/useSchools'
import type { SchoolFilters } from '../api/types'

const PHASES = [
  { value: '', label: 'All phases' },
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'All-through', label: 'All-through' },
  { value: '16 plus', label: 'Sixth form / 16+' },
]

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'state', label: 'State' },
  { value: 'academy', label: 'Academy' },
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
  { value: 'attainment_8', label: 'Attainment 8 (secondary)' },
  { value: 'pct_expected_rwm', label: '% Expected RWM (primary)' },
  { value: 'avg_points_per_alevel_entry', label: 'A-level points (16+)' },
]

const RADII = [0.5, 1, 2, 5, 10]

export default function HomePage() {
  const [filters, setFilters] = useState<SchoolFilters>({ page: 1, page_size: 25 })
  const [searchInput, setSearchInput] = useState('')
  const [postcodeInput, setPostcodeInput] = useState('')
  const [postcodeLabel, setPostcodeLabel] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [postcodeLoading, setPostcodeLoading] = useState(false)

  const { data, isLoading, isError } = useSchools(filters)
  const { data: boroughs } = useBoroughs()

  const update = useCallback((patch: Partial<SchoolFilters>) => {
    setFilters(f => ({ ...f, ...patch, page: 1 }))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    update({ q: searchInput || undefined })
  }

  const handlePostcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const postcode = postcodeInput.trim()
    if (!postcode) return

    setPostcodeLoading(true)
    setPostcodeError('')
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
      if (!response.ok) throw new Error('Postcode not found')
      const payload = await response.json()
      if (!payload.result?.latitude || !payload.result?.longitude) throw new Error('Postcode not found')
      setPostcodeLabel(payload.result.postcode ?? postcode.toUpperCase())
      update({
        lat: payload.result.latitude,
        lng: payload.result.longitude,
        radius_km: filters.radius_km ?? 2,
        sort_by: undefined,
      })
    } catch {
      setPostcodeError('Enter a valid UK postcode.')
    } finally {
      setPostcodeLoading(false)
    }
  }

  const clearPostcode = () => {
    setPostcodeInput('')
    setPostcodeLabel('')
    setPostcodeError('')
    update({ lat: undefined, lng: undefined, radius_km: undefined })
  }

  const totalPages = data ? Math.ceil(data.total / (filters.page_size ?? 25)) : 0
  const currentPage = filters.page ?? 1

  return (
    <div className="page">
      <div className="hero">
        <h1>London School Explorer</h1>
        <p>Browse data on 3,000+ London schools — Ofsted grades, exam results, destinations, and more.</p>
      </div>

      <div className="home-grid">
        {/* Filters sidebar */}
        <aside className="sidebar">
          <div className="sidebar-title">Filters</div>

          <form onSubmit={handleSearch} className="filter-group">
            <label className="filter-label">School name</label>
            <div className="filter-search-row">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search..."
                className="filter-input"
              />
              <button type="submit" className="btn btn-primary btn-sm">Go</button>
            </div>
          </form>

          <form onSubmit={handlePostcodeSearch} className="filter-group">
            <label className="filter-label">Near postcode</label>
            <div className="filter-search-row">
              <input
                type="text"
                value={postcodeInput}
                onChange={e => setPostcodeInput(e.target.value)}
                placeholder="e.g. N1C 4PF"
                className="filter-input"
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={postcodeLoading}>
                {postcodeLoading ? '...' : 'Go'}
              </button>
            </div>
            <select
              value={filters.radius_km ?? 2}
              onChange={e => update({ radius_km: Number(e.target.value) })}
              className="filter-select"
              style={{ marginTop: 8 }}
            >
              {RADII.map(r => <option key={r} value={r}>{r} km radius</option>)}
            </select>
            {postcodeLabel && (
              <button type="button" className="link-button" onClick={clearPostcode}>
                Clear {postcodeLabel}
              </button>
            )}
            {postcodeError && <p className="filter-error">{postcodeError}</p>}
          </form>

          <div className="filter-group">
            <label className="filter-label">Borough</label>
            <select
              value={filters.borough ?? ''}
              onChange={e => update({ borough: e.target.value || undefined })}
              className="filter-select"
            >
              <option value="">All boroughs</option>
              {boroughs?.map(b => <option key={b.la_code} value={b.la_code}>{b.la_name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Phase</label>
            <select
              value={filters.phase ?? ''}
              onChange={e => update({ phase: e.target.value || undefined })}
              className="filter-select"
            >
              {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select
              value={filters.establishment_group ?? ''}
              onChange={e => update({ establishment_group: e.target.value || undefined })}
              className="filter-select"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Gender</label>
            <select
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
              Selective (grammar)
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

          <button
            className="btn btn-ghost btn-full"
            onClick={() => { setFilters({ page: 1, page_size: 25 }); setSearchInput(''); clearPostcode() }}
          >
            Clear filters
          </button>
        </aside>

        {/* Results */}
        <div>
          {isLoading && <div className="loading">Loading schools…</div>}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <select
                    value={filters.sort_by ?? (filters.lat !== undefined ? '' : 'name')}
                    onChange={e => update({ sort_by: e.target.value || undefined })}
                    className="filter-select"
                    style={{ width: 210 }}
                  >
                    {filters.lat !== undefined && <option value="">Distance</option>}
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

              <div className="cards-grid">
                {data.results.map(s => <SchoolCard key={s.urn} school={s} />)}
              </div>

              {data.total > (filters.page_size ?? 25) && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  >
                    ← Prev
                  </button>
                  <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  >
                    Next →
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
