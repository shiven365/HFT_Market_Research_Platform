import { useMemo } from 'react';

function buildCandles(count = 22) {
  return Array.from({ length: count }, (_, i) => {
    const up = i % 3 !== 0;
    const left = 4 + ((i * 97) % 92);
    const delay = ((i * 19) % 100) / 100;
    const duration = 6 + ((i * 11) % 7);
    const scale = 0.7 + ((i * 23) % 45) / 100;
    const depth = -220 + ((i * 37) % 420);
    const wick = 14 + ((i * 13) % 42);
    const body = 8 + ((i * 17) % 24);

    return {
      id: `intro-candle-${i}`,
      up,
      left,
      delay,
      duration,
      scale,
      depth,
      wick,
      body,
    };
  });
}

function buildParticles(count = 56) {
  return Array.from({ length: count }, (_, i) => {
    const left = (i * 41) % 100;
    const top = (i * 67) % 100;
    const duration = 7 + ((i * 5) % 9);
    const delay = ((i * 29) % 100) / 100;
    const size = 2 + ((i * 13) % 5);

    return {
      id: `intro-particle-${i}`,
      left,
      top,
      duration,
      delay,
      size,
    };
  });
}

export default function IntroPage({ onEnter, exiting = false }) {
  const candles = useMemo(() => buildCandles(), []);
  const particles = useMemo(() => buildParticles(), []);

  return (
    <main className={`intro-page-shell${exiting ? ' is-exiting' : ''}`}>
      <div className="intro-page-bg-grid" aria-hidden="true" />

      <div className="intro-page-particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="intro-page-particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              width: `${p.size}px`,
              height: `${p.size}px`,
            }}
          />
        ))}
      </div>

      <div className="intro-page-candle-field" aria-hidden="true">
        {candles.map((c) => (
          <span
            key={c.id}
            className={`intro-page-candle${c.up ? ' up' : ' down'}`}
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `translateZ(${c.depth}px) scale(${c.scale})`,
            }}
          >
            <span className="intro-page-candle-wick" style={{ height: `${c.wick}px` }} />
            <span className="intro-page-candle-body" style={{ height: `${c.body}px` }} />
          </span>
        ))}
      </div>

      <section className="intro-page-panel">
        <p className="intro-page-kicker"></p>
        <h1>QuantEdge</h1>
        <p className="intro-page-tagline">BTC/USDT Crypto Market Research Platform</p>
        <p className="intro-page-subtitle">
          Analyze Bitcoin trading against USDT with interactive market analytics, strategy simulation, and AI insights.
        </p>
        <p className="intro-page-market-note"></p>
        <button type="button" className="btn btn-primary intro-page-enter" onClick={onEnter}>
          Enter Platform
        </button>
      </section>
    </main>
  );
}
