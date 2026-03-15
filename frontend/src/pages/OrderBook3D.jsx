import { useEffect, useState } from 'react';
import OrderBookScene3D from '../components/OrderBookScene3D';
import { getLiveOrderBook } from '../api/client';

function valueLabel(value) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`;
}

export default function OrderBook3D() {
  const [animate, setAnimate] = useState(true);
  const [priceBucket, setPriceBucket] = useState(5);
  const [maxLevels, setMaxLevels] = useState(50);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(null);

  async function loadSnapshot() {
    setLoading(true);
    setError('');

    try {
      const data = await getLiveOrderBook({
        price_bucket: priceBucket,
        max_levels: maxLevels,
      });
      setSnapshot(data);
    } catch (e) {
      setError('Failed to load live 3D order book data from backend.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
    const timer = setInterval(() => {
      loadSnapshot();
    }, 2000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceBucket, maxLevels]);

  return (
    <main className="orderbook-shell">
      <header className="orderbook-topbar panel">
        <div>
          <h1>3D Order Book / Liquidity View</h1>
          <p>Live Binance depth data bucketed by price and rendered as 3D liquidity bars.</p>
        </div>
      </header>

      <section className="orderbook-controls panel">
        <div className="mode-switch" role="group" aria-label="Data source">
          <button className="active">Live Market Depth</button>
        </div>

        <label className="replay-toggle">
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Animation
        </label>

        <label>
          Price Bucket ($)
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={priceBucket}
            onChange={(e) => setPriceBucket(Number(e.target.value) || 0.1)}
          />
        </label>

        <label>
          Depth Levels
          <input
            type="number"
            min="10"
            max="50"
            step="1"
            value={maxLevels}
            onChange={(e) => setMaxLevels(Math.max(10, Math.min(50, Number(e.target.value) || 10)))}
          />
        </label>
      </section>

      <section className="orderbook-replay panel">
        <div>
          <p>Live Mode</p>
          <h3>{snapshot?.updated_at ? new Date(snapshot.updated_at).toLocaleString() : 'Loading stream...'}</h3>
        </div>
        <div className="slider-wrap">Auto refresh: every 2 seconds</div>
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
                <strong>Bid Volume:</strong> {hovered.bid_volume.toFixed(6)} BTC
              </p>
              <p>
                <strong>Ask Volume:</strong> {hovered.ask_volume.toFixed(6)} BTC
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
              <span>Updated</span>
              <strong>{snapshot?.updated_at ? new Date(snapshot.updated_at).toLocaleTimeString() : '-'}</strong>
            </p>
            <p>
              <span>Bid Levels</span>
              <strong>{snapshot?.bids?.length ?? '-'}</strong>
            </p>
            <p>
              <span>Price Bucket</span>
              <strong>${snapshot?.priceBucketSize ?? '-'}</strong>
            </p>
            <p>
              <span>Max Activity</span>
              <strong>{snapshot ? valueLabel(snapshot.maxActivity || 0) : '-'}</strong>
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
