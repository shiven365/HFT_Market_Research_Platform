function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CandleMarketBoard({ candles }) {
  if (!candles || candles.length === 0) {
    return <div className="chart-empty">No candle data available</div>;
  }

  const width = 1000;
  const height = 300;
  const padTop = 14;
  const padRight = 76;
  const padBottom = 28;
  const padLeft = 18;

  const minPrice = Math.min(...candles.map((c) => c.low));
  const maxPrice = Math.max(...candles.map((c) => c.high));
  const range = Math.max(maxPrice - minPrice, 0.000001);

  const toY = (price) => padTop + ((maxPrice - price) / range) * (height - padTop - padBottom);

  const plotWidth = width - padLeft - padRight;
  const slot = plotWidth / candles.length;
  const bodyWidth = Math.max(2, slot * 0.62);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
    const price = maxPrice - r * range;
    const y = toY(price);
    return { y, price };
  });

  const timeLabels = [0, Math.floor((candles.length - 1) / 2), candles.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((idx) => ({
      x: padLeft + idx * slot + slot / 2,
      label: formatTimeLabel(candles[idx].time),
    }));

  return (
    <div className="candle-board" aria-label="Real candlestick market board">
      <svg viewBox={`0 0 ${width} ${height}`} className="candle-svg" role="img" aria-label="BTCUSDT candlestick chart">
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />

        {ticks.map((tick) => (
          <g key={`tick-${tick.y}`}>
            <line x1={padLeft} x2={width - padRight} y1={tick.y} y2={tick.y} className="candle-grid-line" />
            <text x={width - padRight + 8} y={tick.y + 4} className="candle-price-label">
              {tick.price.toFixed(2)}
            </text>
          </g>
        ))}

        {candles.map((c, idx) => {
          const x = padLeft + idx * slot + slot / 2;
          const openY = toY(c.open);
          const closeY = toY(c.close);
          const highY = toY(c.high);
          const lowY = toY(c.low);
          const isUp = c.close >= c.open;
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

          return (
            <g key={`candle-${c.time}`}>
              <line x1={x} x2={x} y1={highY} y2={lowY} className={isUp ? 'candle-wick up' : 'candle-wick down'} />
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                className={isUp ? 'candle-body up' : 'candle-body down'}
                rx={1}
              />
            </g>
          );
        })}

        {timeLabels.map((t) => (
          <text key={`label-${t.x}`} x={t.x} y={height - 8} className="candle-time-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
