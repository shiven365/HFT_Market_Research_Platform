import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CandleMarketBoard from '../components/CandleMarketBoard';
import VolumeBarsChart from '../components/VolumeBarsChart';
import { getKlines, getMeta, getSummary, getTradesSample } from '../api/client';

function toDatetimeLocal(ms) {
  const d = new Date(ms);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value) {
  if (!value) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtNum(v, digits = 2) {
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtUsd(v) {
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export default function Explorer() {
  const [timeframe, setTimeframe] = useState('1m');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const [summary, setSummary] = useState(null);
  const [candles, setCandles] = useState([]);
  const [trades, setTrades] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    getMeta()
      .then((meta) => {
        if (!mounted) {
          return;
        }
        setStartInput(toDatetimeLocal(meta.klines_start));
        setEndInput(toDatetimeLocal(meta.klines_end));
      })
      .catch(() => {
        if (mounted) {
          setError('Could not load data range from backend.');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function loadData({ startLocal, endLocal, nextTimeframe }) {
    setLoading(true);
    setError('');

    try {
      const params = {
        start: fromDatetimeLocal(startLocal),
        end: fromDatetimeLocal(endLocal),
      };

      const [summaryRes, klineRes, tradesRes] = await Promise.all([
        getSummary(params),
        getKlines({ ...params, interval: nextTimeframe, limit: 480 }),
        getTradesSample({ ...params, limit: 120 }),
      ]);

      setSummary(summaryRes);
      setCandles(klineRes.data || []);
      setTrades(tradesRes.data || []);
    } catch (e) {
      setError('Failed to load explorer data. Check backend API is running on port 8000.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!startInput || !endInput) {
      return;
    }
    loadData({ startLocal: startInput, endLocal: endInput, nextTimeframe: timeframe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInput, endInput, timeframe]);

  const stats = useMemo(() => {
    if (!summary) {
      return [
        { label: 'Total Trades', value: '-' },
        { label: 'Average Trade Size', value: '-' },
        { label: 'Return', value: '-' },
        { label: 'Volatility', value: '-' },
      ];
    }

    return [
      { label: 'Total Trades', value: fmtNum(summary.total_trades, 0) },
      { label: 'Average Trade Size', value: fmtNum(summary.average_trade_size, 6) },
      { label: 'Return', value: fmtPct(summary.return_pct), tone: summary.return_pct >= 0 ? 'up' : 'down' },
      { label: 'Volatility', value: `${summary.volatility_pct.toFixed(2)}%` },
    ];
  }, [summary]);

  return (
    <main className="explorer-shell">
      <header className="explorer-topbar panel">
        <div>
          <h1>Market Data Explorer</h1>
          <p>Inspect BTCUSDT historical candles and trades over custom time ranges.</p>
        </div>
        <div className="orderbook-top-actions">
          <Link to="/research-insights" className="btn btn-ghost">
            Research Insights
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to Home
          </Link>
        </div>
      </header>

      <section className="explorer-filters panel">
        <label>
          Start
          <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
        </label>
        <label>
          End
          <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} />
        </label>
        <label>
          Timeframe
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
          </select>
        </label>
      </section>

      {error ? <div className="explorer-error panel">{error}</div> : null}

      <section className="summary-grid">
        {stats.map((card) => (
          <article key={card.label} className="summary-card panel">
            <p>{card.label}</p>
            <h3 className={card.tone || ''}>{card.value}</h3>
          </article>
        ))}
      </section>

      <section className="explorer-grid">
        <article className="panel">
          <div className="panel-head">
            <h3>Candlestick Chart</h3>
            <span>{loading ? 'Loading...' : `${candles.length} candles`}</span>
          </div>
          <div className="explorer-chart-wrap">
            <CandleMarketBoard candles={candles} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Volume Bars</h3>
            <span>{timeframe} interval</span>
          </div>
          <div className="explorer-volume-wrap">
            <VolumeBarsChart candles={candles} />
          </div>
        </article>
      </section>

      <section className="panel trade-table-wrap">
        <div className="panel-head">
          <h3>Recent Trades (Sample)</h3>
          <span>{loading ? 'Loading...' : `${trades.length} rows`}</span>
        </div>
        <div className="trade-table-scroll">
          <table className="trade-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Quote Qty</th>
                <th>Side</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.trade_id}>
                  <td>{new Date(t.time).toLocaleString()}</td>
                  <td>{fmtUsd(t.price)}</td>
                  <td>{fmtNum(t.qty, 6)}</td>
                  <td>{fmtNum(t.quote_qty, 4)}</td>
                  <td className={t.is_buyer_maker ? 'down' : 'up'}>{t.is_buyer_maker ? 'Sell' : 'Buy'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
