import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function toChartData(bins = []) {
  return bins.map((bin) => ({
    midpoint: Number(bin.mid).toFixed(4),
    count: bin.count,
    countDisplay: bin.count > 0 ? bin.count : null,
    direction: bin.mid >= 0 ? 'up' : 'down',
  }));
}

export default function ReturnDistributionChart({ bins }) {
  const data = toChartData(bins);

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Return Distribution</h3>
        <span>Price return histogram (central 98%)</span>
      </div>
      <div className="research-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, left: 6, bottom: 8 }} barCategoryGap="12%">
            <CartesianGrid stroke="rgba(142, 186, 220, 0.2)" strokeDasharray="3 3" />
            <XAxis dataKey="midpoint" hide />
            <YAxis scale="log" domain={[1, 'auto']} width={64} tickFormatter={(v) => Number(v).toLocaleString()} />
            <Tooltip
              formatter={(v, name, payload) => [Number(payload?.payload?.count || v).toLocaleString(), 'Intervals']}
              labelFormatter={(v) => `Return midpoint: ${v}%`}
            />
            <Bar dataKey="countDisplay" radius={[4, 4, 0, 0]} minPointSize={2}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.midpoint}-${index}`}
                  fill={entry.direction === 'up' ? 'rgba(34, 204, 165, 0.9)' : 'rgba(224, 109, 109, 0.9)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
