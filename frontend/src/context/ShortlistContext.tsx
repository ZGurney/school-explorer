import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface ShortlistEntry {
  urn: number
  name: string
}

interface ShortlistCtx {
  saved: ShortlistEntry[]
  toggle: (urn: number, name: string) => void
  remove: (urn: number) => void
  isSaved: (urn: number) => boolean
}

const ShortlistContext = createContext<ShortlistCtx | null>(null)

function loadInitial() {
  try {
    const raw = localStorage.getItem('shortlist')
    return raw ? JSON.parse(raw) as ShortlistEntry[] : []
  } catch {
    return []
  }
}

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<ShortlistEntry[]>(loadInitial)

  useEffect(() => {
    localStorage.setItem('shortlist', JSON.stringify(saved))
  }, [saved])

  const toggle = useCallback((urn: number, name: string) => {
    setSaved(prev => {
      if (prev.some(e => e.urn === urn)) return prev.filter(e => e.urn !== urn)
      if (prev.length >= 20) return prev
      return [...prev, { urn, name }]
    })
  }, [])

  const remove = useCallback((urn: number) => {
    setSaved(prev => prev.filter(e => e.urn !== urn))
  }, [])

  const isSaved = useCallback((urn: number) => saved.some(e => e.urn === urn), [saved])

  return (
    <ShortlistContext.Provider value={{ saved, toggle, remove, isSaved }}>
      {children}
    </ShortlistContext.Provider>
  )
}

export function useShortlistContext() {
  const ctx = useContext(ShortlistContext)
  if (!ctx) throw new Error('useShortlistContext must be inside ShortlistProvider')
  return ctx
}
