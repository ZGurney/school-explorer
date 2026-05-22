import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { FeatureCollection, GeoJsonProperties, Point, Polygon } from 'geojson'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { SchoolFilters, SchoolMapPoint } from '../api/types'
import { useCompareContext } from '../context/CompareContext'
import { useShortlistContext } from '../context/ShortlistContext'
import { effectiveOfstedGrade } from './OfstedBadge'

const LONDON_CENTER: [number, number] = [-0.118, 51.509]
const SELECTED_CARD_SAFE_BOTTOM = 236
const CLUSTER_PHASE_COLOR: unknown[] = [
  'case',
  ['all', ['>=', ['get', 'primary'], ['get', 'secondary']], ['>=', ['get', 'primary'], ['get', 'allThrough']], ['>=', ['get', 'primary'], ['get', 'sixth']], ['>=', ['get', 'primary'], ['get', 'special']]],
  '#2F7D6D',
  ['all', ['>=', ['get', 'secondary'], ['get', 'allThrough']], ['>=', ['get', 'secondary'], ['get', 'sixth']], ['>=', ['get', 'secondary'], ['get', 'special']]],
  '#3157A4',
  ['all', ['>=', ['get', 'allThrough'], ['get', 'sixth']], ['>=', ['get', 'allThrough'], ['get', 'special']]],
  '#7C4D9E',
  ['>=', ['get', 'sixth'], ['get', 'special']],
  '#A85E23',
  '#6B6458',
]
const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
}
const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL ?? DEFAULT_MAP_STYLE

const GROUP_LABEL: Record<string, string> = {
  state: 'State',
  academy: 'Academy',
  free: 'Free School',
  grammar: 'Grammar',
  independent: 'Independent',
  sixth_form_college: 'Sixth Form College',
  utc: 'UTC',
  studio: 'Studio School',
  pru: 'Alternative provision',
  state_special: 'Special school',
  other: 'Other',
}

const PHASE_META = {
  primary: { label: 'Primary', glyph: 'P', color: '#2F7D6D' },
  secondary: { label: 'Secondary', glyph: 'S', color: '#3157A4' },
  allThrough: { label: 'All-through', glyph: 'A', color: '#7C4D9E' },
  sixth: { label: 'Sixth form / college', glyph: '6', color: '#A85E23' },
  special: { label: 'Special / alternative', glyph: '+', color: '#6B6458' },
} as const

function phaseGroup(s: SchoolMapPoint): keyof typeof PHASE_META {
  if (s.establishment_group === 'state_special' || s.establishment_group === 'pru') return 'special'
  if (s.phase === 'Primary') return 'primary'
  if (s.phase === 'Secondary') return 'secondary'
  if (s.phase === 'All-through') return 'allThrough'
  if (s.phase === '16 plus' || s.establishment_group === 'sixth_form_college') return 'sixth'
  return 'special'
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[c] ?? c))
}

function qualityColor(s: SchoolMapPoint) {
  const grade = effectiveOfstedGrade(s.ofsted_overall, s.ofsted_quality, s.ofsted_leadership)
  if (grade === 'Outstanding') return '#1E6B3C'
  if (grade === 'Good') return '#1847A8'
  if (grade === 'Requires improvement') return '#B87008'
  if (grade === 'Inadequate') return '#C41E1E'
  return '#6B6458'
}

function qualityLabel(s: SchoolMapPoint) {
  return effectiveOfstedGrade(s.ofsted_overall, s.ofsted_quality, s.ofsted_leadership) ?? 'Not inspected'
}

function keyMetric(s: SchoolMapPoint) {
  if ((s.phase === 'Secondary' || s.phase === 'All-through') && s.attainment_8 != null) {
    return { label: 'GCSE avg score', value: s.attainment_8.toFixed(1) }
  }
  if (s.phase === 'Primary' && s.pct_expected_rwm != null) {
    return { label: 'Reading, writing & maths', value: `${s.pct_expected_rwm.toFixed(0)}%` }
  }
  if ((s.has_sixth_form || s.phase === '16 plus') && s.avg_points_per_alevel_entry != null) {
    return { label: 'A-level avg pts', value: s.avg_points_per_alevel_entry.toFixed(1) }
  }
  return null
}

