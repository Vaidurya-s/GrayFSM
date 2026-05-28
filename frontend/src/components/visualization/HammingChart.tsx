import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useThemeColors } from './use-theme-colors';

interface HammingChartProps {
  avgBefore: number;
  avgAfter: number;
  statesBefore: number;
  statesAfter: number;
  dummyStatesAdded: number;
  improvementPct: number;
}

/**
 * HammingChart — datasheet-aesthetic before/after Hamming-distance bars.
 *
 * Charts are rendered in SVG by recharts, which doesn't inherit CSS
 * variables. Colours come from the design-system tokens via the
 * `useThemeColors` hook so light + dark themes are picked up
 * automatically. Legend / axes / grid all theme-aware.
 */
export default function HammingChart({
  avgBefore,
  avgAfter,
  statesBefore,
  statesAfter,
  dummyStatesAdded,
  improvementPct,
}: HammingChartProps) {
  const colors = useThemeColors();

  const hammingData = [
    {
      name: 'Avg Hamming Distance',
      Before: avgBefore,
      After: avgAfter,
    },
  ];

  const stateData = [
    { name: 'Original', count: statesBefore },
    { name: 'Dummy', count: dummyStatesAdded },
    { name: 'Total', count: statesAfter },
  ];

  // Tooltip styled to match the datasheet aesthetic.
  const tooltipStyle: React.CSSProperties = {
    background: colors.paper,
    border: `1px solid ${colors.ink}`,
    borderRadius: 0,
    fontSize: 12,
    fontFamily: 'IBM Plex Mono, monospace',
    color: colors.ink,
  };
  const axisTick = { fontSize: 11, fill: colors.inkSoft, fontFamily: 'IBM Plex Mono, monospace' };

  return (
    <div className="space-y-5" data-testid="hamming-chart">
      {/* Improvement banner — datasheet pull-figure */}
      <div className="border-t-[3px] border-b-[3px] border-double border-ink py-3 text-center">
        <div className="font-mono font-tabular font-light text-3xl tracking-tight text-accent leading-none">
          {(improvementPct ?? 0).toFixed(1)}
          <span className="font-serif italic font-normal text-base text-ink-soft ml-1">
            %
          </span>
        </div>
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint mt-1">
          Improvement
        </div>
      </div>

      {/* Hamming distance comparison */}
      <div>
        <h4 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink mb-2 pb-1 border-b border-rule">
          Hamming distance · before → after
        </h4>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={hammingData} layout="vertical">
            <CartesianGrid strokeDasharray="2 4" stroke={colors.rule} horizontal={false} />
            <XAxis type="number" domain={[0, 'auto']} tick={axisTick} stroke={colors.rule} />
            <YAxis type="category" dataKey="name" width={150} tick={axisTick} stroke={colors.rule} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.accentTint }} />
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

      {/* State count chart */}
      <div>
        <h4 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink mb-2 pb-1 border-b border-rule">
          State counts
        </h4>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stateData}>
            <CartesianGrid strokeDasharray="2 4" stroke={colors.rule} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} stroke={colors.rule} />
            <YAxis allowDecimals={false} tick={axisTick} stroke={colors.rule} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.accentTint }} />
            <Bar dataKey="count" fill={colors.accent} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics grid — datasheet field tiles */}
      <div className="grid grid-cols-2 gap-px bg-rule border border-ink">
        <Tile label="Avg Hamming · before" value={(avgBefore ?? 0).toFixed(2)} />
        <Tile label="Avg Hamming · after" value={(avgAfter ?? 0).toFixed(2)} accent />
        <Tile label="Dummy states added" value={dummyStatesAdded} />
        <Tile label="Total states" value={statesAfter} />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper p-3 text-center">
      <div
        className={
          'font-mono font-tabular text-lg leading-none mb-1 ' +
          (accent ? 'text-accent' : 'text-ink')
        }
      >
        {value}
      </div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}
