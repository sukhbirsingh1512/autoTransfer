import { ExternalLink } from 'lucide-react';
import { bscScanTx, shortHash } from '../lib/format';

export default function TxLink({ hash }) {
  if (!hash) return <span className="text-slate-500">—</span>;
  return (
    <a
      href={bscScanTx(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-brand-400"
    >
      {shortHash(hash)}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}
