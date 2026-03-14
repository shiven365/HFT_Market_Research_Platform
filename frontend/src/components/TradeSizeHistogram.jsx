import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function toChartData(bins = []) {
  return bins.map((bin) => ({
    rangeLabel: `${Number(bin.bin_start).toExponential(2)} to ${Number(bin.bin_end).toExponential(2)}`,
    midpoint: Number(bin.mid),
    count: bin.count,
    countDisplay: bin.count > 0 ? bin.count : null,
  }));
}

export default function TradeSizeHistogram({ bins }) {
  const data = toChartData(bins);

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Trade Size Histogram</h3>
        <span>Quantity distribution (log-spaced bins)</span>
      </div>
      <div className="research-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, left: 6, bottom: 8 }} barCategoryGap="12%">
            <CartesianGrid stroke="rgba(142, 186, 220, 0.2)" strokeDasharray="3 3" />
            <XAxis dataKey="rangeLabel" hide />
            <YAxis scale="log" domain={[1, 'auto']} width={64} tickFormatter={(v) => Number(v).toLocaleString()} />
            <Tooltip
              formatter={(v, name, payload) => [Number(payload?.payload?.count || v).toLocaleString(), 'Trades']}
              labelFormatter={(label) => `Qty range: ${label}`}
            />
            <Bar dataKey="countDisplay" fill="#2f88d6" radius={[4, 4, 0, 0]} minPointSize={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
