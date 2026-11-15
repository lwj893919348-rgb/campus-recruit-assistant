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
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur-sm ${
              isErr
                ? 'border-rose-200 bg-rose-50/95 text-rose-900'
                : isInfo
                  ? 'border-blue-200 bg-blue-50/95 text-blue-900'
                  : 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
            }`}
          >
            {isErr ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            ) : isInfo ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-black/5 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
