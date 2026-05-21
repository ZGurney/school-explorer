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
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginRight: 4, flexShrink: 0 }}>
          {selected.length}/5
        </span>
        {selected.map(s => (
          <span key={s.urn} className="compare-chip">
            {s.name}
            <button onClick={() => remove(s.urn)} title="Remove">×</button>
          </span>
        ))}
      </div>
      <div className="compare-bar-actions">
        {!canCompare && <span className="compare-hint">Add {2 - selected.length} more to compare</span>}
        <button className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.2)' }} onClick={clear}>
          Clear
        </button>
        <button
          className="btn-compare"
          disabled={!canCompare}
          onClick={() => navigate(`/compare?urns=${selected.map(s => s.urn).join(',')}`)}
        >
          Compare {selected.length} schools →
        </button>
      </div>
    </div>
  )
}
