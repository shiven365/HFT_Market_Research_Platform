import { useMemo } from 'react';

const TRADING_QUOTES = [
  'Markets are never wrong, opinions often are. - Jesse Livermore',
  'Price is truth.',
  'Volatility is opportunity.',
  'The market rewards patience.',
  'Liquidity reveals the real story.',
];

export default function LoadingScreen({ subtitle = 'Analyzing market structure...' }) {
  const quote = useMemo(() => {
    const firstIndex = Math.floor(Math.random() * TRADING_QUOTES.length);
    return TRADING_QUOTES[firstIndex];
  }, []);

  return (
    <section className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-screen-content panel">
        <div className="loading-spinner" aria-hidden="true" />
        <p className="loading-quote">{quote}</p>
        <p className="loading-subtitle">{subtitle}</p>
      </div>
    </section>
  );
}
