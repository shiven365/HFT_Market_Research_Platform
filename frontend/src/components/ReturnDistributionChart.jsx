import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function toChartData(bins = []) {
  return bins.map((bin) => ({
    midpoint: Number(bin.mid),
    midpointLabel: `${Number(bin.mid).toFixed(3)}%`,
    rangeLabel: `${Number(bin.bin_start).toFixed(3)}% to ${Number(bin.bin_end).toFixed(3)}%`,
    count: bin.count,
    direction: bin.mid >= 0 ? 'up' : 'down',
  }));
}

export default function ReturnDistributionChart({ bins }) {
  const data = toChartData(bins);

  if (!data.length) {
    return (
      <article className="panel">
        <div className="panel-head">
          <h3>Return Distribution</h3>
          <span>Price return histogram (central 98%)</span>
        </div>
        <div className="chart-empty">No return distribution data available</div>
      </article>
    );
  }

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Return Distribution</h3>
        <span>Price return histogram (central 98%)</span>
      </div>
      <div className="research-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, left: 6, bottom: 26 }} barCategoryGap="10%">
            <CartesianGrid stroke="rgba(142, 186, 220, 0.2)" strokeDasharray="3 3" />
            <XAxis
              dataKey="midpointLabel"
              interval="preserveStartEnd"
              height={46}
              tickMargin={8}
              tick={{ fill: '#9cc1dd', fontSize: 11 }}
            />
            <YAxis domain={[0, 'auto']} width={64} tickFormatter={(v) => Number(v).toLocaleString()} />
            <Tooltip
              formatter={(v, name, payload) => [Number(payload?.payload?.count || v).toLocaleString(), 'Candles']}
              labelFormatter={(v, payload) => {
                const point = payload?.[0]?.payload;
                return point ? `Return bin: ${point.rangeLabel} (mid: ${v})` : `Return midpoint: ${v}`;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} minPointSize={2}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.midpointLabel}-${index}`}
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
