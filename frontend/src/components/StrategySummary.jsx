function fmtDate(ms) {
  return new Date(ms).toLocaleString();
}

export default function StrategySummary({ result }) {
  if (!result) {
    return null;
  }

  return (
    <section className="panel backtest-summary">
      <h3>Strategy Summary</h3>
      <div className="summary-pairs">
        <p>
          <span>Strategy</span>
          <strong>{result.strategy}</strong>
        </p>
        <p>
          <span>Threshold</span>
          <strong>{result.parameters.threshold}%</strong>
        </p>
        <p>
          <span>Holding Time</span>
          <strong>{result.parameters.holding_time} min</strong>
        </p>
        <p>
          <span>Trading Fee</span>
          <strong>{result.parameters.fee_bps} bps/side</strong>
        </p>
        <p>
          <span>Dataset Range</span>
          <strong>
            {fmtDate(result.window.start)} - {fmtDate(result.window.end)}
          </strong>
        </p>
      </div>
    </section>
  );
}
