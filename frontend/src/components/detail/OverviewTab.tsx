import type { SchoolDetail } from '../../api/types'
import { useBenchmarks } from '../../hooks/useSchools'
import { GLOSSARY } from '../../utils/glossary'
import OfstedBadge from '../OfstedBadge'
import StatValue from '../StatValue'
import Tooltip from '../Tooltip'

interface Props { school: SchoolDetail }

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ color: '#6b7280', paddingRight: 16, paddingBottom: 6, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
      <td style={{ paddingBottom: 6 }}>{children}</td>
    </tr>
  )
}

function AvgValue({ value, suffix = '' }: { value: number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) return <span style={{ color: '#9ca3af' }}>–</span>
  return <>{value.toFixed(suffix ? 0 : 1)}{suffix}</>
}

function StatRow({ label, tip, value, avg, suffix = '', suppressed, decimals }: {
  label: string
  tip?: string
  value: number | null | undefined
  avg?: number | null
  suffix?: string
  suppressed?: boolean | null
  decimals?: number
}) {
  return (
    <tr>
      <td style={{ color: '#6b7280', paddingRight: 16, paddingBottom: 6, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
        {tip ? <Tooltip text={tip}>{label}</Tooltip> : label}
      </td>
      <td style={{ paddingBottom: 6, textAlign: 'right' }}><StatValue value={value} suppressed={suppressed} suffix={suffix} decimals={decimals} /></td>
      <td style={{ paddingBottom: 6, textAlign: 'right', color: '#6b7280' }}><AvgValue value={avg} suffix={suffix} /></td>
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
  const { data: benchmarks } = useBenchmarks()

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
            {s.telephone && <Row label="Telephone"><a href={`tel:${s.telephone}`}>{s.telephone}</a></Row>}
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
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: '#6b7280', fontSize: 12, fontWeight: 600, paddingBottom: 6 }}>Metric</th>
              <th style={{ textAlign: 'right', color: '#6b7280', fontSize: 12, fontWeight: 600, paddingBottom: 6 }}>School</th>
              <th style={{ textAlign: 'right', color: '#6b7280', fontSize: 12, fontWeight: 600, paddingBottom: 6 }}>London avg</th>
            </tr>
          </thead>
          <tbody>
            <StatRow label="Pupils" value={s.total_pupils} decimals={0} />
            <StatRow label="FSM eligible" tip={GLOSSARY['FSM eligible']} value={s.pct_fsm6} suffix="%" />
            {(s.phase === 'Secondary' || s.phase === 'All-through') && (
              <>
                <StatRow label="Attainment 8" tip={GLOSSARY['Attainment 8']} value={s.attainment_8} avg={benchmarks?.ks4_attainment_8} suppressed={s.ks4_suppressed} />
                <StatRow label="Progress 8" tip={GLOSSARY['Progress 8']} value={s.progress_8} avg={benchmarks?.ks4_progress_8} suppressed={s.ks4_suppressed} />
                <StatRow label="Grade 5+ E&M" tip={GLOSSARY['Grade 5+ E&M']} value={s.pct_grade5_english_maths} avg={benchmarks?.ks4_pct_grade5_english_maths} suppressed={s.ks4_suppressed} suffix="%" />
              </>
            )}
            {s.phase === 'Primary' && (
              <StatRow label="Expected RWM" tip={GLOSSARY.RWM} value={s.pct_expected_rwm} avg={benchmarks?.ks2_pct_expected_rwm} suppressed={s.ks2_suppressed} suffix="%" />
            )}
            {(s.has_sixth_form || s.phase === '16 plus') && (
              <StatRow label="Avg A-level points" value={s.avg_points_per_alevel_entry} avg={benchmarks?.ks5_avg_points} suppressed={s.ks5_suppressed} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
