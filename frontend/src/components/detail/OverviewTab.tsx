import type { SchoolDetail } from '../../api/types'
import OfstedBadge from '../OfstedBadge'
import StatValue from '../StatValue'

interface Props { school: SchoolDetail }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ color: '#6b7280', paddingRight: 16, paddingBottom: 6, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
      <td style={{ paddingBottom: 6 }}>{children}</td>
    </tr>
  )
}

function groupLabel(g: string | null) {
  const map: Record<string, string> = {
    state: 'State', academy: 'Academy', free: 'Free School',
    grammar: 'Grammar', independent: 'Independent',
    sixth_form_college: 'Sixth Form College', utc: 'UTC',
    studio: 'Studio School', pru: 'PRU', state_special: 'Special',
  }
  return g ? (map[g] ?? g) : 'Not available'
}

export default function OverviewTab({ school: s }: Props) {
  const address = [s.street, s.locality, s.town, s.postcode].filter(Boolean).join(', ')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <h3 style={{ marginBottom: 12 }}>School details</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <Row label="Address">{address || 'Not available'}</Row>
            <Row label="Phase">{s.phase ?? 'Not available'}</Row>
            <Row label="Type">{groupLabel(s.establishment_group)}</Row>
            <Row label="Gender">{s.gender ?? 'Not available'}</Row>
            {s.religious_character && <Row label="Faith">{s.religious_character}</Row>}
            {s.is_selective && <Row label="Admissions">Selective</Row>}
            {s.has_sixth_form && <Row label="Sixth form">Yes</Row>}
            {s.capacity && <Row label="Capacity">{s.capacity.toLocaleString()}</Row>}
            {s.headteacher_name && <Row label="Head">{s.headteacher_name}</Row>}
            {s.website && (
              <Row label="Website">
                <a href={s.website} target="_blank" rel="noopener noreferrer">{s.website}</a>
              </Row>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>Ofsted</h3>
        <div style={{ marginBottom: 12 }}>
          <OfstedBadge overall={s.ofsted_overall} date={s.ofsted_date} />
          {s.ofsted_date && (
            <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 13 }}>
              Inspected {new Date(s.ofsted_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
        {(s.ofsted_quality || s.ofsted_behaviour || s.ofsted_personal || s.ofsted_leadership) && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {s.ofsted_quality && <Row label="Quality of education">{s.ofsted_quality}</Row>}
              {s.ofsted_behaviour && <Row label="Behaviour & attitudes">{s.ofsted_behaviour}</Row>}
              {s.ofsted_personal && <Row label="Personal development">{s.ofsted_personal}</Row>}
              {s.ofsted_leadership && <Row label="Leadership & management">{s.ofsted_leadership}</Row>}
              {s.ofsted_sixth_form && <Row label="Sixth form">{s.ofsted_sixth_form}</Row>}
            </tbody>
          </table>
        )}

        <h3 style={{ marginTop: 20, marginBottom: 12 }}>Key stats</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <Row label="Pupils"><StatValue value={s.total_pupils} decimals={0} /></Row>
            <Row label="FSM eligible">
              <StatValue value={s.pct_fsm6} suppressed={null} suffix="%" />
            </Row>
            {(s.phase === 'Secondary' || s.phase === 'All-through') && (
              <>
                <Row label="Attainment 8"><StatValue value={s.attainment_8} suppressed={s.ks4_suppressed} /></Row>
                <Row label="Progress 8"><StatValue value={s.progress_8} suppressed={s.ks4_suppressed} /></Row>
                <Row label="Grade 5+ E&M"><StatValue value={s.pct_grade5_english_maths} suppressed={s.ks4_suppressed} suffix="%" /></Row>
              </>
            )}
            {s.phase === 'Primary' && (
              <Row label="Expected RWM"><StatValue value={s.pct_expected_rwm} suppressed={s.ks2_suppressed} suffix="%" /></Row>
            )}
            {(s.has_sixth_form || s.phase === '16 plus') && (
              <Row label="Avg A-level points"><StatValue value={s.avg_points_per_alevel_entry} suppressed={s.ks5_suppressed} /></Row>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
