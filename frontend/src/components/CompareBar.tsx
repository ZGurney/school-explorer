import { useNavigate } from 'react-router-dom'
import { useCompareContext } from '../context/CompareContext'

export default function CompareBar() {
  const { selected, remove, clear } = useCompareContext()
  const navigate = useNavigate()

  if (selected.length === 0) return null

  const canCompare = selected.length >= 2

  return (
    <div className="compare-bar">
      <div className="compare-bar-schools">
        <span className="compare-count">{selected.length}/5</span>
        {selected.map(s => (
          <span key={s.urn} className="compare-chip">
            {s.name}
            <button onClick={() => remove(s.urn)} aria-label={`Remove ${s.name}`}>×</button>
          </span>
        ))}
      </div>
      <div className="compare-bar-actions">
        {!canCompare && (
          <span className="compare-hint">Add {2 - selected.length} more to compare</span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.18)' }}
          onClick={clear}
        >
          Clear
        </button>
        <button
          className="btn-compare-go"
          disabled={!canCompare}
          onClick={() => navigate(`/compare?urns=${selected.map(s => s.urn).join(',')}`)}
        >
          Compare {selected.length} schools →
        </button>
      </div>
    </div>
  )
}
