function fmtUsd(v) {
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export default function TradeTable({ trades }) {
  return (
    <section className="panel trade-table-wrap">
      <div className="panel-head">
        <h3>Trade Log Table</h3>
        <span>{trades.length} rows</span>
      </div>
      <div className="trade-table-scroll">
        <table className="trade-table">
          <thead>
            <tr>
              <th>Trade ID</th>
              <th>Entry Time</th>
              <th>Exit Time</th>
              <th>Entry Price</th>
              <th>Exit Price</th>
              <th>Profit/Loss</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.trade_id}>
                <td>{t.trade_id}</td>
                <td>{new Date(t.entry_time).toLocaleString()}</td>
                <td>{new Date(t.exit_time).toLocaleString()}</td>
                <td>{fmtUsd(t.entry_price)}</td>
                <td>{fmtUsd(t.exit_price)}</td>
                <td className={t.net_return_pct >= 0 ? 'up' : 'down'}>
                  {fmtPct(t.net_return_pct)} ({fmtUsd(t.pnl_usd)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
