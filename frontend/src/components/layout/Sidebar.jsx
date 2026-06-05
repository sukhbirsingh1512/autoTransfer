import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Coins,
  Fuel,
  Banknote,
  ArrowLeftRight,
  Sparkles,
  History,
  ScrollText,
  Activity,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/wallets', label: 'Monitoring Wallets', icon: Wallet },
  { to: '/tokens', label: 'BEP20 Tokens', icon: Coins },
  { to: '/gas-wallets', label: 'Master Gas Wallets', icon: Fuel },
  { to: '/funding-wallets', label: 'Master Funding Wallets', icon: Banknote },
  { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/gas-top-ups', label: 'Gas Top-Ups', icon: Fuel },
  { to: '/fundings', label: 'Funding History', icon: Banknote },
  { to: '/staking', label: 'Staking Requests', icon: Sparkles },
  { to: '/staking/history', label: 'Staking History', icon: History },
  { to: '/logs', label: 'Admin Logs', icon: ScrollText },
  { to: '/rpc', label: 'RPC Health', icon: Activity },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-900 bg-slate-950/80 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 shadow-glow flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">FundsTransfer</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Admin · BSC</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 text-sm">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg transition ${
                isActive
                  ? 'bg-brand-600/15 text-white border border-brand-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
