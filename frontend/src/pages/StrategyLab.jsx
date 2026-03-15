import { useEffect, useMemo, useState } from 'react';
import { getBacktestById, getMeta, simulateStrategy } from '../api/client';
import EquityCurveChart from '../components/EquityCurveChart';
import MetricsGrid from '../components/MetricsGrid';
import StrategySummary from '../components/StrategySummary';
import TradeDistributionChart from '../components/TradeDistributionChart';
import TradeTable from '../components/TradeTable';

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

function fmtDateHint(ms) {
  const d = new Date(ms);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function StrategyLab() {
  const [strategy, setStrategy] = useState('momentum');
  const [threshold, setThreshold] = useState(0.2);
  const [feeBps, setFeeBps] = useState(4);
  const [slippageBps, setSlippageBps] = useState(2);
  const [holdingMinutes, setHoldingMinutes] = useState(15);
  const [lookback, setLookback] = useState(20);

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [datasetRange, setDatasetRange] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backtestResult, setBacktestResult] = useState(null);

  useEffect(() => {
    let mounted = true;

    getMeta()
      .then((meta) => {
        if (!mounted) {
          return;
        }
        setStartInput(toDatetimeLocal(meta.klines_start));
        setEndInput(toDatetimeLocal(meta.klines_end));
        setDatasetRange({ start: meta.klines_start, end: meta.klines_end });
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

  const localValidation = useMemo(() => {
    if (!startInput || !endInput) {
      return '';
    }

    const start = new Date(startInput).getTime();
    const end = new Date(endInput).getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return 'Invalid date format in selected window.';
    }
    if (start >= end) {
      return 'Start date must be earlier than End date.';
    }

    const minutes = (end - start) / 60000;
    if (minutes > 8000) {
      return 'Selected window is too large for simulation. Choose <= 8000 minutes.';
    }

    return '';
  }, [startInput, endInput]);

  async function runSimulation() {
    if (localValidation) {
      setError(localValidation);
      return;
    }

    setLoading(true);
    setError('');
    setBacktestResult(null);

    try {
      const res = await simulateStrategy({
        strategy,
        threshold: Number(threshold),
        fee_bps: Number(feeBps),
        slippage_bps: Number(slippageBps),
        holding_minutes: Number(holdingMinutes),
        lookback: Number(lookback),
        start: fromDatetimeLocal(startInput),
        end: fromDatetimeLocal(endInput),
      });

      if (res?.backtest_id) {
        const fullResult = await getBacktestById(res.backtest_id);
        setBacktestResult(fullResult);
      } else {
        setError('Simulation completed but no backtest ID was returned.');
      }
    } catch (e) {
      setError(e.message || 'Simulation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="strategy-shell">
      <header className="strategy-topbar panel">
        <div>
          <h1>Strategy Lab</h1>
          <p>Select strategy assumptions, run simulation, and inspect metrics and trade log.</p>
        </div>
      </header>

      <section className="strategy-form-grid panel">
        <label>
          Strategy
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="momentum">Momentum</option>
            <option value="mean_reversion">Mean Reversion</option>
            <option value="volume_spike">Volume Spike</option>
          </select>
        </label>

        <label>
          Threshold (%)
          <input type="number" step="0.01" min="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </label>

        <label>
          Fee (bps per side)
          <input type="number" step="0.1" min="0" value={feeBps} onChange={(e) => setFeeBps(e.target.value)} />
        </label>

        <label>
          Slippage (bps per side)
          <input
            type="number"
            step="0.1"
            min="0"
            value={slippageBps}
            onChange={(e) => setSlippageBps(e.target.value)}
          />
        </label>

        <label>
          Holding Time (minutes)
          <input
            type="number"
            step="1"
            min="1"
            value={holdingMinutes}
            onChange={(e) => setHoldingMinutes(e.target.value)}
          />
        </label>

        <label>
          Lookback Bars
          <input type="number" step="1" min="2" value={lookback} onChange={(e) => setLookback(e.target.value)} />
        </label>

        <label>
          Start
          <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
        </label>

        <label>
          End
          <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} />
        </label>

        {datasetRange ? (
          <p className="strategy-date-note">
            Select dates between {fmtDateHint(datasetRange.start)} and {fmtDateHint(datasetRange.end)}.
          </p>
        ) : null}

        <div className="strategy-actions">
          <button className="btn btn-primary" onClick={runSimulation} disabled={loading}>
            {loading ? 'Running...' : 'Run Simulation'}
          </button>
          {localValidation ? <p className="form-warning">{localValidation}</p> : null}
        </div>
      </section>

      {error ? <div className="explorer-error panel">{error}</div> : null}

      <section className="panel strategy-empty-state">
        {backtestResult ? (
          <>
            <h3>Simulation complete</h3>
            <p>Results are shown below.</p>
          </>
        ) : (
          <>
            <h3>Ready to simulate</h3>
            <p>Configure strategy parameters and run simulation to view performance analytics below.</p>
          </>
        )}
      </section>

      {backtestResult ? (
        <>
          <StrategySummary result={backtestResult} />
          <MetricsGrid metrics={backtestResult.metrics} />

          <section className="backtest-charts-grid">
            <article className="panel">
              <div className="panel-head">
                <h3>Equity Curve</h3>
                <span>{backtestResult.equity_curve?.length || 0} points</span>
              </div>
              <div className="strategy-chart-wrap">
                <EquityCurveChart points={backtestResult.equity_curve || []} />
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <h3>Trade Distribution</h3>
                <span>P/L per trade histogram</span>
              </div>
              <TradeDistributionChart trades={backtestResult.trades || []} />
            </article>
          </section>

          <TradeTable trades={backtestResult.trades || []} />
        </>
      ) : null}
    </main>
  );
}
