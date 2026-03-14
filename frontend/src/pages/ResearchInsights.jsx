import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeatures, getInsights } from '../api/client';
import BuyerMakerRatioChart from '../components/BuyerMakerRatioChart';
import DatasetSummary from '../components/DatasetSummary';
import ObservationsPanel from '../components/ObservationsPanel';
import ReturnDistributionChart from '../components/ReturnDistributionChart';
import TradeSizeHistogram from '../components/TradeSizeHistogram';
import VolatilityChart from '../components/VolatilityChart';

export default function ResearchInsights() {
  const [features, setFeatures] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getFeatures({ volatility_window: 30, histogram_bins: 28 }),
      getInsights(),
    ])
      .then(([featuresRes, insightsRes]) => {
        if (!mounted) {
          return;
        }
        setFeatures(featuresRes);
        setInsights(insightsRes);
      })
      .catch(() => {
        if (mounted) {
          setError('Could not load market research insights. Confirm backend API is running on port 8000.');
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

  return (
    <main className="research-shell">
      <header className="research-topbar panel">
        <div>
          <h1>Market Research Insights</h1>
          <p>Statistical analysis of BTCUSDT market behavior using historical trade and candle data.</p>
        </div>
        <div className="research-nav-row">
          <Link to="/explorer" className="btn btn-ghost">
            Back to Data Explorer
          </Link>
          <Link to="/strategy-lab" className="btn btn-primary">
            Open Strategy Lab
          </Link>
        </div>
      </header>

      {error ? <section className="panel explorer-error">{error}</section> : null}

      <DatasetSummary insights={insights} />

      {loading ? (
        <section className="panel">Computing research features...</section>
      ) : (
        <section className="research-grid">
          <VolatilityChart series={features?.volatility_series || []} windowSize={features?.volatility_window || 30} />
          <TradeSizeHistogram bins={features?.trade_size_histogram || []} />
          <BuyerMakerRatioChart ratio={features?.buyer_seller_ratio} />
          <ReturnDistributionChart bins={features?.return_distribution || []} />
        </section>
      )}

      <ObservationsPanel items={insights?.observations || []} />
    </main>
  );
}
