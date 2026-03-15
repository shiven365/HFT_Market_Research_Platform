import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_VISIBLE_CANDLES = 24;

const priceFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const volumeFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function candleTs(candle) {
  return candle.time ?? candle.open_time;
}

export default function CandleMarketBoard({ candles, resetSignal }) {
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
  const height = 300;
  const padTop = 14;
  const padRight = 76;
  const padBottom = 28;
  const padLeft = 18;

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
      const size = clamp(prevSize, Math.min(MIN_VISIBLE_CANDLES, total), total);
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
    return <div className="chart-empty">No candle data available</div>;
  }

  const minPrice = Math.min(...visibleCandles.map((c) => c.low));
  const maxPrice = Math.max(...visibleCandles.map((c) => c.high));
  const range = Math.max(maxPrice - minPrice, 0.000001);

  const toY = (price) => padTop + ((maxPrice - price) / range) * (height - padTop - padBottom);

  const plotWidth = width - padLeft - padRight;
  const slot = plotWidth / visibleCandles.length;
  const bodyWidth = Math.max(2, slot * 0.62);

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
    if (event.nativeEvent?.stopImmediatePropagation) {
      event.nativeEvent.stopImmediatePropagation();
    }
    if (Math.abs(event.deltaY) < 0.3) {
      return;
    }
    const currentSize = windowRange.end - windowRange.start;
    if (allCandles.length <= MIN_VISIBLE_CANDLES) {
      return;
    }

    const x = toSvgX(event);
    const relative = x == null ? 0.5 : clamp((x - padLeft) / plotWidth, 0, 1);
    const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15;
    const nextSize = clamp(
      Math.round(currentSize * zoomFactor),
      Math.min(MIN_VISIBLE_CANDLES, allCandles.length),
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

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
    const price = maxPrice - r * range;
    const y = toY(price);
    return { y, price };
  });

  const timeLabels = [0, Math.floor((visibleCandles.length - 1) / 2), visibleCandles.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((idx) => ({
      x: padLeft + idx * slot + slot / 2,
      label: formatTimeLabel(candleTs(visibleCandles[idx])),
    }));

  const hoveredCandle = hoveredIndex == null ? null : visibleCandles[hoveredIndex];
  const hoveredX = hoveredIndex == null ? 0 : padLeft + hoveredIndex * slot + slot / 2;
  const hoveredY = hoveredCandle ? toY(hoveredCandle.close) : 0;
  const zoomPct = allCandles.length ? Math.round((visibleCandles.length / allCandles.length) * 100) : 100;
  const tooltipLeft = clamp((hoveredX / width) * 100 + 1.3, 4, 88);
  const tooltipTop = clamp((hoveredY / height) * 100 - 8, 8, 84);

  return (
    <div
      className={`candle-board${dragState ? ' is-dragging' : ''}`}
      aria-label="Real candlestick market board"
      onWheelCapture={handleWheel}
      onWheel={handleWheel}
    >
      <div className="candle-toolbar">
        <button type="button" className="candle-reset-btn" onClick={resetZoom}>
          Reset Zoom
        </button>
        <span className="candle-zoom-chip">{zoomPct}% window</span>
      </div>

      {hoveredCandle ? (
        <div className="candle-tooltip" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}>
          <p>{new Date(candleTs(hoveredCandle)).toLocaleString()}</p>
          <p>O: {priceFmt.format(hoveredCandle.open)}</p>
          <p>H: {priceFmt.format(hoveredCandle.high)}</p>
          <p>L: {priceFmt.format(hoveredCandle.low)}</p>
          <p>C: {priceFmt.format(hoveredCandle.close)}</p>
          <p>V: {volumeFmt.format(hoveredCandle.volume)}</p>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="candle-svg"
        role="img"
        aria-label="BTCUSDT candlestick chart"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />

        {ticks.map((tick) => (
          <g key={`tick-${tick.y}`}>
            <line x1={padLeft} x2={width - padRight} y1={tick.y} y2={tick.y} className="candle-grid-line" />
            <text x={width - padRight + 8} y={tick.y + 4} className="candle-price-label">
              {tick.price.toFixed(2)}
            </text>
          </g>
        ))}

        {visibleCandles.map((c, idx) => {
          const x = padLeft + idx * slot + slot / 2;
          const openY = toY(c.open);
          const closeY = toY(c.close);
          const highY = toY(c.high);
          const lowY = toY(c.low);
          const isUp = c.close >= c.open;
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

          return (
            <g key={`candle-${candleTs(c)}-${idx}`}>
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

        {hoveredCandle ? (
          <g>
            <line x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} className="candle-hover-line" />
            <circle cx={hoveredX} cy={hoveredY} r={3.5} className="candle-hover-dot" />
          </g>
        ) : null}

        {timeLabels.map((t) => (
          <text key={`label-${t.x}`} x={t.x} y={height - 8} className="candle-time-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
