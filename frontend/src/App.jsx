import { Navigate, Route, Routes } from 'react-router-dom';
import BacktestResults from './pages/BacktestResults';
import Home from './pages/Home';
import Explorer from './pages/Explorer';
import OrderBook3D from './pages/OrderBook3D';
import ResearchInsights from './pages/ResearchInsights';
import StrategyLab from './pages/StrategyLab';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explorer" element={<Explorer />} />
      <Route path="/research-insights" element={<ResearchInsights />} />
      <Route path="/orderbook-3d" element={<OrderBook3D />} />
      <Route path="/strategy-lab" element={<StrategyLab />} />
      <Route path="/backtest/:id" element={<BacktestResults />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
