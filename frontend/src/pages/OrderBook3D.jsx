import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import OrderBookScene3D from '../components/OrderBookScene3D';
import { getSnapshot } from '../api/client';

function valueLabel(mode, value) {
  if (mode === 'trade_count') {
    return `${value.toLocaleString()} trades`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`;
}

export default function OrderBook3D() {
  const [mode, setMode] = useState('volume');
  const [animate, setAnimate] = useState(true);
  const [frameIndex, setFrameIndex] = useState(-1);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(null);

  async function loadSnapshot(nextFrame) {
    setLoading(true);
    setError('');

    try {
      const data = await getSnapshot({
        mode,
        frame_index: nextFrame,
        frame_minutes: 1,
        price_bucket: 5,
        max_levels: 64,
      });
      setSnapshot(data);

      if (nextFrame === -1 && data.frameIndex !== nextFrame) {
        setFrameIndex(data.frameIndex);
      }
    } catch (e) {
      setError('Failed to load 3D snapshots from backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFrameIndex(-1);
  }, [mode]);

  useEffect(() => {
    loadSnapshot(frameIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, frameIndex]);

  useEffect(() => {
    if (!animate || !snapshot || snapshot.totalFrames <= 1 || frameIndex < 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        if (!snapshot) {
          return prev;
        }
        const next = prev + 1;
        return next >= snapshot.totalFrames ? 0 : next;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [animate, snapshot, frameIndex]);

  const modeLabel = useMemo(() => (mode === 'volume' ? 'Volume Mode' : 'Trade Count Mode'), [mode]);

  return (
    <main className="orderbook-shell">
      <header className="orderbook-topbar panel">
        <div>
          <h1>3D Order Book / Liquidity View</h1>
          <p>Historical derived activity density across price buckets and replayable time slices.</p>
        </div>
        <div className="orderbook-top-actions">
          <Link to="/explorer" className="btn btn-ghost">
            Market Explorer
          </Link>
          <Link to="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </header>

      <section className="orderbook-controls panel">
        <div className="mode-switch" role="group" aria-label="Activity mode">
          <button className={mode === 'volume' ? 'active' : ''} onClick={() => setMode('volume')}>
            Volume View
          </button>
          <button className={mode === 'trade_count' ? 'active' : ''} onClick={() => setMode('trade_count')}>
            Trade Count View
          </button>
        </div>

        <label className="replay-toggle">
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Animation
        </label>

        <label>
          Snapshot Selector
          <select
            value={frameIndex}
            onChange={(e) => setFrameIndex(Number(e.target.value))}
            disabled={!snapshot || !snapshot.frames || snapshot.frames.length === 0}
          >
            {(snapshot?.frames || []).map((f) => (
              <option key={f.index} value={f.index}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="orderbook-replay panel">
        <div>
          <p>{modeLabel}</p>
          <h3>{snapshot?.frame?.label || 'Loading frame...'}</h3>
        </div>
        <label className="slider-wrap">
          Replay Slider
          <input
            type="range"
            min={0}
            max={Math.max(0, (snapshot?.totalFrames || 1) - 1)}
            value={Math.max(0, frameIndex)}
            onChange={(e) => setFrameIndex(Number(e.target.value))}
            disabled={!snapshot || snapshot.totalFrames <= 1}
          />
        </label>
      </section>

      {error ? <div className="explorer-error panel">{error}</div> : null}

      <section className="orderbook-main-grid">
        <article className="panel orderbook-scene-panel">
          <div className="panel-head">
            <h3>3D Price/Activity Buckets</h3>
            <span>{loading ? 'Loading...' : `${snapshot?.bins?.length || 0} bars`}</span>
          </div>

          <OrderBookScene3D
            bins={snapshot?.bins || []}
            animate={animate}
            onHoverBin={(bin) => setHovered(bin)}
            onLeaveBin={() => setHovered(null)}
          />

          <div className="legend-row">
            <span>Color Legend</span>
            <div className="legend-item">
              <i className="legend-swatch low" />
              Low
            </div>
            <div className="legend-item">
              <i className="legend-swatch medium" />
              Medium
            </div>
            <div className="legend-item">
              <i className="legend-swatch high" />
              High
            </div>
          </div>
        </article>

        <article className="panel orderbook-info-panel">
          <h3>Hover Tooltip</h3>
          {hovered ? (
            <div className="hover-tooltip-box">
              <p>
                <strong>Price Bucket:</strong> ${hovered.price_bucket.toFixed(2)}
              </p>
              <p>
                <strong>Volume:</strong> {hovered.volume.toFixed(6)} BTC
              </p>
              <p>
                <strong>Trades:</strong> {hovered.trade_count.toLocaleString()}
              </p>
              <p>
                <strong>Activity:</strong> {valueLabel(mode, hovered.activity)}
              </p>
              <p>
                <strong>Intensity:</strong> {(hovered.intensity * 100).toFixed(1)}%
              </p>
            </div>
          ) : (
            <div className="hover-tooltip-box muted">Hover over any 3D bar to inspect bucket details.</div>
          )}

          <div className="snapshot-metrics">
            <p>
              <span>Frame</span>
              <strong>{snapshot?.frameIndex ?? '-'}</strong>
            </p>
            <p>
              <span>Total Frames</span>
              <strong>{snapshot?.totalFrames ?? '-'}</strong>
            </p>
            <p>
              <span>Price Bucket</span>
              <strong>${snapshot?.priceBucketSize ?? '-'}</strong>
            </p>
            <p>
              <span>Max Activity</span>
              <strong>{snapshot ? valueLabel(mode, snapshot.maxActivity || 0) : '-'}</strong>
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
