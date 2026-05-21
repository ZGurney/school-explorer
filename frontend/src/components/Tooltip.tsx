import { useCallback, useRef, useState } from 'react'

export default function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const show = useCallback(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      const bubbleHalfWidth = 130
      const left = Math.min(
        window.innerWidth - bubbleHalfWidth - 8,
        Math.max(bubbleHalfWidth + 8, r.left + r.width / 2),
      )
      setPos({ top: r.top - 8, left })
    }
    setOpen(true)
  }, [])

  const hide = useCallback(() => setOpen(false), [])

  return (
    <span
      ref={ref}
      className={`tooltip-wrap${open ? ' open' : ''}`}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => open ? hide() : show()}
    >
      {children}
      <span className="tooltip-bubble" role="tooltip" style={{ top: pos.top, left: pos.left }}>{text}</span>
    </span>
  )
}
