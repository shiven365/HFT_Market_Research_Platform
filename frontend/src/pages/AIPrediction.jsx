import { useEffect, useMemo, useState } from 'react';
import { getPrediction } from '../api/client';

function toPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function resolveConfidenceLevel(prediction) {
  if (prediction?.confidence_level) {
    return prediction.confidence_level;
  }
  const top = Math.max(Number(prediction?.prob_up || 0), Number(prediction?.prob_down || 0));
  if (top > 0.7) {
    return 'High';
  }
  if (top > 0.6) {
    return 'Medium';
  }
  return 'Low';
}

function resolveSignalTone(signal) {
  if (signal === 'LONG') {
    return 'positive';
  }
  if (signal === 'SHORT') {
    return 'negative';
  }
  return 'neutral';
}

export default function AIPrediction() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadPrediction() {
      try {
        const payload = await getPrediction();
        if (!mounted) {
          return;
        }
        setPrediction(payload);
        setError('');
      } catch {
        if (!mounted) {
          return;
        }
        setError('Could not load AI prediction. Confirm backend API is running on port 8000.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPrediction();
    const timer = setInterval(loadPrediction, 2000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const confidenceLevel = useMemo(() => resolveConfidenceLevel(prediction), [prediction]);
  const signalTone = resolveSignalTone(prediction?.signal);

  return (
    <main className="ai-shell">
      <header className="ai-topbar panel">
        <div>
          <h1>AI Prediction Engine</h1>
          <p>BTCUSDT next candle direction from a cached RandomForest model over live rolling features.</p>
        </div>
      </header>

      {error ? <section className="panel explorer-error">{error}</section> : null}

      {loading ? (
        <section className="panel">Loading AI prediction...</section>
      ) : (
        <section className="ai-grid">
          <article className="panel ai-card">
            <div className="panel-head">
              <h3>BTCUSDT Next Candle</h3>
              <span>Status: {prediction?.status || 'unknown'}</span>
            </div>

            <div className="ai-probability-row">
              <p>UP Probability</p>
              <strong>{toPercent(prediction?.prob_up)}</strong>
            </div>
            <div className="ai-probability-bar">
              <span style={{ width: toPercent(prediction?.prob_up) }} />
            </div>

            <div className="ai-probability-row">
              <p>DOWN Probability</p>
              <strong>{toPercent(prediction?.prob_down)}</strong>
            </div>
            <div className="ai-probability-bar down">
              <span style={{ width: toPercent(prediction?.prob_down) }} />
            </div>

            <div className="ai-summary-row">
              <p>Signal</p>
              <strong className={signalTone}>{prediction?.signal || 'NEUTRAL'}</strong>
            </div>

            <div className="ai-summary-row">
              <p>Confidence</p>
              <strong>{confidenceLevel}</strong>
            </div>

            <div className="ai-summary-row">
              <p>Model Accuracy</p>
              <strong>{prediction?.model_accuracy != null ? toPercent(prediction.model_accuracy) : '-'}</strong>
            </div>

            <p className="ai-footnote">
              Frontend checks every 2 seconds. Backend computes a new prediction every
              {' '}
              {prediction?.prediction_interval_seconds || 10}
              {' '}
              seconds.
            </p>
          </article>
        </section>
      )}
    </main>
  );
}
