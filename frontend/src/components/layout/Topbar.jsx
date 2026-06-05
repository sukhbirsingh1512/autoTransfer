import { LogOut, ShieldCheck, Network } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NETWORK_LABEL } from '../../lib/format';

export default function Topbar() {
  const { admin, logout } = useAuth();
  const isTestnet = /test/i.test(NETWORK_LABEL);
  return (
    <header className="h-14 border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-10 flex items-center justify-end px-5 gap-3">
      <div className={`badge ${isTestnet ? 'badge-warn' : 'badge-info'} flex items-center gap-1`}>
        <Network className="w-3 h-3" /> {NETWORK_LABEL}
      </div>
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>{admin?.email}</span>
      </div>
      <button onClick={logout} className="btn-ghost h-8 px-3 text-xs">
        <LogOut className="w-3.5 h-3.5" /> Logout
      </button>
    </header>
  );
}
