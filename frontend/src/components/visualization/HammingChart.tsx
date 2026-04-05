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

interface HammingChartProps {
  avgBefore: number;
  avgAfter: number;
  statesBefore: number;
  statesAfter: number;
  dummyStatesAdded: number;
  improvementPct: number;
}

export default function HammingChart({
  avgBefore,
  avgAfter,
  statesBefore,
  statesAfter,
  dummyStatesAdded,
  improvementPct,
}: HammingChartProps) {
  const hammingData = [
    {
      name: 'Avg Hamming Distance',
      Before: avgBefore,
      After: avgAfter,
    },
  ];

  const stateData = [
    {
      name: 'Original States',
      count: statesBefore,
    },
    {
      name: 'Dummy States',
      count: dummyStatesAdded,
    },
    {
      name: 'Total After',
      count: statesAfter,
    },
  ];

  return (
    <div className="space-y-6" data-testid="hamming-chart">
      {/* Improvement banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold" style={{ color: '#0072B2' }}>
          {improvementPct.toFixed(1)}%
        </div>
        <div className="text-sm" style={{ color: '#0072B2' }}>Improvement</div>
      </div>

      {/* Hamming distance comparison */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Hamming Distance Comparison
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hammingData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Before" fill="#E69F00" name="Before" radius={[0, 4, 4, 0]} />
            <Bar dataKey="After" fill="#0072B2" name="After" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* State count chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">State Counts</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-900">{avgBefore.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Avg Hamming Before</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-900">{avgAfter.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Avg Hamming After</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-900">{dummyStatesAdded}</div>
          <div className="text-xs text-gray-500">Dummy States Added</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-900">{statesAfter}</div>
          <div className="text-xs text-gray-500">Total States</div>
        </div>
      </div>
    </div>
  );
}