function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function radiusPolygon(lng: number, lat: number, radiusKm: number): FeatureCollection<Polygon, GeoJsonProperties> {
  const points = 80
  const coords: [number, number][] = []
  const latRadians = lat * Math.PI / 180
  const kmPerDegreeLat = 110.574
  const kmPerDegreeLng = 111.32 * Math.cos(latRadians)

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2
    coords.push([
      lng + (Math.cos(angle) * radiusKm) / kmPerDegreeLng,
      lat + (Math.sin(angle) * radiusKm) / kmPerDegreeLat,
    ])
  }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    }],
  }
}

function schoolFeatures(points: SchoolMapPoint[]): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: points.map(s => ({
      type: 'Feature',
      properties: {
        urn: s.urn,
        name: s.name,
        laName: s.la_name ?? '',
        phase: s.phase ?? '',
        phaseGroup: phaseGroup(s),
        phaseLabel: PHASE_META[phaseGroup(s)].label,
        phaseGlyph: PHASE_META[phaseGroup(s)].glyph,
        phaseColor: PHASE_META[phaseGroup(s)].color,
        quality: qualityLabel(s),
        qualityColor: qualityColor(s),
      },
      geometry: {
        type: 'Point',
        coordinates: [s.lng, s.lat],
      },
    })),
  }
}

function homePoint(lng: number, lat: number): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [lng, lat] },
    }],
  }
}

function panSchoolIntoView(map: MapLibreMap, school: SchoolMapPoint) {
  const point = map.project([school.lng, school.lat])
  const canvas = map.getCanvas()
  const safe = {
    left: 48,
    right: canvas.clientWidth - 48,
    top: 64,
    bottom: canvas.clientHeight - SELECTED_CARD_SAFE_BOTTOM,
  }
  let dx = 0
  let dy = 0

  if (point.x < safe.left) dx = point.x - safe.left
  else if (point.x > safe.right) dx = point.x - safe.right
  if (point.y < safe.top) dy = point.y - safe.top
  else if (point.y > safe.bottom) dy = point.y - safe.bottom

  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 240 })
}

interface Props {
  points: SchoolMapPoint[]
  mapTotal: number
  truncated: boolean
  filters: SchoolFilters
  postcodeLabel?: string
  isLoading?: boolean
  hasLocation: boolean
  nearbyCount: number
  withinRadius: boolean
  onWithinRadiusChange: (value: boolean) => void
  selectedUrn: number | null
  onSelect: (urn: number | null) => void
}

