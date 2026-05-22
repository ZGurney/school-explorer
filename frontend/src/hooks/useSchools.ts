import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { BenchmarkSummary, Borough, PaginatedSchools, SchoolDetail, SchoolFilters, SchoolMapResponse } from '../api/types'

export function useSchools(filters: SchoolFilters) {
  return useQuery<PaginatedSchools>({
    queryKey: ['schools', filters],
    queryFn: () => api.get('/schools', { params: filters }).then(r => r.data),
  })
}

export function useSchoolMapPoints(filters: SchoolFilters, enabled = true, withinRadius = false) {
  const { page, page_size, sort_by, ...mapFilters } = filters
  return useQuery<SchoolMapResponse>({
    queryKey: ['schools-map', mapFilters, withinRadius],
    queryFn: () => api.get('/schools/map', { params: { ...mapFilters, within_radius: withinRadius || undefined } }).then(r => r.data),
    enabled,
  })
}

export function useSchool(urn: number | undefined) {
  return useQuery<SchoolDetail>({
    queryKey: ['school', urn],
    queryFn: () => api.get(`/schools/${urn}`).then(r => r.data),
    enabled: urn !== undefined,
  })
}

export function useCompare(urns: number[]) {
  return useQuery<SchoolDetail[]>({
    queryKey: ['compare', urns],
    queryFn: async () => {
      if (urns.length < 2) return []
      const [first, ...rest] = urns
      const r = await api.get(`/schools/${first}/compare`, { params: { urns: rest.join(',') } })
      return r.data
    },
    enabled: urns.length >= 2,
  })
}

export function useBoroughs() {
  return useQuery<Borough[]>({
    queryKey: ['boroughs'],
    queryFn: () => api.get('/boroughs').then(r => r.data),
    staleTime: Infinity,
  })
}

export function useBenchmarks() {
  return useQuery<BenchmarkSummary>({
    queryKey: ['benchmarks'],
    queryFn: () => api.get('/benchmarks').then(r => r.data),
    staleTime: 24 * 60 * 60 * 1000,
  })
}
