import { LogOut, ShieldCheck, Network, Menu, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NETWORK_LABEL } from '../../lib/format';

export default function Topbar({ onMenu, onChangePassword }) {
  const { admin, logout } = useAuth();
  const isTestnet = /test/i.test(NETWORK_LABEL);
  return (
    <header className="h-14 border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 sm:px-5 gap-2 sm:gap-3">
      <button
        onClick={onMenu}
        className="md:hidden btn-ghost h-9 px-2"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1" />
      <div className={`badge ${isTestnet ? 'badge-warn' : 'badge-info'} flex items-center gap-1`}>
        <Network className="w-3 h-3" /> {NETWORK_LABEL}
      </div>
      <div className="hidden sm:flex text-xs text-slate-400 items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="truncate max-w-[180px]">{admin?.email}</span>
      </div>
      <button onClick={onChangePassword} className="btn-ghost h-8 px-2 sm:px-3 text-xs flex items-center gap-1.5">
        <Key className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Change Password</span>
      </button>
      <button onClick={logout} className="btn-ghost h-8 px-2 sm:px-3 text-xs flex items-center gap-1.5">
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </header>
  );
}
