import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import AccountDetail from './pages/AccountDetail';
import History from './pages/History';
import Settings from './pages/Settings';
import Rates from './pages/Rates';
import OpenPosition from './pages/OpenPosition';
import Portfolio from './pages/Portfolio';

function App() {
  const navigate = useNavigate();

  const handlePageChange = (page: string) => {
    navigate(page === 'dashboard' ? '/' : `/${page}`);
  };

  return (
    <AppLayout onPageChange={handlePageChange}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<Navigate to="/" replace />} />
        <Route path="account/:wallet" element={<AccountDetail />} />
        <Route path="history" element={<History />} />
        <Route path="rates" element={<Rates />} />
        <Route path="open-position" element={<OpenPosition />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
