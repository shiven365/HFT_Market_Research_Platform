import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLiveKlines, getLiveSummary, getLiveTrades } from '../api/client';
import CandleMarketBoard from '../components/CandleMarketBoard';

const fallbackSnapshot = {
  symbol: 'BTCUSDT',
  updatedAt: null,
  ticker: [
    { label: 'Last Price', value: 0, changePct: 0, changeLabel: '1H' },
    { label: '24H Change', value: 0, changePct: 0, changeLabel: '24H', isSignedCurrency: true },
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

function signedUsd(value) {
  if (!Number.isFinite(value)) {
    return '$0.00';
  }
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${usd.format(Math.abs(value))}`;
}

function formatTickerValue(item) {
  if (item.isSignedCurrency) {
    return signedUsd(item.value);
  }
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

  useEffect(() => {
    let mounted = true;

    async function loadLiveHome() {
      try {
        const [summaryRes, klineRes, tradesRes] = await Promise.all([
          getLiveSummary(),
          getLiveKlines({ interval: '1m', limit: 180 }),
          getLiveTrades({ limit: 240 }),
        ]);

        if (!mounted) {
          return;
        }

        setSnapshot(buildSnapshotFromLive(summaryRes, klineRes?.data || [], tradesRes?.data || []));
      } catch {
        if (mounted) {
          setSnapshot(fallbackSnapshot);
        }
      }
    }

    loadLiveHome();
    const timer = setInterval(() => {
      loadLiveHome();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <main className="home-shell trading-home">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar reveal">
        <div className="brand-wrap">
          <span className="brand-mark" />
          <div>
            <h1 className="brand-title">QuantEdge</h1>
            <p className="brand-subtitle">Professional Digital Asset Terminal</p>
          </div>
        </div>
      </header>

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

      <section className="hero-grid hero-grid-single">
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
      </section>

      <section className="dashboard-grid">
        <article className="panel reveal market-board">
          <div className="panel-head">
            <h3>Market Board</h3>
            <span>{snapshot.symbol} {snapshot.chart?.interval || '1m'} real candles</span>
          </div>
          <div className="chart-canvas" role="img" aria-label="Real market board from csv data">
            <CandleMarketBoard candles={snapshot.chart?.candles || []} resetSignal="home-route" />
          </div>
          <div className="board-stats">
            <p>24h High: {usd.format(snapshot.board?.high24 ?? 0)}</p>
            <p>24h Low: {usd.format(snapshot.board?.low24 ?? 0)}</p>
            <p>Volume: {(snapshot.board?.volume24 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC</p>
            <p>Last: {usd.format(snapshot.board?.lastPrice ?? 0)}</p>
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

function buildSnapshotFromLive(summary, klines, trades) {
  const latestPrice = summary?.latest_price || 0;
  const change24h = summary?.change_24h_pct || 0;
  const volume24h = summary?.volume_24h || 0;
  const tradeRate = summary?.trade_rate_per_min || 0;
  const volatility = summary?.volatility_pct || 0;
  const buyPressure = summary?.buy_pressure_pct || 0;
  const sellPressure = summary?.sell_pressure_pct || 0;

  const candles = (klines || []).map((k) => ({ ...k, time: k.open_time }));
  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const change24hValue =
    candles.length && firstCandle?.open
      ? lastCandle.close - firstCandle.open
      : latestPrice && Number.isFinite(change24h)
        ? (latestPrice * change24h) / (100 + change24h || 1)
        : 0;

  const oneMinuteReturn =
    candles.length >= 2 && candles[candles.length - 2].close
      ? ((lastCandle.close - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100
      : 0;

  const fifteenMinuteReturn =
    candles.length >= 16 && candles[candles.length - 16].close
      ? ((lastCandle.close - candles[candles.length - 16].close) / candles[candles.length - 16].close) * 100
      : 0;

  const averageTradeQuote = trades.length ? trades.reduce((acc, t) => acc + (t.quote_qty || 0), 0) / trades.length : 0;
  const largestTradeQuote = trades.length ? Math.max(...trades.map((t) => t.quote_qty || 0)) : 0;

  const high24 = candles.length ? Math.max(...candles.map((c) => c.high)) : latestPrice;
  const low24 = candles.length ? Math.min(...candles.map((c) => c.low)) : latestPrice;

  return {
    symbol: 'BTCUSDT',
    updatedAt: summary?.updated_at || Date.now(),
    ticker: [
      { label: 'Last Price', value: latestPrice, changePct: change24h, changeLabel: '24H' },
      { label: '24H Change', value: change24hValue, changePct: change24h, changeLabel: '24H', isSignedCurrency: true },
      { label: '24H Volume', value: volume24h, changePct: volatility, changeLabel: 'VOL' },
      { label: 'Trades / Minute', value: tradeRate, changePct: buyPressure - sellPressure, changeLabel: 'FLOW' },
    ],
    board: {
      high24,
      low24,
      volume24: volume24h,
      lastPrice: latestPrice,
    },
    flow: [
      { side: 'Buy Pressure', value: buyPressure, tone: 'positive', isPercent: true },
      { side: 'Sell Pressure', value: sellPressure, tone: 'negative', isPercent: true },
      {
        side: 'Spread Proxy',
        value: Math.max(0, high24 - low24),
        tone: 'neutral',
        isCurrency: true,
      },
      { side: '1H Volatility', value: volatility, tone: 'neutral', isPercent: true },
    ],
    signals: [
      { name: '1M Return', value: oneMinuteReturn, isPercent: true },
      { name: '15M Return', value: fifteenMinuteReturn, isPercent: true },
      { name: 'Average Trade Size', value: averageTradeQuote, isCurrency: true },
      { name: 'Largest Trade', value: largestTradeQuote, isCurrency: true },
    ],
    chart: {
      interval: '1m',
      candles: candles.slice(-140),
    },
    firstOpen: firstCandle?.open_time || null,
  };
}
