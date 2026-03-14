import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#1aa98a', '#db6767'];

function ratioData(ratio) {
  if (!ratio) {
    return [];
  }

  return [
    {
      name: 'Buyer initiated',
      value: ratio.buyer_initiated,
      pct: ratio.buyer_pct,
    },
    {
      name: 'Seller initiated',
      value: ratio.seller_initiated,
      pct: ratio.seller_pct,
    },
  ];
}

export default function BuyerMakerRatioChart({ ratio }) {
  const data = ratioData(ratio);

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Buyer vs Seller Ratio</h3>
        <span>From isBuyerMaker flag</span>
      </div>
      <div className="research-ratio-wrap">
        <div className="research-pie-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={86} labelLine={false}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _, payload) => [Number(value).toLocaleString(), payload?.payload?.name || '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="research-ratio-legend">
          {data.map((item, idx) => (
            <p key={item.name}>
              <span className="ratio-dot" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              {item.name}: <strong>{item.pct.toFixed(2)}%</strong>
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}
