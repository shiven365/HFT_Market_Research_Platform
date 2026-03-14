import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function makeBins(trades, binCount = 16) {
  if (!trades || trades.length === 0) {
    return [];
  }

  const values = trades.map((t) => t.net_return_pct);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: `${min.toFixed(2)}%`, count: values.length }];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width;
    const end = start + width;
    return { start, end, count: 0 };
  });

  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count += 1;
  }

  return bins.map((b) => ({
    range: `${b.start.toFixed(2)} to ${b.end.toFixed(2)}%`,
    count: b.count,
  }));
}

export default function TradeDistributionChart({ trades }) {
  const data = makeBins(trades || []);

  if (data.length === 0) {
    return <div className="chart-empty">No trade data for distribution chart</div>;
  }

  return (
    <div className="dist-chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,120,150,0.25)" />
          <XAxis dataKey="range" tick={{ fill: '#9cc1dd', fontSize: 11 }} angle={-25} textAnchor="end" interval={1} />
          <YAxis tick={{ fill: '#9cc1dd', fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#20c997" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
