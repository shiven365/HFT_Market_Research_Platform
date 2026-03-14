export default function EquityCurveChart({ points }) {
  if (!points || points.length < 2) {
    return <div className="chart-empty">Run a simulation to see equity curve</div>;
  }

  const width = 1000;
  const height = 260;
  const padX = 24;
  const padTop = 16;
  const padBottom = 30;

  const minEq = Math.min(...points.map((p) => p.equity));
  const maxEq = Math.max(...points.map((p) => p.equity));
  const range = Math.max(maxEq - minEq, 0.000001);

  const xStep = (width - padX * 2) / Math.max(1, points.length - 1);
  const toY = (value) => padTop + ((maxEq - value) / range) * (height - padTop - padBottom);

  const d = points
    .map((p, idx) => {
      const x = padX + idx * xStep;
      const y = toY(p.equity);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const firstLabel = new Date(points[0].time).toLocaleString();
  const midPoint = points[Math.floor(points.length / 2)];
  const midLabel = new Date(midPoint.time).toLocaleString();
  const lastLabel = new Date(points[points.length - 1].time).toLocaleString();

  return (
    <div className="equity-chart" aria-label="Equity curve chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="equity-svg" role="img" aria-label="Equity curve">
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />

        <line x1={padX} x2={width - padX} y1={toY(minEq)} y2={toY(minEq)} className="candle-grid-line" />
        <line x1={padX} x2={width - padX} y1={toY((minEq + maxEq) / 2)} y2={toY((minEq + maxEq) / 2)} className="candle-grid-line" />
        <line x1={padX} x2={width - padX} y1={toY(maxEq)} y2={toY(maxEq)} className="candle-grid-line" />

        <path d={d} className="equity-path" />

        <text x={width - 8} y={toY(maxEq) + 4} className="candle-price-label" textAnchor="end">
          {maxEq.toFixed(4)}
        </text>
        <text x={width - 8} y={toY(minEq) + 4} className="candle-price-label" textAnchor="end">
          {minEq.toFixed(4)}
        </text>

        <text x={padX} y={height - 8} className="candle-time-label" textAnchor="start">
          {firstLabel}
        </text>
        <text x={width / 2} y={height - 8} className="candle-time-label" textAnchor="middle">
          {midLabel}
        </text>
        <text x={width - padX} y={height - 8} className="candle-time-label" textAnchor="end">
          {lastLabel}
        </text>
      </svg>
    </div>
  );
}
