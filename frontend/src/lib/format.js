export function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHash(h) {
  if (!h) return '';
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

const EXPLORER = (import.meta.env.VITE_EXPLORER_URL || 'https://bscscan.com').replace(/\/$/, '');

export function bscScanTx(hash) {
  return hash ? `${EXPLORER}/tx/${hash}` : null;
}

export function bscScanAddress(addr) {
  return addr ? `${EXPLORER}/address/${addr}` : null;
}

export const NETWORK_LABEL = import.meta.env.VITE_NETWORK_LABEL || 'BSC Mainnet';
export const DEFAULT_USDT = import.meta.env.VITE_USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';
export const DEFAULT_STAKING = import.meta.env.VITE_STAKING_ADDRESS || '0x73Be7c9CEcB66152f25Aa2e3cb450C61B6Dfc683';

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString();
}

const STATUS_VARIANT = {
  CONFIRMED: 'success',
  STAKING_SUCCESS: 'success',
  ACTIVE: 'success',
  ACTIVE_MONITORING: 'success',
  BROADCAST: 'info',
  PENDING: 'warn',
  DETECTED: 'warn',
  CREATED: 'warn',
  GAS_TOP_UP_PENDING: 'warn',
  GAS_READY: 'info',
  APPROVING_ALLOWANCE: 'info',
  ALLOWANCE_APPROVED: 'info',
  STAKING_IN_PROGRESS: 'info',
  PAUSED_FOR_STAKING: 'warn',
  FUNDING_IN_PROGRESS: 'info',
  TRANSFERRING_USDT_TO_MONITORING_WALLET: 'info',
  USDT_TRANSFERRED_TO_MONITORING_WALLET: 'info',
  FAILED: 'danger',
  STAKING_FAILED: 'danger',
  CANCELLED: 'muted',
  DISABLED: 'muted',
  INACTIVE: 'muted',
  SKIPPED: 'muted',
};

export function statusVariant(status) {
  return STATUS_VARIANT[status] || 'muted';
}
