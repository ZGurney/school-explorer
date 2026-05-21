import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SchoolDetail } from '../../api/types'

interface Props { school: SchoolDetail }

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#6b7280']

export default function DestinationsTab({ school: s }: Props) {
  const ks4 = s.destinations_ks4_history[0]
  const ks5 = s.destinations_ks5_history[0]

  const ks4ChartData = ks4 ? [
    { name: 'School 6th form', value: ks4.pct_school_sixth_form },
    { name: '6th form college', value: ks4.pct_sixth_form_college },
    { name: 'FE college', value: ks4.pct_fe_college },
    { name: 'Apprenticeship', value: ks4.pct_apprenticeship },
    { name: 'Employment', value: ks4.pct_employment },
    { name: 'Not captured', value: ks4.pct_not_captured },
  ].filter(d => d.value !== null) as { name: string; value: number }[] : []

  const ks5ChartData = ks5 ? [
    { name: 'Higher education', value: ks5.pct_higher_education },
    { name: 'Further education', value: ks5.pct_further_education },
    { name: 'Apprenticeship L3', value: ks5.pct_apprenticeship_l3 },
    { name: 'Apprenticeship L2', value: ks5.pct_apprenticeship_l2 },
    { name: 'Apprenticeship L4+', value: ks5.pct_apprenticeship_l4_plus },
    { name: 'Employment', value: ks5.pct_employment },
    { name: 'Not captured', value: ks5.pct_not_captured },
  ].filter(d => d.value !== null) as { name: string; value: number }[] : []

  if (!ks4 && !ks5) {
    if (s.phase === 'Primary') {
      return (
        <p style={{ color: '#6b7280', marginTop: 20 }}>
          Destinations data tracks where pupils go after Year 11 or after sixth form. This data is only collected for secondary schools and sixth forms.
        </p>
      )
    }
    return <p style={{ color: '#6b7280', marginTop: 20 }}>No destinations data available for this school.</p>
  }

  return (
    <div>
      {ks4 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 4 }}>KS4 destinations</h3>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
            {ks4.cohort_year} leavers, measured {ks4.destination_year}
            {ks4.cohort_size ? ` · ${ks4.cohort_size} pupils` : ''}
            {ks4.pct_sustained !== null ? ` · ${ks4.pct_sustained.toFixed(1)}% sustained destination` : ''}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ks4ChartData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit="%" tick={{ fontSize: 12 }} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {ks4ChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {ks5 && (
        <div>
          <h3 style={{ marginBottom: 4 }}>KS5 destinations</h3>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
            {ks5.cohort_year} leavers, measured {ks5.destination_year}
            {ks5.cohort_size ? ` · ${ks5.cohort_size} students` : ''}
            {ks5.pct_sustained !== null ? ` · ${ks5.pct_sustained.toFixed(1)}% sustained destination` : ''}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ks5ChartData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit="%" tick={{ fontSize: 12 }} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {ks5ChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
