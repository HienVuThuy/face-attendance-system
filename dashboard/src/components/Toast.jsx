import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: {
    bg: 'bg-emerald-50/95',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    msg: 'text-emerald-700',
  },
  error: {
    bg: 'bg-red-50/95',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900',
    msg: 'text-red-700',
  },
  info: {
    bg: 'bg-blue-50/95',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    msg: 'text-blue-700',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast Container */}
      <aside
        className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none"
        aria-live="polite"
        aria-label="Thông báo hệ thống"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || icons.info;
          const c = colors[toast.type] || colors.info;
          return (
            <div
              key={toast.id}
              role="alert"
              className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto ${c.bg} ${c.border}`}
              style={{
                animation: toast.exiting
                  ? 'toastSlideOut 0.3s ease-in forwards'
                  : 'toastSlideIn 0.3s ease-out forwards',
              }}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${c.icon}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${c.title}`}>
                  {toast.type === 'success' ? 'Thành công' : toast.type === 'error' ? 'Lỗi' : 'Thông báo'}
                </p>
                <p className={`text-sm mt-0.5 ${c.msg}`}>{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Đóng thông báo"
                className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded hover:bg-black/5 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 outline-none"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}
