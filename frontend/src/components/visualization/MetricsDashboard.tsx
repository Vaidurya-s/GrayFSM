import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import type { OptimizationResponse } from '../../types/fsm';

interface MetricsDashboardProps {
  metrics: OptimizationResponse;
}

const PIE_COLORS = ['#3b82f6', '#f97316'];
const RADAR_COLOR = '#6366f1';

interface SummaryCardProps {
  value: string | number;
  label: string;
  sub?: string;
  accent?: 'green' | 'orange' | 'blue' | 'purple' | 'default';
}

function SummaryCard({ value, label, sub, accent = 'default' }: SummaryCardProps) {
  const accentMap: Record<NonNullable<SummaryCardProps['accent']>, string> = {
    green: 'bg-teal-50 border-teal-200 text-teal-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    default: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  const subMap: Record<NonNullable<SummaryCardProps['accent']>, string> = {
    green: 'text-teal-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    default: 'text-gray-500',
  };

  return (
    <div className={`border rounded-xl p-4 text-center ${accentMap[accent]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className={`text-xs mt-1 ${subMap[accent]}`}>{sub}</div>}
    </div>
  );
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const {
    total_states,
    dummy_states_added,
    improvement_percentage,
    execution_time_ms,
    algorithm,
    metrics: innerMetrics,
    encoding_map,
  } = metrics;

  const originalStateCount = total_states - dummy_states_added;

  // --- Hamming distance distribution chart data ---
  const hammingDistData = [
    {
      name: 'Avg Hamming',
      Before: Number(innerMetrics.avg_hamming_before.toFixed(3)),
      After: Number(innerMetrics.avg_hamming_after.toFixed(3)),
    },
    {
      name: 'Max Hamming',
      Before: Number(innerMetrics.max_hamming_before.toFixed(3)),
      After: Number(innerMetrics.max_hamming_after.toFixed(3)),
    },
  ];

  // --- Radar chart data (normalized 0–1 for visual clarity) ---
  const maxHamming = Math.max(
    innerMetrics.max_hamming_before,
    innerMetrics.max_hamming_after,
    1
  );
  const radarData = [
    {
      subject: 'Avg Hamming',
      value: Number((innerMetrics.avg_hamming_after / maxHamming).toFixed(3)),
      fullMark: 1,
    },
    {
      subject: 'Max Hamming',
      value: Number((innerMetrics.max_hamming_after / maxHamming).toFixed(3)),
      fullMark: 1,
    },
    {
      subject: 'Improvement',
      value: Number((improvement_percentage / 100).toFixed(3)),
      fullMark: 1,
    },
    {
      subject: 'Dummy %',
      value:
        total_states > 0
          ? Number((dummy_states_added / total_states).toFixed(3))
          : 0,
      fullMark: 1,
    },
    {
      subject: 'States Kept',
      value:
        total_states > 0
          ? Number((originalStateCount / total_states).toFixed(3))
          : 1,
      fullMark: 1,
    },
  ];

  // --- Pie chart for state composition ---
  const pieData = [
    { name: 'Original States', value: originalStateCount },
    { name: 'Dummy States', value: dummy_states_added },
  ];

  // --- Encoding table rows ---
  const encodingRows = encoding_map ? Object.entries(encoding_map) : [];

  // --- Transition matrix from encoding_map keys (simple presence matrix) ---
  // We show a heatmap of Hamming distance between each pair of encodings
  const encodingEntries = encoding_map ? Object.entries(encoding_map) : [];

  function hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return -1;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }

  // Build a flat list of {row, col, value} for the heatmap table
  const maxHammingPossible = encodingEntries[0]?.[1]?.length ?? 1;

  return (
    <div className="space-y-6" data-testid="metrics-dashboard">
      {/* Algorithm badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Optimization Metrics</h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 uppercase tracking-wide">
          {algorithm}
        </span>
      </div>

      {/* Section a: Summary cards */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            value={total_states}
            label="Total States"
            sub={`${originalStateCount} original`}
            accent="blue"
          />
          <SummaryCard
            value={dummy_states_added}
            label="Dummy States"
            sub="added for Gray code"
            accent="orange"
          />
          <SummaryCard
            value={`${improvement_percentage.toFixed(1)}%`}
            label="Improvement"
            sub="Hamming distance"
            accent="green"
          />
          <SummaryCard
            value={`${execution_time_ms.toFixed(1)} ms`}
            label="Execution Time"
            sub="algorithm runtime"
            accent="purple"
          />
        </div>
      </div>

      {/* Section b: Hamming distance distribution chart */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Hamming Distance — Before vs After
        </h4>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hammingDistData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Before" fill="#E69F00" name="Before" radius={[4, 4, 0, 0]} />
              <Bar dataKey="After" fill="#0072B2" name="After" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row: Radar + Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar chart */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Optimization Profile
          </h4>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 1]}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickCount={3}
                />
                <Radar
                  name="Optimized"
                  dataKey="value"
                  stroke={RADAR_COLOR}
                  fill={RADAR_COLOR}
                  fillOpacity={0.25}
                  dot={{ r: 3, fill: RADAR_COLOR }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: number) => v.toFixed(3)}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            State Composition
          </h4>
          <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section c: State encoding table */}
      {encodingRows.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            State Encoding Map
          </h4>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Gray Code
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Bit Width
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {encodingRows.map(([stateName, grayCode], idx) => (
                  <tr
                    key={stateName}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-800">{stateName}</td>
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {grayCode}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                      {grayCode.length} bit{grayCode.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section d: Transition matrix heatmap */}
      {encodingEntries.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Hamming Distance Matrix (State Pairs)
          </h4>
          <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-20 bg-gray-50 px-2 py-1.5 text-gray-400 font-medium border border-gray-100 sticky left-0 z-10">
                    &nbsp;
                  </th>
                  {encodingEntries.map(([name]) => (
                    <th
                      key={name}
                      className="px-2 py-1.5 bg-gray-50 text-gray-600 font-medium border border-gray-100 whitespace-nowrap"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {encodingEntries.map(([rowName, rowCode]) => (
                  <tr key={rowName}>
                    <td className="px-2 py-1.5 bg-gray-50 text-gray-600 font-medium border border-gray-100 sticky left-0 whitespace-nowrap">
                      {rowName}
                    </td>
                    {encodingEntries.map(([colName, colCode]) => {
                      const dist = hammingDistance(rowCode, colCode);
                      const isDiag = rowName === colName;
                      const intensity =
                        isDiag || maxHammingPossible === 0
                          ? 0
                          : dist / maxHammingPossible;
                      // Map intensity to a color: 0 = white, 1 = deep orange (Okabe-Ito vermillion)
                      // Interpolate white (#ffffff) → vermillion (#D55E00)
                      const r = Math.round(255 - intensity * (255 - 213));
                      const g = Math.round(255 - intensity * (255 - 94));
                      const b = Math.round(255 - intensity * 255);
                      const bgStyle = isDiag
                        ? { backgroundColor: '#f3f4f6' }
                        : { backgroundColor: `rgb(${r},${g},${b})` };
                      return (
                        <td
                          key={colName}
                          className="px-2 py-1.5 text-center border border-gray-100 font-mono"
                          style={bgStyle}
                          title={`${rowName} ↔ ${colName}: Hamming ${dist}`}
                        >
                          {isDiag ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span
                              className={dist === 1 ? 'font-semibold' : 'text-gray-700'}
                            style={dist === 1 ? { color: '#009E73' } : undefined}
                            >
                              {dist}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#009E73', border: '1px solid #007a59' }} />
                Distance = 1 (ideal Gray transition)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#f5c49a', border: '1px solid #D55E00' }} />
                Higher distance
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
