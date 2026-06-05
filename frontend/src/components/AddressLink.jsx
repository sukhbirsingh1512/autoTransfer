import { ExternalLink } from 'lucide-react';
import { bscScanAddress, shortAddr } from '../lib/format';

export default function AddressLink({ address, full = false }) {
  if (!address) return <span className="text-slate-500">—</span>;
  return (
    <a
      href={bscScanAddress(address)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-brand-400"
    >
      {full ? address : shortAddr(address)}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}
