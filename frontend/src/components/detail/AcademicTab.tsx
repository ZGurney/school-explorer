import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SchoolDetail } from '../../api/types'
import { useBenchmarks } from '../../hooks/useSchools'
import { GLOSSARY } from '../../utils/glossary'
import StatValue from '../StatValue'
import LabelTooltip from '../Tooltip'

interface Props { school: SchoolDetail }

function SectionHeader({ title }: { title: string }) {
  return <h3 style={{ marginTop: 24, marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>{title}</h3>
}

export default function AcademicTab({ school: s }: Props) {
  const ks4Data = [...s.performance_ks4_history].reverse()
  const ks5Data = [...s.performance_ks5_history].reverse()
  const ks2Data = [...s.performance_ks2_history].reverse()
  const { data: benchmarks } = useBenchmarks()

  return (
    <div>
      {/* KS4 */}
      {s.performance_ks4_history.length > 0 && (
        <>
          <SectionHeader title="GCSE results (KS4)" />
          {ks4Data.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ks4Data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academic_year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {benchmarks?.ks4_attainment_8 !== null && benchmarks?.ks4_attainment_8 !== undefined && (
                  <ReferenceLine y={benchmarks.ks4_attainment_8} stroke="#6b7280" strokeDasharray="5 5" label="London avg A8" />
                )}
                <Line type="monotone" dataKey="attainment_8" name="GCSE average score" stroke="#2563eb" dot />
                <Line type="monotone" dataKey="progress_8" name="Pupil progress score" stroke="#16a34a" dot />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 13 }}>Year</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}><LabelTooltip text={GLOSSARY['Attainment 8']}>GCSE average score</LabelTooltip></th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}><LabelTooltip text={GLOSSARY['Progress 8']}>Pupil progress</LabelTooltip></th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}><LabelTooltip text="The confidence interval around the progress score.">Progress range</LabelTooltip></th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}><LabelTooltip text={GLOSSARY['Grade 5+ E&M']}>Strong English & Maths</LabelTooltip></th>
              </tr>
            </thead>
            <tbody>
              {s.performance_ks4_history.map(r => (
                <tr key={r.academic_year} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>{r.academic_year}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.attainment_8} suppressed={r.suppressed} />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.progress_8} suppressed={r.suppressed} />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right', color: '#6b7280' }}>
                    {r.progress_8_lower_ci !== null && r.progress_8_upper_ci !== null
                      ? `[${r.progress_8_lower_ci.toFixed(2)}, ${r.progress_8_upper_ci.toFixed(2)}]`
                      : '–'}
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.pct_grade5_english_maths} suppressed={r.suppressed} suffix="%" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* KS5 */}
      {s.performance_ks5_history.length > 0 && (
        <>
          <SectionHeader title="A-level & post-16 results (KS5)" />
          {ks5Data.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ks5Data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academic_year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {benchmarks?.ks5_avg_points !== null && benchmarks?.ks5_avg_points !== undefined && (
                  <ReferenceLine y={benchmarks.ks5_avg_points} stroke="#6b7280" strokeDasharray="5 5" label="London avg" />
                )}
                <Line type="monotone" dataKey="avg_points_per_alevel_entry" name="Avg points/A-level" stroke="#2563eb" dot />
                <Line type="monotone" dataKey="pct_astar_or_a" name="% A*–A" stroke="#16a34a" dot />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 13 }}>Year</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>Avg pts/entry</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>% A*–B (A-level)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>% A*–A</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>Cohort</th>
              </tr>
            </thead>
            <tbody>
              {s.performance_ks5_history.map(r => (
                <tr key={r.academic_year} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>{r.academic_year}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.avg_points_per_alevel_entry} suppressed={r.suppressed} />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.pct_astar_to_b} suppressed={r.suppressed} suffix="%" />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.pct_astar_or_a} suppressed={r.suppressed} suffix="%" />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right', color: '#6b7280' }}>
                    {r.total_cohort ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* KS2 */}
      {s.performance_ks2_history.length > 0 && (
        <>
          <SectionHeader title="Primary results (KS2)" />
          {ks2Data.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ks2Data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academic_year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {benchmarks?.ks2_pct_expected_rwm !== null && benchmarks?.ks2_pct_expected_rwm !== undefined && (
                  <ReferenceLine y={benchmarks.ks2_pct_expected_rwm} stroke="#6b7280" strokeDasharray="5 5" label="London avg" />
                )}
                <Line type="monotone" dataKey="pct_expected_rwm" name="Reading, writing & maths" stroke="#2563eb" dot />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 13 }}>Year</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}><LabelTooltip text={GLOSSARY.RWM}>Reading, writing & maths</LabelTooltip></th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>Exceeded expectations %</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 13 }}>Progress (R/W/M)</th>
              </tr>
            </thead>
            <tbody>
              {s.performance_ks2_history.map(r => (
                <tr key={r.academic_year} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>{r.academic_year}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.pct_expected_rwm} suppressed={r.suppressed} suffix="%" />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }}>
                    <StatValue value={r.pct_greater_depth_rwm} suppressed={r.suppressed} suffix="%" />
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right', color: '#6b7280' }}>
                    {r.progress_reading !== null ? `${r.progress_reading.toFixed(1)} / ${r.progress_writing?.toFixed(1)} / ${r.progress_maths?.toFixed(1)}` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {s.performance_ks4_history.length === 0 && s.performance_ks5_history.length === 0 && s.performance_ks2_history.length === 0 && (
        <p style={{ color: '#6b7280', marginTop: 20 }}>No academic performance data available for this school.</p>
      )}
    </div>
  )
}
