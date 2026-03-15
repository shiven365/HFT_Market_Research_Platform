import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_VISIBLE_POINTS = 60;

const equityFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function EquityCurveChart({ points, resetSignal }) {
  const allPoints = points || [];
  const initialVisible = Math.max(1, allPoints.length);

  const [windowRange, setWindowRange] = useState(() => ({
    start: Math.max(0, allPoints.length - initialVisible),
    end: allPoints.length,
  }));
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [dragState, setDragState] = useState(null);
  const svgRef = useRef(null);

  const width = 1000;
  const height = 260;
  const padLeft = 24;
  const padRight = 84;
  const padTop = 16;
  const padBottom = 30;

  useEffect(() => {
    setWindowRange((prev) => {
      const total = allPoints.length;
      if (total === 0) {
        return { start: 0, end: 0 };
      }
      if (prev.start === 0 && prev.end === 0) {
        return { start: 0, end: total };
      }
      const prevSize = Math.max(1, prev.end - prev.start);
      const size = clamp(prevSize, Math.min(MIN_VISIBLE_POINTS, total), total);
      const previousMaxEnd = total - 1;
      const wasPinnedToEnd = prev.end >= previousMaxEnd;

      if (wasPinnedToEnd || prev.end > total) {
        return { start: Math.max(0, total - size), end: total };
      }

      const start = clamp(prev.start, 0, total - size);
      return { start, end: start + size };
    });
  }, [allPoints.length]);

  useEffect(() => {
    const size = allPoints.length;
    setWindowRange({ start: Math.max(0, allPoints.length - size), end: allPoints.length });
    setHoveredIndex(null);
    setDragState(null);
  }, [resetSignal]);

  const visiblePoints = useMemo(() => allPoints.slice(windowRange.start, windowRange.end), [allPoints, windowRange]);

  if (visiblePoints.length < 2) {
    return <div className="chart-empty">Run a simulation to see equity curve</div>;
  }

  const minEq = Math.min(...visiblePoints.map((p) => p.equity));
  const maxEq = Math.max(...visiblePoints.map((p) => p.equity));
  const range = Math.max(maxEq - minEq, 0.000001);

  const plotWidth = width - padLeft - padRight;
  const xStep = plotWidth / Math.max(1, visiblePoints.length - 1);
  const toX = (idx) => padLeft + idx * xStep;
  const toY = (value) => padTop + ((maxEq - value) / range) * (height - padTop - padBottom);

  const pathData = visiblePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(2)} ${toY(p.equity).toFixed(2)}`)
    .join(' ');

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
    return clamp(Math.round((x - padLeft) / xStep), 0, visiblePoints.length - 1);
  }

  function handlePointerMove(event) {
    const x = toSvgX(event);
    if (dragState) {
      const size = dragState.range.end - dragState.range.start;
      const dragStep = plotWidth / Math.max(1, size - 1);
      const deltaBars = Math.round((x - dragState.startX) / dragStep);
      const nextStart = clamp(dragState.range.start - deltaBars, 0, allPoints.length - size);
      setWindowRange({ start: nextStart, end: nextStart + size });
      return;
    }

    setHoveredIndex(resolveIndexFromX(x));
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
    if (allPoints.length <= MIN_VISIBLE_POINTS) {
      return;
    }

    const x = toSvgX(event);
    const relative = x == null ? 0.5 : clamp((x - padLeft) / plotWidth, 0, 1);
    const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15;
    const nextSize = clamp(
      Math.round(currentSize * zoomFactor),
      Math.min(MIN_VISIBLE_POINTS, allPoints.length),
      allPoints.length,
    );

    if (nextSize === currentSize) {
      return;
    }

    const anchorIndex = windowRange.start + Math.round((currentSize - 1) * relative);
    let nextStart = anchorIndex - Math.round((nextSize - 1) * relative);
    nextStart = clamp(nextStart, 0, allPoints.length - nextSize);
    setWindowRange({ start: nextStart, end: nextStart + nextSize });
  }

  function resetZoom() {
    const size = allPoints.length;
    setWindowRange({ start: Math.max(0, allPoints.length - size), end: allPoints.length });
    setHoveredIndex(null);
  }

  const firstLabel = new Date(visiblePoints[0].time).toLocaleString();
  const midPoint = visiblePoints[Math.floor(visiblePoints.length / 2)];
  const midLabel = new Date(midPoint.time).toLocaleString();
  const lastLabel = new Date(visiblePoints[visiblePoints.length - 1].time).toLocaleString();

  const hoveredPoint = hoveredIndex == null ? null : visiblePoints[hoveredIndex];
  const hoveredX = hoveredIndex == null ? 0 : toX(hoveredIndex);
  const hoveredY = hoveredPoint ? toY(hoveredPoint.equity) : 0;
  const zoomPct = allPoints.length ? Math.round((visiblePoints.length / allPoints.length) * 100) : 100;
  const tooltipLeft = clamp((hoveredX / width) * 100 + 1.4, 4, 88);
  const tooltipTop = clamp((hoveredY / height) * 100 - 8, 8, 84);

  return (
    <div
      className={`equity-chart candle-board${dragState ? ' is-dragging' : ''}`}
      aria-label="Equity curve chart"
      onWheelCapture={handleWheel}
      onWheel={handleWheel}
    >
      <div className="candle-toolbar">
        <button type="button" className="candle-reset-btn" onClick={resetZoom}>
          Reset Zoom
        </button>
        <span className="candle-zoom-chip">{zoomPct}% window</span>
      </div>

      {hoveredPoint ? (
        <div className="candle-tooltip" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}>
          <p>{new Date(hoveredPoint.time).toLocaleString()}</p>
          <p>Equity: {equityFmt.format(hoveredPoint.equity)}</p>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="equity-svg candle-svg"
        role="img"
        aria-label="Equity curve"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <rect x={0} y={0} width={width} height={height} className="candle-bg" rx={12} />

        <line x1={padLeft} x2={width - padRight} y1={toY(minEq)} y2={toY(minEq)} className="candle-grid-line" />
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={toY((minEq + maxEq) / 2)}
          y2={toY((minEq + maxEq) / 2)}
          className="candle-grid-line"
        />
        <line x1={padLeft} x2={width - padRight} y1={toY(maxEq)} y2={toY(maxEq)} className="candle-grid-line" />

        <path d={pathData} className="equity-path" />

        {hoveredPoint ? (
          <g>
            <line x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} className="candle-hover-line" />
            <circle cx={hoveredX} cy={hoveredY} r={3.4} className="candle-hover-dot" />
          </g>
        ) : null}

        <text x={width - 8} y={toY(maxEq) + 4} className="candle-price-label" textAnchor="end">
          {equityFmt.format(maxEq)}
        </text>
        <text x={width - 8} y={toY(minEq) + 4} className="candle-price-label" textAnchor="end">
          {equityFmt.format(minEq)}
        </text>

        <text x={padLeft} y={height - 8} className="candle-time-label" textAnchor="start">
          {firstLabel}
        </text>
        <text x={width / 2} y={height - 8} className="candle-time-label" textAnchor="middle">
          {midLabel}
        </text>
        <text x={width - padRight} y={height - 8} className="candle-time-label" textAnchor="end">
          {lastLabel}
        </text>
      </svg>
    </div>
  );
}
