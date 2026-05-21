import { createContext, useCallback, useContext, useState } from 'react'

interface CompareEntry { urn: number; name: string }

interface CompareCtx {
  selected: CompareEntry[]
  add: (urn: number, name: string) => void
  toggle: (urn: number, name: string) => void
  remove: (urn: number) => void
  clear: () => void
  isSelected: (urn: number) => boolean
}

const CompareContext = createContext<CompareCtx | null>(null)

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<CompareEntry[]>([])

  const add = useCallback((urn: number, name: string) => {
    setSelected(prev => {
      if (prev.some(e => e.urn === urn) || prev.length >= 5) return prev
      return [...prev, { urn, name }]
    })
  }, [])

  const toggle = useCallback((urn: number, name: string) => {
    setSelected(prev => {
      if (prev.some(e => e.urn === urn)) return prev.filter(e => e.urn !== urn)
      if (prev.length >= 5) return prev
      return [...prev, { urn, name }]
    })
  }, [])

  const remove = useCallback((urn: number) => {
    setSelected(prev => prev.filter(e => e.urn !== urn))
  }, [])

  const clear = useCallback(() => setSelected([]), [])

  const isSelected = useCallback((urn: number) => selected.some(e => e.urn === urn), [selected])

  return (
    <CompareContext.Provider value={{ selected, add, toggle, remove, clear, isSelected }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompareContext() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompareContext must be inside CompareProvider')
  return ctx
}
