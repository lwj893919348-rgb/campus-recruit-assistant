import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function ToastList({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const isErr = t.type === 'error';
        const isInfo = t.type === 'info';
        return (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-[0_12px_32px_-10px_rgba(15,58,54,0.22)] backdrop-blur-xl ${
              isErr
                ? 'border-rose-200/80 bg-rose-50/92 text-rose-900'
                : isInfo
                  ? 'border-sky-200/80 bg-sky-50/92 text-sky-950'
                  : 'border-teal-200/90 bg-emerald-50/92 text-teal-950'
            }`}
          >
            {isErr ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            ) : isInfo ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded-lg p-0.5 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
