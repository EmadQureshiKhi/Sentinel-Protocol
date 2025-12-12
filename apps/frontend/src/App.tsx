import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Alerts from './pages/Alerts';
import AccountDetail from './pages/AccountDetail';
import History from './pages/History';
import Settings from './pages/Settings';
import Rates from './pages/Rates';
import OpenPosition from './pages/OpenPosition';
import Portfolio from './pages/Portfolio';

function App() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    navigate(page === 'dashboard' ? '/' : `/${page}`);
  };

  return (
    <AppLayout onPageChange={handlePageChange}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="account/:wallet" element={<AccountDetail />} />
        <Route path="alerts" element={<Alerts />} />
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
