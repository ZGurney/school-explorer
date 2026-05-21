import type { SchoolDetail } from '../../api/types'
import OfstedBadge from '../OfstedBadge'

interface Props { school: SchoolDetail }

export default function HistoryTab({ school: s }: Props) {
  if (s.inspections.length === 0) {
    return <p style={{ color: '#6b7280', marginTop: 20 }}>No inspection history available.</p>
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Ofsted inspection history</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {s.inspections.map(insp => (
          <div key={insp.id} style={{
            border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px',
            background: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  {new Date(insp.inspection_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {insp.inspection_type && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                    {insp.inspection_type}
                  </span>
                )}
              </div>
              <OfstedBadge overall={insp.overall_effectiveness_legacy} date={insp.inspection_date} size="sm" />
            </div>

            {(insp.quality_of_education || insp.behaviour_attitudes || insp.personal_development || insp.leadership_management) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                {insp.quality_of_education && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Quality of education: </span>
                    <strong>{insp.quality_of_education}</strong>
                  </div>
                )}
                {insp.behaviour_attitudes && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Behaviour: </span>
                    <strong>{insp.behaviour_attitudes}</strong>
                  </div>
                )}
                {insp.personal_development && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Personal dev: </span>
                    <strong>{insp.personal_development}</strong>
                  </div>
                )}
                {insp.leadership_management && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Leadership: </span>
                    <strong>{insp.leadership_management}</strong>
                  </div>
                )}
                {insp.sixth_form_provision && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Sixth form: </span>
                    <strong>{insp.sixth_form_provision}</strong>
                  </div>
                )}
              </div>
            )}

            {insp.report_url && (
              <div style={{ marginTop: 8 }}>
                <a href={insp.report_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2563eb' }}>
                  View report →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
