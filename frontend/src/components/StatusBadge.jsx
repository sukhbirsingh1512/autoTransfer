import { statusVariant } from '../lib/format';

export default function StatusBadge({ status }) {
  const v = statusVariant(status);
  const cls = {
    success: 'badge-success',
    warn: 'badge-warn',
    danger: 'badge-danger',
    info: 'badge-info',
    muted: 'badge-muted',
  }[v] || 'badge-muted';
  return <span className={cls}>{status}</span>;
}
