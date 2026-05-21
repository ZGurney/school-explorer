import type { SchoolDetail } from '../../api/types'
import { GLOSSARY } from '../../utils/glossary'
import StatValue from '../StatValue'
import Tooltip from '../Tooltip'

interface Props { school: SchoolDetail }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 10, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
      <span style={{ color: '#374151' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{children}</span>
    </div>
  )
}

export default function ContextTab({ school: s }: Props) {
  const pupils = s.pupils_history[0]
  const workforce = s.workforce_history[0]
  const financials = s.financials_history[0]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <Section title={`Pupils${pupils ? ` (${pupils.academic_year})` : ''}`}>
          <Row label="Total pupils"><StatValue value={s.total_pupils} decimals={0} /></Row>
          <Row label={<Tooltip text={GLOSSARY['FSM eligible']}>FSM eligible (6yr)</Tooltip>}><StatValue value={s.pct_fsm6} suffix="%" /></Row>
          <Row label={<Tooltip text={GLOSSARY.EAL}>EAL pupils</Tooltip>}><StatValue value={s.pct_eal} suffix="%" /></Row>
          <Row label={<Tooltip text={GLOSSARY['SEN / EHCP']}>SEN (EHCP)</Tooltip>}><StatValue value={s.pct_sen_ehcp} suffix="%" /></Row>
          <Row label="Absence rate"><StatValue value={s.pct_absence_overall} suffix="%" /></Row>
        </Section>

        <Section title={`Workforce${workforce ? ` (${workforce.academic_year})` : ''}`}>
          <Row label="Pupil–teacher ratio"><StatValue value={s.pupil_teacher_ratio} /></Row>
          <Row label="FTE teachers"><StatValue value={s.fte_teachers} /></Row>
          <Row label="Qualified teachers"><StatValue value={s.pct_qualified_teachers} suffix="%" /></Row>
        </Section>
      </div>

      <div>
        <Section title={`Financials${financials ? ` (${financials.financial_year})` : ''}`}>
          <Row label="Income per pupil">
            {s.income_per_pupil !== null ? `£${s.income_per_pupil.toLocaleString()}` : <span style={{ color: '#9ca3af' }}>Not available</span>}
          </Row>
          <Row label="Expenditure per pupil">
            {s.expenditure_per_pupil !== null ? `£${s.expenditure_per_pupil.toLocaleString()}` : <span style={{ color: '#9ca3af' }}>Not available</span>}
          </Row>
          <Row label="Balance per pupil">
            {s.balance_per_pupil !== null ? (
              <span style={{ color: s.in_deficit ? '#dc2626' : '#16a34a' }}>
                {s.in_deficit ? '–' : '+'}£{Math.abs(s.balance_per_pupil).toLocaleString()}
                {s.in_deficit ? ' (deficit)' : ' (surplus)'}
              </span>
            ) : <span style={{ color: '#9ca3af' }}>Not available</span>}
          </Row>
        </Section>

        {s.financials_history.length > 1 && (
          <Section title="Financial history">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '5px 6px', fontSize: 12 }}>Year</th>
                  <th style={{ textAlign: 'right', padding: '5px 6px', fontSize: 12 }}>Income/pupil</th>
                  <th style={{ textAlign: 'right', padding: '5px 6px', fontSize: 12 }}>Spend/pupil</th>
                  <th style={{ textAlign: 'right', padding: '5px 6px', fontSize: 12 }}>Balance/pupil</th>
                </tr>
              </thead>
              <tbody>
                {s.financials_history.map(f => (
                  <tr key={f.financial_year} style={{ borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <td style={{ padding: '5px 6px' }}>{f.financial_year}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{f.income_per_pupil !== null ? `£${f.income_per_pupil.toLocaleString()}` : '–'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{f.expenditure_per_pupil !== null ? `£${f.expenditure_per_pupil.toLocaleString()}` : '–'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: f.in_deficit ? '#dc2626' : '#16a34a' }}>
                      {f.balance_per_pupil !== null ? `${f.in_deficit ? '-' : '+'}£${Math.abs(f.balance_per_pupil).toLocaleString()}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </div>
  )
}
