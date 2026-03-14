import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CandleMarketBoard from '../components/CandleMarketBoard';

const MarketScene3D = lazy(() => import('../components/MarketScene3D'));

const fallbackSnapshot = {
  symbol: 'BTCUSDT',
  updatedAt: null,
  ticker: [
    { label: 'Last Price', value: 0, changePct: 0, changeLabel: '1H' },
    { label: '24H Change', value: 0, changePct: 0, changeLabel: '24H', isPercentValue: true },
    { label: '24H Volume', value: 0, changePct: 0, changeLabel: '1M' },
    { label: 'Trades / Minute', value: 0, changePct: 0, changeLabel: '15M' },
  ],
  board: { high24: 0, low24: 0, volume24: 0, lastPrice: 0 },
  flow: [
    { side: 'Buy Pressure', value: 0, tone: 'positive', isPercent: true },
    { side: 'Sell Pressure', value: 0, tone: 'negative', isPercent: true },
    { side: 'Spread Proxy', value: 0, tone: 'neutral', isCurrency: true },
    { side: '1H Volatility', value: 0, tone: 'neutral', isPercent: true },
  ],
  signals: [
    { name: '1M Return', value: 0, isPercent: true },
    { name: '15M Return', value: 0, isPercent: true },
    { name: 'Average Trade Size', value: 0, isCurrency: true },
    { name: 'Largest Trade', value: 0, isCurrency: true },
  ],
  chart: {
    interval: '1m',
    candles: [],
  },
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function changeClass(value) {
  if (value > 0) {
    return 'up';
  }
  if (value < 0) {
    return 'down';
  }
  return 'neutral';
}

function signedPercent(value) {
  if (Number.isNaN(value)) {
    return '0.00%';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatTickerValue(item) {
  if (item.isPercentValue) {
    return `${item.value.toFixed(2)}%`;
  }
  if (item.label.includes('Volume')) {
    return `${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`;
  }
  if (item.label.includes('Trades')) {
    return item.value.toFixed(1);
  }
  return usd.format(item.value);
}

function formatSignalValue(item) {
  if (item.isPercent) {
    return `${item.value.toFixed(2)}%`;
  }
  if (item.isCurrency) {
    return usd.format(item.value);
  }
  return String(item.value);
}

export default function Home() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch(`/market-snapshot.json?v=${Date.now()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Snapshot fetch failed');
        }
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setSnapshot(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setSnapshot(fallbackSnapshot);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const updatedLabel = useMemo(() => {
    if (!snapshot.updatedAt) {
      return 'Snapshot pending';
    }
    const dt = new Date(snapshot.updatedAt);
    if (Number.isNaN(dt.getTime())) {
      return 'Snapshot loaded';
    }
    return `Updated ${dt.toLocaleString()}`;
  }, [snapshot.updatedAt]);

  return (
    <main className="home-shell trading-home">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar reveal">
        <div className="brand-wrap">
          <span className="brand-mark" />
          <div>
            <h1 className="brand-title">PulseTrade</h1>
            <p className="brand-subtitle">Professional Digital Asset Terminal</p>
          </div>
        </div>
        <nav className="top-nav" aria-label="Primary">
          <a href="#">Markets</a>
          <a href="#">Portfolio</a>
          <a href="#">Orders</a>
        </nav>
        <div className="top-actions">
          <Link className="btn btn-ghost" to="/explorer">
            Market Explorer
          </Link>
          <Link className="btn btn-ghost" to="/research-insights">
            Research Insights
          </Link>
          <Link className="btn btn-ghost" to="/orderbook-3d">
            3D Order Book
          </Link>
          <Link className="btn btn-primary" to="/strategy-lab">
            Launch Strategy Lab
          </Link>
        </div>
      </header>

      <p className="sync-badge">{loading ? 'Syncing real market snapshot...' : updatedLabel}</p>

      <section className="ticker-row reveal" aria-label="Market overview">
        {snapshot.ticker.map((item) => (
          <article className="ticker-card" key={item.label}>
            <p>{item.label}</p>
            <h3>{formatTickerValue(item)}</h3>
            <span className={changeClass(item.changePct)}>
              {signedPercent(item.changePct)} {item.changeLabel}
            </span>
          </article>
        ))}
      </section>

      <section className="hero-grid">
        <article className="hero panel reveal">
          <p className="eyebrow">Trading Dashboard</p>
          <h2>Trade faster with a market-first workspace built for clarity.</h2>
          <p className="lead">
            Monitor key market movement, inspect order-flow style signals, and run strategy experiments from one
            streamlined interface designed for active users.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/explorer">
              Explore Market Data
            </Link>
            <Link className="btn btn-ghost" to="/research-insights">
              Open Research Insights
            </Link>
            <Link className="btn btn-ghost" to="/orderbook-3d">
              Open 3D Liquidity View
            </Link>
            <Link className="btn btn-ghost" to="/strategy-lab">
              Run Strategies
            </Link>
          </div>
          <div className="hero-metrics">
            <div>
              <p>Market Status</p>
              <h4>Open</h4>
            </div>
            <div>
              <p>Execution Latency</p>
              <h4>42 ms</h4>
            </div>
            <div>
              <p>Risk Posture</p>
              <h4>Balanced</h4>
            </div>
          </div>
        </article>

        <article className="panel reveal scene-panel">
          <div className="panel-head">
            <h3>3D Liquidity Surface</h3>
            <span>Simulated depth dynamics</span>
          </div>
          <Suspense fallback={<div className="scene-fallback">Loading 3D market scene...</div>}>
            <MarketScene3D />
          </Suspense>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel reveal market-board">
          <div className="panel-head">
            <h3>Market Board</h3>
            <span>{snapshot.symbol} {snapshot.chart?.interval || '1m'} real candles</span>
          </div>
          <div className="chart-canvas" role="img" aria-label="Real market board from csv data">
            <CandleMarketBoard candles={snapshot.chart?.candles || []} />
          </div>
          <div className="board-stats">
            <p>24h High: {usd.format(snapshot.board.high24)}</p>
            <p>24h Low: {usd.format(snapshot.board.low24)}</p>
            <p>Volume: {snapshot.board.volume24.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC</p>
            <p>Last: {usd.format(snapshot.board.lastPrice)}</p>
          </div>
        </article>

        <article className="panel reveal">
          <div className="panel-head">
            <h3>Order Flow Pulse</h3>
            <span>Computed from sample trades</span>
          </div>
          <ul className="flow-list">
            {snapshot.flow.map((row) => (
              <li key={row.side}>
                <span>{row.side}</span>
                <strong className={row.tone}>{formatSignalValue(row)}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel reveal">
          <div className="panel-head">
            <h3>Signal Board</h3>
            <span>Derived indicators</span>
          </div>
          <ul className="signal-list">
            {snapshot.signals.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <strong className={changeClass(item.value)}>{formatSignalValue(item)}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
