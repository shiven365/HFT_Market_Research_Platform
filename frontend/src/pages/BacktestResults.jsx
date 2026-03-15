import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EquityCurveChart from '../components/EquityCurveChart';
import MetricsGrid from '../components/MetricsGrid';
import StrategySummary from '../components/StrategySummary';
import TradeDistributionChart from '../components/TradeDistributionChart';
import TradeTable from '../components/TradeTable';
import { getBacktestById } from '../api/client';

export default function BacktestResults() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    if (!id) {
      setError('Backtest result ID is missing.');
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getBacktestById(id)
      .then((res) => {
        if (mounted) {
          setResult(res);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Could not load backtest results. Please run a new simulation.');
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
  }, [id]);

  if (loading) {
    return (
      <main className="backtest-shell">
        <section className="panel">Loading backtest results...</section>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="backtest-shell">
        <section className="panel explorer-error">{error || 'Backtest result not found.'}</section>
      </main>
    );
  }

  return (
    <main className="backtest-shell">
      <header className="backtest-topbar panel">
        <div>
          <h1>Backtest Results</h1>
          <p>Read-only performance analytics dashboard for completed simulation runs.</p>
        </div>
      </header>

      <StrategySummary result={result} />

      <MetricsGrid metrics={result.metrics} />

      <section className="backtest-charts-grid">
        <article className="panel">
          <div className="panel-head">
            <h3>Equity Curve</h3>
            <span>{result.equity_curve?.length || 0} points</span>
          </div>
          <div className="strategy-chart-wrap">
            <EquityCurveChart points={result.equity_curve || []} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Trade Distribution</h3>
            <span>P/L per trade histogram</span>
          </div>
          <TradeDistributionChart trades={result.trades || []} />
        </article>
      </section>

      <TradeTable trades={result.trades || []} />
    </main>
  );
}
