function fmtTime(ms) {
  if (!ms) {
    return '-';
  }
  return new Date(ms).toLocaleString();
}

function fmtNum(value, digits = 2) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function DatasetSummary({ insights }) {
  if (!insights) {
    return (
      <section className="panel research-summary-grid">
        <article className="summary-card panel">
          <p>Dataset</p>
          <h3>-</h3>
        </article>
        <article className="summary-card panel">
          <p>Time Range</p>
          <h3>-</h3>
        </article>
        <article className="summary-card panel">
          <p>Total Trades Analyzed</p>
          <h3>-</h3>
        </article>
        <article className="summary-card panel">
          <p>Average Trade Size</p>
          <h3>-</h3>
        </article>
      </section>
    );
  }

  const start = fmtTime(insights.time_range?.start);
  const end = fmtTime(insights.time_range?.end);

  return (
    <section className="research-summary-grid">
      <article className="summary-card panel">
        <p>Dataset</p>
        <h3>{insights.dataset_name}</h3>
      </article>
      <article className="summary-card panel">
        <p>Time Range</p>
        <h3 className="research-time-range">{start}</h3>
        <small>to {end}</small>
      </article>
      <article className="summary-card panel">
        <p>Total Trades Analyzed</p>
        <h3>{fmtNum(insights.total_trades_analyzed, 0)}</h3>
      </article>
      <article className="summary-card panel">
        <p>Average Trade Size</p>
        <h3>{fmtNum(insights.average_trade_size, 6)}</h3>
      </article>
    </section>
  );
}
