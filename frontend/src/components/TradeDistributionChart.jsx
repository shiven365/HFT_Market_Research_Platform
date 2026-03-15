import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MIN_VISIBLE_BINS = 5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeBins(trades, binCount = 16) {
  if (!trades || trades.length === 0) {
    return [];
  }

  const values = trades.map((t) => t.net_return_pct);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ binLabel: 'T1', range: `${min.toFixed(2)}%`, count: values.length }];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width;
    const end = start + width;
    return { start, end, count: 0 };
  });

  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count += 1;
  }

  return bins.map((b, idx) => ({
    binLabel: `T${idx + 1}`,
    range: `${b.start.toFixed(2)} to ${b.end.toFixed(2)}%`,
    count: b.count,
  }));
}

export default function TradeDistributionChart({ trades, resetSignal }) {
  const allBins = makeBins(trades || []);

  const initialVisible = Math.max(1, allBins.length);
  const [windowRange, setWindowRange] = useState(() => ({
    start: Math.max(0, allBins.length - initialVisible),
    end: allBins.length,
  }));

  useEffect(() => {
    setWindowRange((prev) => {
      const total = allBins.length;
      if (total === 0) {
        return { start: 0, end: 0 };
      }
      if (prev.start === 0 && prev.end === 0) {
        return { start: 0, end: total };
      }

      const prevSize = Math.max(1, prev.end - prev.start);
      const size = clamp(prevSize, Math.min(MIN_VISIBLE_BINS, total), total);
      const start = clamp(prev.start, 0, total - size);
      return { start, end: start + size };
    });
  }, [allBins.length]);

  useEffect(() => {
    setWindowRange({ start: 0, end: allBins.length });
  }, [resetSignal]);

  const data = useMemo(() => allBins.slice(windowRange.start, windowRange.end), [allBins, windowRange]);

  if (data.length === 0) {
    return <div className="chart-empty">No trade data for distribution chart</div>;
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
    if (allBins.length <= MIN_VISIBLE_BINS) {
      return;
    }

    const zoomFactor = event.deltaY < 0 ? 0.88 : 1.15;
    const nextSize = clamp(
      Math.round(currentSize * zoomFactor),
      Math.min(MIN_VISIBLE_BINS, allBins.length),
      allBins.length,
    );

    if (nextSize === currentSize) {
      return;
    }

    const relative = 0.5;
    const anchorIndex = windowRange.start + Math.round((currentSize - 1) * relative);
    let nextStart = anchorIndex - Math.round((nextSize - 1) * relative);
    nextStart = clamp(nextStart, 0, allBins.length - nextSize);
    setWindowRange({ start: nextStart, end: nextStart + nextSize });
  }

  const maxStart = Math.max(0, allBins.length - (windowRange.end - windowRange.start));
  const sliderValue = maxStart ? windowRange.start : 0;
  const sliderPct = maxStart ? (sliderValue / maxStart) * 100 : 100;
  const zoomPct = allBins.length ? Math.round((data.length / allBins.length) * 100) : 100;

  function resetZoom() {
    setWindowRange({ start: 0, end: allBins.length });
  }

  function handleSliderChange(event) {
    const nextStart = Number(event.target.value);
    const size = windowRange.end - windowRange.start;
    setWindowRange({ start: nextStart, end: nextStart + size });
  }

  return (
    <div className="dist-chart-wrap" onWheelCapture={handleWheel} onWheel={handleWheel}>
      <div className="dist-toolbar">
        <button type="button" className="candle-reset-btn" onClick={resetZoom}>
          Reset Zoom
        </button>
        <span className="candle-zoom-chip">{zoomPct}% window</span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 26 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,120,150,0.25)" />
          <XAxis dataKey="range" tick={{ fill: '#9cc1dd', fontSize: 11 }} angle={-25} textAnchor="end" interval={1} />
          <YAxis tick={{ fill: '#9cc1dd', fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#20c997" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {maxStart > 0 ? (
        <div className="dist-zoom-slider-wrap" aria-label="Trade distribution pan slider">
          <div className="dist-zoom-base-line" />
          <div className="dist-zoom-active-line" style={{ width: `${sliderPct}%` }} />
          <input
            type="range"
            className="dist-zoom-slider"
            min={0}
            max={maxStart}
            step={1}
            value={sliderValue}
            onChange={handleSliderChange}
            aria-label="Move visible trade distribution window"
          />
        </div>
      ) : null}
    </div>
  );
}
