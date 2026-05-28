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
import { useThemeColors, type ThemeColors } from './use-theme-colors';

interface MetricsDashboardProps {
  metrics: OptimizationResponse;
}

/* -------------------------------------------------------------------------- *
 * MetricsDashboard — datasheet lab-report layout                             *
 * -------------------------------------------------------------------------- */

interface SummaryCardProps {
  value: string | number;
  label: string;
  sub?: string;
  tone?: 'accent' | 'ok' | 'warn' | 'err' | 'default';
}

function SummaryCard({ value, label, sub, tone = 'default' }: SummaryCardProps) {
  const toneClass = {
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    err: 'text-err',
    default: 'text-ink',
  }[tone];
  return (
    <div className="bg-paper border border-rule p-4 text-center">
      <div className={`font-mono font-tabular text-2xl leading-none mb-2 ${toneClass}`}>
        {value}
      </div>
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </div>
      {sub && (
        <div className="font-serif italic text-[0.78rem] text-ink-soft mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink mb-3 pb-1 border-b border-rule">
      {children}
    </h4>
  );
}

function chartTooltipStyle(colors: ThemeColors): React.CSSProperties {
  return {
    background: colors.paper,
    border: `1px solid ${colors.ink}`,
    borderRadius: 0,
    fontSize: 12,
    fontFamily: 'IBM Plex Mono, monospace',
    color: colors.ink,
  };
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const colors = useThemeColors();

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
  // Guard against missing fields so the dashboard renders 0 instead of
  // crashing when an optimization result lacks a metrics object.
  const fixed3 = (v: number | undefined): number => Number((v ?? 0).toFixed(3));
  const hammingDistData = [
    {
      name: 'Avg Hamming',
      Before: fixed3(innerMetrics?.avg_hamming_before),
      After: fixed3(innerMetrics?.avg_hamming_after),
    },
    {
      name: 'Max Hamming',
      Before: fixed3(innerMetrics?.max_hamming_before),
      After: fixed3(innerMetrics?.max_hamming_after),
    },
  ];

  // --- Radar chart data (normalized 0–1 for visual clarity) ---
  const maxHamming = Math.max(
    innerMetrics.max_hamming_before,
    innerMetrics.max_hamming_after,
    1,
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
        total_states === 0
          ? 0
          : Number((dummy_states_added / total_states).toFixed(3)),
      fullMark: 1,
    },
  ];

  // --- Pie chart data ---
  const pieData = [
    { name: 'Original States', value: originalStateCount },
    { name: 'Dummy States', value: dummy_states_added },
  ];
  const PIE_COLORS = [colors.accent, colors.warn];
  const RADAR_COLOR = colors.accent;

  // --- Encoding table rows ---
  const encodingRows = encoding_map ? Object.entries(encoding_map) : [];
  const encodingEntries = encodingRows;

  function hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return -1;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }

  const maxHammingPossible = encodingEntries[0]?.[1]?.length ?? 1;

  // Heatmap colour: interpolate from paper-shade (low) toward warn (high).
  // Diagonal cells get a flat paper-deep (no comparison).
  const heatColor = (intensity: number): string => {
    if (intensity <= 0) return colors.paperDeep;
    // Parse paper-shade and warn from the theme as RGB triples.
    const fromHex = (h: string) => {
      const v = h.replace('#', '');
      const n = v.length === 3
        ? v
            .split('')
            .map((c) => c + c)
            .join('')
        : v;
      return [
        parseInt(n.slice(0, 2), 16),
        parseInt(n.slice(2, 4), 16),
        parseInt(n.slice(4, 6), 16),
      ];
    };
    try {
      const [r1, g1, b1] = fromHex(colors.paperShade);
      const [r2, g2, b2] = fromHex(colors.warn);
      const r = Math.round(r1 + (r2 - r1) * intensity);
      const g = Math.round(g1 + (g2 - g1) * intensity);
      const b = Math.round(b1 + (b2 - b1) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    } catch {
      return colors.paperShade;
    }
  };

  return (
    <div className="space-y-6" data-testid="metrics-dashboard">
      {/* Algorithm header */}
      <div className="flex items-center justify-between pb-2 border-b border-ink">
        <h3 className="font-sans text-lg font-semibold text-ink">
          Optimisation metrics
        </h3>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] border border-accent text-accent px-2 py-[0.1rem]">
          {algorithm}
        </span>
      </div>

      {/* Summary cards */}
      <section>
        <SectionHeading>Summary</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule border border-ink">
          <SummaryCard
            value={total_states}
            label="Total states"
            sub={`${originalStateCount} original`}
            tone="accent"
          />
          <SummaryCard
            value={dummy_states_added}
            label="Dummy states"
            sub="added for Gray code"
            tone="warn"
          />
          <SummaryCard
            value={`${improvement_percentage.toFixed(1)}%`}
            label="Improvement"
            sub="Hamming distance"
            tone="ok"
          />
          <SummaryCard
            value={`${execution_time_ms.toFixed(1)} ms`}
            label="Execution time"
            sub="algorithm runtime"
          />
        </div>
      </section>

      {/* Hamming distance distribution */}
      <section>
        <SectionHeading>Hamming distance · before vs after</SectionHeading>
        <div className="bg-paper border border-rule p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hammingDistData} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="2 4"
                vertical={false}
                stroke={colors.rule}
              />
              <XAxis
                dataKey="name"
                tick={{
                  fontSize: 11,
                  fill: colors.inkSoft,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
                stroke={colors.rule}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 10,
                  fill: colors.inkFaint,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
                stroke={colors.rule}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={chartTooltipStyle(colors)}
                cursor={{ fill: colors.accentTint }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: colors.inkSoft,
                }}
              />
              <Bar dataKey="Before" fill={colors.warn} name="Before" />
              <Bar dataKey="After" fill={colors.accent} name="After" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Radar + Pie row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionHeading>Optimisation profile</SectionHeading>
          <div className="bg-paper border border-rule p-4">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={colors.rule} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fontSize: 10,
                    fill: colors.inkSoft,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 1]}
                  tick={{
                    fontSize: 9,
                    fill: colors.inkFaint,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                  tickCount={3}
                  stroke={colors.rule}
                />
                <Radar
                  name="Optimised"
                  dataKey="value"
                  stroke={RADAR_COLOR}
                  fill={RADAR_COLOR}
                  fillOpacity={0.22}
                  dot={{ r: 3, fill: RADAR_COLOR }}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle(colors)}
                  formatter={(v: number) => v.toFixed(3)}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <SectionHeading>State composition</SectionHeading>
          <div className="bg-paper border border-rule p-4 flex flex-col items-center">
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
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      stroke={colors.paper}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle(colors)} />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    fontFamily: 'IBM Plex Mono, monospace',
                    color: colors.inkSoft,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Encoding map table */}
      {encodingRows.length > 0 && (
        <section>
          <SectionHeading>State encoding map</SectionHeading>
          <div className="bg-paper border border-ink overflow-hidden">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-ink-faint border-t border-b border-ink bg-paper">
                    State
                  </th>
                  <th className="text-left px-4 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-ink-faint border-t border-b border-ink bg-paper">
                    Gray code
                  </th>
                  <th className="text-right px-4 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-ink-faint border-t border-b border-ink bg-paper">
                    Bit width
                  </th>
                </tr>
              </thead>
              <tbody>
                {encodingRows.map(([stateName, grayCode]) => (
                  <tr key={stateName} className="border-b border-rule">
                    <td className="px-4 py-2 font-medium text-ink">{stateName}</td>
                    <td className="px-4 py-2">
                      <code className="font-mono font-tabular text-accent bg-accent-tint px-2 py-[0.1rem]">
                        {grayCode}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-right text-ink-soft text-xs font-tabular">
                      <span className="font-tabular">{grayCode.length}</span> bit
                      {grayCode.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Hamming-distance heatmap between every pair of encodings */}
      {encodingEntries.length > 1 && (
        <section>
          <SectionHeading>Hamming distance matrix</SectionHeading>
          <div className="bg-paper border border-ink overflow-x-auto">
            <table className="font-mono text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-20 bg-paper-shade px-2 py-1.5 text-ink-faint font-medium border border-rule sticky left-0 z-10">
                    &nbsp;
                  </th>
                  {encodingEntries.map(([name]) => (
                    <th
                      key={name}
                      className="px-2 py-1.5 bg-paper-shade text-ink-soft font-medium border border-rule whitespace-nowrap"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {encodingEntries.map(([rowName, rowCode]) => (
                  <tr key={rowName}>
                    <td className="px-2 py-1.5 bg-paper-shade text-ink-soft font-medium border border-rule sticky left-0 whitespace-nowrap">
                      {rowName}
                    </td>
                    {encodingEntries.map(([colName, colCode]) => {
                      const dist = hammingDistance(rowCode, colCode);
                      const isDiag = rowName === colName;
                      const intensity =
                        isDiag || maxHammingPossible === 0
                          ? 0
                          : dist / maxHammingPossible;
                      return (
                        <td
                          key={colName}
                          className="px-2 py-1.5 text-center border border-rule font-mono font-tabular"
                          style={{ backgroundColor: heatColor(intensity) }}
                          title={`${rowName} ↔ ${colName}: Hamming ${dist}`}
                        >
                          {isDiag ? (
                            <span className="text-ink-faint">—</span>
                          ) : (
                            <span
                              className={dist === 1 ? 'text-ok font-semibold' : 'text-ink'}
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
            <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-rule font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-faint">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block border border-ok"
                  style={{ backgroundColor: colors.paperShade }}
                />
                Distance = 1 (ideal Gray transition, in <span className="text-ok">ok</span>)
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block"
                  style={{ backgroundColor: colors.warn }}
                />
                Higher distance
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
