function compactNumber(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function candleTs(candle) {
  return candle.time ?? candle.open_time;
}

export default function VolumeBarsChart({ candles }) {
  if (!candles || candles.length === 0) {
    return <div className="chart-empty">No volume data available</div>;
  }

  const width = 1000;
  const height = 180;
  const padTop = 10;
  const padBottom = 26;
  const padLeft = 16;
  const padRight = 16;

  const maxVolume = Math.max(...candles.map((c) => c.volume), 1);
  const chartHeight = height - padTop - padBottom;
  const slot = (width - padLeft - padRight) / candles.length;
  const barWidth = Math.max(2, slot * 0.72);

  const timeLabels = [0, Math.floor((candles.length - 1) / 2), candles.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((idx) => {
      const dt = new Date(candleTs(candles[idx]));
      return {
        x: padLeft + idx * slot + slot / 2,
        label: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

  return (
    <div className="volume-board" aria-label="Volume bars chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="volume-svg" role="img" aria-label="Volume bars">
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />
        {candles.map((c, idx) => {
          const x = padLeft + idx * slot + slot / 2;
          const h = (c.volume / maxVolume) * chartHeight;
          const y = height - padBottom - h;
          const isUp = c.close >= c.open;
          return (
            <rect
              key={`vol-${candleTs(c)}-${idx}`}
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={h}
              rx={1}
              className={isUp ? 'volume-bar up' : 'volume-bar down'}
            />
          );
        })}

        <text x={width - 10} y={14} textAnchor="end" className="candle-price-label">
          {compactNumber(maxVolume)}
        </text>

        {timeLabels.map((t) => (
          <text key={`vol-label-${t.x}`} x={t.x} y={height - 8} className="candle-time-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
