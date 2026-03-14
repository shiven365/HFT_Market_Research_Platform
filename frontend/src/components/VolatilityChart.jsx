import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function chartData(series = []) {
  return series.map((item) => ({
    timeLabel: new Date(item.time).toLocaleString(),
    volatility: item.volatility_pct,
  }));
}

export default function VolatilityChart({ series, windowSize }) {
  const data = chartData(series);

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Rolling Volatility</h3>
        <span>{windowSize}-bar window</span>
      </div>
      <div className="research-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 18, left: 6, bottom: 10 }}>
            <CartesianGrid stroke="rgba(142, 186, 220, 0.2)" strokeDasharray="3 3" />
            <XAxis dataKey="timeLabel" hide />
            <YAxis tickFormatter={(v) => `${Number(v).toFixed(2)}%`} width={70} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(3)}%`} labelFormatter={(v) => `Time: ${v}`} />
            <Line type="monotone" dataKey="volatility" stroke="#18c5b0" strokeWidth={2.1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