export default function SchoolMap({
  points,
  mapTotal,
  truncated,
  filters,
  postcodeLabel,
  isLoading,
  hasLocation,
  nearbyCount,
  withinRadius,
  onWithinRadiusChange,
  selectedUrn,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const pointsRef = useRef<SchoolMapPoint[]>(points)
  const [loaded, setLoaded] = useState(false)
  const shortlist = useShortlistContext()
  const compare = useCompareContext()
  const features = useMemo(() => schoolFeatures(points), [points])
  const selected = useMemo(() => points.find(s => s.urn === selectedUrn) ?? null, [points, selectedUrn])
  const selectedMetric = selected ? keyMetric(selected) : null

  useEffect(() => {
    pointsRef.current = points
    if (selectedUrn !== null && !isLoading && !points.some(s => s.urn === selectedUrn)) onSelect(null)
  }, [isLoading, onSelect, points, selectedUrn])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: filters.lng != null && filters.lat != null ? [filters.lng, filters.lat] : LONDON_CENTER,
      zoom: filters.lng != null && filters.lat != null ? 11.6 : 9.5,
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')

    map.on('load', () => {
      map.addSource('schools', {
        type: 'geojson',
        data: features,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 30,
        clusterProperties: {
          primary: ['+', ['case', ['==', ['get', 'phaseGroup'], 'primary'], 1, 0]],
          secondary: ['+', ['case', ['==', ['get', 'phaseGroup'], 'secondary'], 1, 0]],
          allThrough: ['+', ['case', ['==', ['get', 'phaseGroup'], 'allThrough'], 1, 0]],
          sixth: ['+', ['case', ['==', ['get', 'phaseGroup'], 'sixth'], 1, 0]],
          special: ['+', ['case', ['==', ['get', 'phaseGroup'], 'special'], 1, 0]],
        },
      })

      map.addSource('search-radius', {
        type: 'geojson',
        data: filters.lng != null && filters.lat != null
          ? radiusPolygon(filters.lng, filters.lat, filters.radius_km ?? 2)
          : emptyFeatureCollection(),
      })

      map.addLayer({
        id: 'search-radius-fill',
        type: 'fill',
        source: 'search-radius',
        paint: {
          'fill-color': '#E05B2B',
          'fill-opacity': 0.08,
        },
      })

      map.addLayer({
        id: 'search-radius-line',
        type: 'line',
        source: 'search-radius',
        paint: {
          'line-color': '#E05B2B',
          'line-width': 2,
          'line-opacity': 0.55,
        },
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'schools',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': CLUSTER_PHASE_COLOR as any,
          'circle-stroke-color': '#FEFCF8',
          'circle-stroke-width': 3,
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 17, 15, 22, 60, 28],
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'schools',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Open Sans Semibold'],
        },
        paint: {
          'text-color': '#1C1917',
        },
      })

      map.addLayer({
        id: 'school-points',
        type: 'circle',
        source: 'schools',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'qualityColor'],
          'circle-radius': 9,
          'circle-stroke-color': ['get', 'phaseColor'],
          'circle-stroke-width': 3,
          'circle-opacity': 0.94,
        },
      })

      map.addLayer({
        id: 'school-phase-glyph',
        type: 'symbol',
        source: 'schools',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'phaseGlyph'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': 'rgba(28,25,23,.45)',
          'text-halo-width': 0.8,
        },
      })

      map.addLayer({
        id: 'school-name-labels',
        type: 'symbol',
        source: 'schools',
        minzoom: 12.2,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold'],
          'text-anchor': 'left',
          'text-offset': [1.1, 0],
          'text-max-width': 18,
        },
        paint: {
          'text-color': '#1C1917',
          'text-halo-color': '#FEFCF8',
          'text-halo-width': 1.5,
        },
      })

      map.addLayer({
        id: 'school-selected',
        type: 'circle',
        source: 'schools',
        filter: ['==', ['get', 'urn'], -1],
        paint: {
          'circle-color': ['get', 'qualityColor'],
          'circle-radius': 14,
          'circle-stroke-color': '#E05B2B',
          'circle-stroke-width': 5,
        },
      })

      map.addSource('home-point', {
        type: 'geojson',
        data: filters.lng != null && filters.lat != null
          ? homePoint(filters.lng, filters.lat)
          : emptyFeatureCollection(),
      })

      map.addLayer({
        id: 'home-point',
        type: 'circle',
        source: 'home-point',
        paint: {
          'circle-color': '#E05B2B',
          'circle-radius': 6,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      })

      map.on('click', 'clusters', async e => {
        const feature = e.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        const source = map.getSource('schools') as GeoJSONSource
        if (!feature || clusterId == null) return
        const zoom = await source.getClusterExpansionZoom(clusterId)
        map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom })
      })

      map.on('click', 'school-points', e => {
        const urn = Number(e.features?.[0]?.properties?.urn)
        const school = pointsRef.current.find(s => s.urn === urn)
        if (!school) return
        onSelect(school.urn)
        panSchoolIntoView(map, school)
      })

      map.on('click', e => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['school-points', 'clusters'] })
        if (hits.length === 0) onSelect(null)
      })

      for (const layer of ['clusters', 'school-points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }

      map.on('mouseenter', 'school-points', e => {
        const feature = e.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') return
        const props = feature.properties ?? {}
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          className: 'school-map-tooltip',
        })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(`
            <strong>${escapeHtml(props.name)}</strong>
            <span>${escapeHtml(props.phaseLabel)}${props.laName ? ` · ${escapeHtml(props.laName)}` : ''}</span>
          `)
          .addTo(map)
      })

      map.on('mouseleave', 'school-points', () => {
        popupRef.current?.remove()
        popupRef.current = null
      })

      setLoaded(true)
    })

    mapRef.current = map
    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const source = map.getSource('schools') as GeoJSONSource | undefined
    source?.setData(features)
  }, [features, loaded])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || !loaded) return
    map.resize()
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [loaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const radiusSource = map.getSource('search-radius') as GeoJSONSource | undefined
    const homeSource = map.getSource('home-point') as GeoJSONSource | undefined
    const hasHome = filters.lng != null && filters.lat != null

    const homeLng = filters.lng
    const homeLat = filters.lat
    radiusSource?.setData(hasHome ? radiusPolygon(homeLng!, homeLat!, filters.radius_km ?? 2) : emptyFeatureCollection())
    homeSource?.setData(hasHome ? homePoint(homeLng!, homeLat!) : emptyFeatureCollection())

    if (hasHome && withinRadius) {
      map.easeTo({ center: [homeLng!, homeLat!], zoom: Math.max(map.getZoom(), 11.2) })
    } else if (points.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      points.forEach(s => bounds.extend([s.lng, s.lat]))
      map.fitBounds(bounds, { padding: 42, maxZoom: 11.5, duration: 500 })
    }
  }, [filters.lat, filters.lng, filters.radius_km, loaded, points, withinRadius])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.setFilter('school-selected', ['==', ['get', 'urn'], selected?.urn ?? -1])
    if (selected) panSchoolIntoView(map, selected)
  }, [selected, loaded])

  return (
    <div className="school-map-shell">
      <div className="school-map-header">
        <div>
          <strong>{mapTotal.toLocaleString()} London school{mapTotal === 1 ? '' : 's'} on the map</strong>
          <span>
            {postcodeLabel
              ? `${nearbyCount.toLocaleString()} within ${(filters.radius_km ?? 2).toLocaleString()} km of ${postcodeLabel}`
              : 'Enter a postcode to add your home point and radius.'}
          </span>
        </div>
        <div className="school-map-header-actions">
          {hasLocation && (
            <button
              type="button"
              className={`filter-toggle${withinRadius ? ' filter-toggle--active' : ''}`}
              onClick={() => onWithinRadiusChange(!withinRadius)}
            >
              {withinRadius ? `Within ${(filters.radius_km ?? 2).toLocaleString()} km` : 'All London'}
            </button>
          )}
          <p>Radius shows proximity only, not catchment or admissions priority.</p>
        </div>
      </div>

      <div className="school-map-frame">
        <div ref={containerRef} className="school-map-canvas" />
        <div className="school-map-legend" aria-label="Map marker legend">
          <div>
            <strong>Type</strong>
            {Object.entries(PHASE_META).map(([key, meta]) => (
              <span key={key}><b style={{ borderColor: meta.color }}>{meta.glyph}</b>{meta.label}</span>
            ))}
          </div>
          <div>
            <strong>Inspection</strong>
            <span><i style={{ background: '#1E6B3C' }} />Outstanding</span>
            <span><i style={{ background: '#1847A8' }} />Good</span>
            <span><i style={{ background: '#B87008' }} />Requires improvement</span>
            <span><i style={{ background: '#C41E1E' }} />Inadequate</span>
            <span><i style={{ background: '#6B6458' }} />Not inspected</span>
          </div>
        </div>
        {isLoading && <div className="school-map-loading">Updating map…</div>}
        {hasLocation && truncated && (
          <div className="school-map-warning">Showing first {points.length.toLocaleString()} of {mapTotal.toLocaleString()} mapped schools. Narrow the search to see every match.</div>
        )}
        {!isLoading && points.length === 0 && (
          <div className="school-map-empty">No mapped schools match these filters.</div>
        )}

        {selected && (
          <aside className="school-map-card">
            <button className="school-map-card-close" onClick={() => onSelect(null)} aria-label="Close school preview">
              <X size={16} strokeWidth={2.5} />
            </button>
            <div className="school-map-card-top">
              <span className="map-quality-dot" style={{ background: qualityColor(selected) }} />
              <span>{qualityLabel(selected)}</span>
              {selected.distance_km != null && <span>{selected.distance_km.toFixed(1)} km</span>}
            </div>
            <Link to={`/schools/${selected.urn}`} className="school-map-card-name">{selected.name}</Link>
            <div className="school-map-card-meta">
              {[selected.la_name, selected.phase, selected.establishment_group ? GROUP_LABEL[selected.establishment_group] ?? selected.establishment_group : null, selected.postcode].filter(Boolean).join(' · ')}
            </div>
            <div className="school-map-card-footer">
              {selectedMetric ? (
                <div>
                  <span>{selectedMetric.label}</span>
                  <strong>{selectedMetric.value}</strong>
                </div>
              ) : (
                <div>
                  <span>Pupils</span>
                  <strong>{selected.total_pupils?.toLocaleString() ?? 'n/a'}</strong>
                </div>
              )}
              <div className="school-map-card-actions">
                <Link className="btn btn-sm btn-primary" to={`/schools/${selected.urn}`}>
                  View profile →
                </Link>
                <button
                  className={`btn btn-sm ${shortlist.isSaved(selected.urn) ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => shortlist.toggle(selected.urn, selected.name)}
                >
                  {shortlist.isSaved(selected.urn) ? 'Saved' : 'Save'}
                </button>
                <button
                  className={`btn btn-sm ${compare.isSelected(selected.urn) ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => compare.toggle(selected.urn, selected.name)}
                >
                  {compare.isSelected(selected.urn) ? 'In compare' : 'Compare'}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
