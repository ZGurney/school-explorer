import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { Borough, PaginatedSchools, SchoolDetail, SchoolFilters } from '../api/types'

export function useSchools(filters: SchoolFilters) {
  return useQuery<PaginatedSchools>({
    queryKey: ['schools', filters],
    queryFn: () => api.get('/schools', { params: filters }).then(r => r.data),
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
