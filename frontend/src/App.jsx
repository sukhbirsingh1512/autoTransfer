import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Wallets from './pages/Wallets';
import Tokens from './pages/Tokens';
import GasWallets from './pages/GasWallets';
import FundingWallets from './pages/FundingWallets';
import Transfers from './pages/Transfers';
import GasTopUps from './pages/GasTopUps';
import Fundings from './pages/Fundings';
import StakingRequests from './pages/StakingRequests';
import StakingDetail from './pages/StakingDetail';
import StakingHistory from './pages/StakingHistory';
import Sweeper from './pages/Sweeper';
import Logs from './pages/Logs';
import RpcHealth from './pages/RpcHealth';

function RequireAuth({ children }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/gas-wallets" element={<GasWallets />} />
        <Route path="/funding-wallets" element={<FundingWallets />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/gas-top-ups" element={<GasTopUps />} />
        <Route path="/fundings" element={<Fundings />} />
        <Route path="/staking" element={<StakingRequests />} />
        <Route path="/staking/history" element={<StakingHistory />} />
        <Route path="/staking/:id" element={<StakingDetail />} />
        <Route path="/sweeper" element={<Sweeper />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/rpc" element={<RpcHealth />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
