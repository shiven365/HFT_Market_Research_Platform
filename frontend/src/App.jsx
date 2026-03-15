import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import IntroPage from './pages/IntroPage';
import LiveStatusIndicator from './components/LiveStatusIndicator';
import BacktestResults from './pages/BacktestResults';
import Home from './pages/Home';
import Explorer from './pages/Explorer';
import OrderBook3D from './pages/OrderBook3D';
import ResearchInsights from './pages/ResearchInsights';
import StrategyLab from './pages/StrategyLab';
import AIPrediction from './pages/AIPrediction';

const INTRO_STORAGE_KEY = 'intro_seen';
const INTRO_FADE_OUT_MS = 460;
const APP_FADE_IN_MS = 620;

function readIntroFlag() {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const navigate = useNavigate();
  const [introShown, setIntroShown] = useState(readIntroFlag);
  const [introExiting, setIntroExiting] = useState(false);
  const [appEntering, setAppEntering] = useState(false);
  const introTimerRef = useRef(null);
  const appTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (introTimerRef.current) {
        clearTimeout(introTimerRef.current);
      }
      if (appTimerRef.current) {
        clearTimeout(appTimerRef.current);
      }
    };
  }, []);

  function handleEnterIntro() {
    if (introExiting) {
      return;
    }

    setIntroExiting(true);

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'true');
      } catch {
        // Continue even if storage is unavailable in this browser context.
      }
    }

    introTimerRef.current = setTimeout(() => {
      setIntroShown(true);
      setIntroExiting(false);
      setAppEntering(true);
      navigate('/', { replace: true });

      appTimerRef.current = setTimeout(() => {
        setAppEntering(false);
      }, APP_FADE_IN_MS);
    }, INTRO_FADE_OUT_MS);
  }

  if (!introShown) {
    return <IntroPage onEnter={handleEnterIntro} exiting={introExiting} />;
  }

  return (
    <div className={`app-shell${appEntering ? ' app-shell-enter' : ''}`}>
      <header className="app-global-header">
        <div className="app-global-inner">
          <div className="app-brand-and-live">
            <LinkBrand />
            <LiveStatusIndicator />
          </div>
          <nav className="app-global-nav" aria-label="Global navigation">
            <NavLink to="/" end className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              Home
            </NavLink>
            <NavLink to="/explorer" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              Explorer
            </NavLink>
            <NavLink to="/research-insights" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              Research Insights
            </NavLink>
            <NavLink to="/orderbook-3d" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              Order Book 3D
            </NavLink>
            <NavLink to="/strategy-lab" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              Strategy Lab
            </NavLink>
            <NavLink to="/ai-prediction" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              AI Prediction
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/research-insights" element={<ResearchInsights />} />
        <Route path="/orderbook-3d" element={<OrderBook3D />} />
        <Route path="/strategy-lab" element={<StrategyLab />} />
        <Route path="/ai-prediction" element={<AIPrediction />} />
        <Route path="/backtest/:id" element={<BacktestResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function LinkBrand() {
  return <p className="app-global-brand">QuantEdge</p>;
}
