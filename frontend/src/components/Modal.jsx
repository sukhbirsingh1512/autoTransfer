import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className={`card w-full ${maxWidth} max-h-[95vh] sm:max-h-[90vh] overflow-auto rounded-b-none sm:rounded-2xl`}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <h2 className="text-base font-semibold truncate">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white -mr-1 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
