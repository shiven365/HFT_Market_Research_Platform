import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_VISIBLE_BARS = 24;

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function VolumeBarsChart({ candles, resetSignal }) {
  const allCandles = candles || [];

  const initialVisible = Math.max(1, allCandles.length);
  const [windowRange, setWindowRange] = useState(() => ({
    start: Math.max(0, allCandles.length - initialVisible),
    end: allCandles.length,
  }));
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [dragState, setDragState] = useState(null);
  const svgRef = useRef(null);

  const width = 1000;
  const height = 180;
  const padTop = 10;
  const padBottom = 26;
  const padLeft = 16;
  const padRight = 16;

  useEffect(() => {
    setWindowRange((prev) => {
      const total = allCandles.length;
      if (total === 0) {
        return { start: 0, end: 0 };
      }
      if (prev.start === 0 && prev.end === 0) {
        return { start: 0, end: total };
      }
      const prevSize = Math.max(1, prev.end - prev.start);
      const size = clamp(prevSize, Math.min(MIN_VISIBLE_BARS, total), total);
      const previousMaxEnd = total - 1;
      const wasPinnedToEnd = prev.end >= previousMaxEnd;

      if (wasPinnedToEnd || prev.end > total) {
        return { start: Math.max(0, total - size), end: total };
      }

      const start = clamp(prev.start, 0, total - size);
      return { start, end: start + size };
    });
  }, [allCandles.length]);

  useEffect(() => {
    const size = allCandles.length;
    setWindowRange({ start: Math.max(0, allCandles.length - size), end: allCandles.length });
    setHoveredIndex(null);
    setDragState(null);
  }, [resetSignal]);

  const visibleCandles = useMemo(() => allCandles.slice(windowRange.start, windowRange.end), [allCandles, windowRange]);

  if (visibleCandles.length === 0) {
    return <div className="chart-empty">No volume data available</div>;
  }

  const maxVolume = Math.max(...visibleCandles.map((c) => c.volume), 1);
  const chartHeight = height - padTop - padBottom;
  const plotWidth = width - padLeft - padRight;
  const slot = plotWidth / visibleCandles.length;
  const barWidth = Math.max(2, slot * 0.72);

  function toSvgX(event) {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (!rect.width) {
      return null;
    }
    return ((event.clientX - rect.left) / rect.width) * width;
  }

  function resolveIndexFromX(x) {
    if (x == null || x < padLeft || x > width - padRight) {
      return null;
    }
    return clamp(Math.floor((x - padLeft) / slot), 0, visibleCandles.length - 1);
  }

  function handlePointerMove(event) {
    const x = toSvgX(event);
    if (dragState) {
      const size = dragState.range.end - dragState.range.start;
      const dragSlot = plotWidth / size;
      const deltaBars = Math.round((x - dragState.startX) / dragSlot);
      const nextStart = clamp(dragState.range.start - deltaBars, 0, allCandles.length - size);
      setWindowRange({ start: nextStart, end: nextStart + size });
      return;
    }

    const idx = resolveIndexFromX(x);
    setHoveredIndex(idx);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    const x = toSvgX(event);
    if (x == null) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: x,
      range: windowRange,
    });
    setHoveredIndex(null);
  }

  function handlePointerUp(event) {
    if (dragState && dragState.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function handlePointerLeave() {
    if (!dragState) {
      setHoveredIndex(null);
    }
  }

  function handleWheel(event) {
    event.preventDefault();
    event.stopPropagation();

    const currentSize = windowRange.end - windowRange.start;
    if (allCandles.length <= MIN_VISIBLE_BARS) {
      return;
    }

    const x = toSvgX(event);
    const relative = x == null ? 0.5 : clamp((x - padLeft) / plotWidth, 0, 1);
    const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15;
    const nextSize = clamp(
      Math.round(currentSize * zoomFactor),
      Math.min(MIN_VISIBLE_BARS, allCandles.length),
      allCandles.length,
    );

    if (nextSize === currentSize) {
      return;
    }

    const anchorIndex = windowRange.start + Math.round((currentSize - 1) * relative);
    let nextStart = anchorIndex - Math.round((nextSize - 1) * relative);
    nextStart = clamp(nextStart, 0, allCandles.length - nextSize);
    setWindowRange({ start: nextStart, end: nextStart + nextSize });
  }

  function resetZoom() {
    const size = allCandles.length;
    setWindowRange({ start: Math.max(0, allCandles.length - size), end: allCandles.length });
    setHoveredIndex(null);
  }

  const timeLabels = [0, Math.floor((visibleCandles.length - 1) / 2), visibleCandles.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((idx) => {
      const dt = new Date(candleTs(visibleCandles[idx]));
      return {
        x: padLeft + idx * slot + slot / 2,
        label: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

  const hoveredCandle = hoveredIndex == null ? null : visibleCandles[hoveredIndex];
  const hoveredX = hoveredIndex == null ? 0 : padLeft + hoveredIndex * slot + slot / 2;
  const hoveredHeight = hoveredCandle ? (hoveredCandle.volume / maxVolume) * chartHeight : 0;
  const hoveredY = height - padBottom - hoveredHeight;
  const zoomPct = allCandles.length ? Math.round((visibleCandles.length / allCandles.length) * 100) : 100;
  const tooltipLeft = clamp((hoveredX / width) * 100 + 1.1, 4, 88);
  const tooltipTop = clamp((hoveredY / height) * 100 - 8, 10, 82);

  return (
    <div
      className={`volume-board${dragState ? ' is-dragging' : ''}`}
      aria-label="Volume bars chart"
      onWheelCapture={handleWheel}
    >
      <div className="volume-toolbar">
        <button type="button" className="volume-reset-btn" onClick={resetZoom}>
          Reset Zoom
        </button>
        <span className="volume-zoom-chip">{zoomPct}% window</span>
      </div>

      {hoveredCandle ? (
        <div className="volume-tooltip" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}>
          <p>{new Date(candleTs(hoveredCandle)).toLocaleString()}</p>
          <p>Volume: {compactNumber(hoveredCandle.volume)}</p>
          <p>Open: {hoveredCandle.open.toFixed(2)}</p>
          <p>Close: {hoveredCandle.close.toFixed(2)}</p>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="volume-svg"
        role="img"
        aria-label="Volume bars"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />
        {visibleCandles.map((c, idx) => {
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

        {hoveredCandle ? (
          <g>
            <line x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} className="volume-hover-line" />
            <circle cx={hoveredX} cy={hoveredY} r={3.5} className="volume-hover-dot" />
          </g>
        ) : null}

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
