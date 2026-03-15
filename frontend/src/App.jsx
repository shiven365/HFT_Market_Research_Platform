import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Intro3D from './components/Intro3D';
import LiveStatusIndicator from './components/LiveStatusIndicator';
import BacktestResults from './pages/BacktestResults';
import Home from './pages/Home';
import Explorer from './pages/Explorer';
import OrderBook3D from './pages/OrderBook3D';
import ResearchInsights from './pages/ResearchInsights';
import StrategyLab from './pages/StrategyLab';
import AIPrediction from './pages/AIPrediction';

const INTRO_STORAGE_KEY = 'introShown';

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

  function handleEnterIntro() {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'true');
      } catch {
        // Continue even if storage is unavailable in this browser context.
      }
    }
    setIntroShown(true);
    navigate('/', { replace: true });
  }

  if (!introShown) {
    return <Intro3D onEnter={handleEnterIntro} />;
  }

  return (
    <>
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
    </>
  );
}

function LinkBrand() {
  return <p className="app-global-brand">PulseTrade</p>;
}
