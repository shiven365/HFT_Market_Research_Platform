import { useEffect, useMemo, useState } from 'react';
import { getLiveSummary } from '../api/client';

const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export default function LiveStatusIndicator() {
  const [latestPrice, setLatestPrice] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [failureCount, setFailureCount] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    async function pollLiveSummary() {
      try {
        const summary = await getLiveSummary();
        if (!mounted) {
          return;
        }

        const price = Number(summary?.latest_price);
        setLatestPrice(Number.isFinite(price) ? price : null);
        setLastSuccessAt(Date.now());
        setFailureCount(0);
      } catch {
        if (!mounted) {
          return;
        }
        setFailureCount((prev) => prev + 1);
      }
    }

    pollLiveSummary();
    const pollTimer = setInterval(pollLiveSummary, 2000);
    const clockTimer = setInterval(() => setNowTs(Date.now()), 1000);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const secondsSinceSuccess = useMemo(() => {
    if (!lastSuccessAt) {
      return null;
    }
    return Math.max(0, Math.floor((nowTs - lastSuccessAt) / 1000));
  }, [lastSuccessAt, nowTs]);

  const status = useMemo(() => {
    if (!lastSuccessAt) {
      return 'offline';
    }

    if ((secondsSinceSuccess ?? 0) > 10) {
      if (failureCount >= 3) {
        return 'offline';
      }
      return 'delayed';
    }

    return 'connected';
  }, [failureCount, lastSuccessAt, secondsSinceSuccess]);

  const statusLabel =
    status === 'connected' ? 'LIVE DATA' : status === 'delayed' ? 'DATA DELAYED' : 'OFFLINE';

  return (
    <div className={`live-status-indicator state-${status}`} aria-live="polite">
      <span className="live-status-dot" />
      <span className="live-status-text">{statusLabel}</span>
      <span className="live-status-price">BTCUSDT {latestPrice !== null ? priceFmt.format(latestPrice) : '--'}</span>
    </div>
  );
}