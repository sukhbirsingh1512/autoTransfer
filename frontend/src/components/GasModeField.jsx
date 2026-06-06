import { Zap, Coins } from 'lucide-react';

/**
 * Segmented control for choosing a wallet's gas top-up strategy.
 *   FIXED     — send the wallet's topUpAmount BNB every time.
 *   ESTIMATED — estimate the actual gas cost for the upcoming tx and top up only
 *               the deficit (saves idle BNB).
 */
export default function GasModeField({ value = 'FIXED', onChange, label = 'Gas top-up mode' }) {
  const options = [
    {
      key: 'FIXED',
      title: 'Fixed amount',
      desc: 'Send the configured top-up amount every time.',
      icon: Coins,
    },
    {
      key: 'ESTIMATED',
      title: 'Estimate per tx',
      desc: 'Calculate the exact cost and top up only what is needed.',
      icon: Zap,
    },
  ];
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const selected = value === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`text-left rounded-xl border px-3 py-2.5 transition flex gap-2.5 items-start
                ${
                  selected
                    ? 'border-brand-500/60 bg-brand-600/10 shadow-glow'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? 'text-brand-400' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <div className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-300'}`}>
                  {opt.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
