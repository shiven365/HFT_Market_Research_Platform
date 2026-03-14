function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export default function MetricsGrid({ metrics }) {
  if (!metrics) {
    return null;
  }

  const cards = [
    { label: 'Total PnL', value: fmtPct(metrics.total_return_pct), tone: metrics.total_return_pct >= 0 ? 'up' : 'down' },
    { label: 'Win Rate', value: fmtPct(metrics.win_rate_pct), tone: metrics.win_rate_pct >= 50 ? 'up' : 'down' },
    { label: 'Max Drawdown', value: fmtPct(-Math.abs(metrics.max_drawdown_pct)), tone: 'down' },
    { label: 'Total Trades', value: metrics.total_trades.toLocaleString(), tone: '' },
    { label: 'Sharpe-like Score', value: metrics.sharpe_like.toFixed(3), tone: metrics.sharpe_like >= 0 ? 'up' : 'down' },
  ];

  return (
    <section className="backtest-metrics-grid">
      {cards.map((c) => (
        <article key={c.label} className="panel summary-card">
          <p>{c.label}</p>
          <h3 className={c.tone}>{c.value}</h3>
        </article>
      ))}
    </section>
  );
}
