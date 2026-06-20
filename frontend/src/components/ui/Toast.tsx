import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none" dir="rtl">
        {toasts.map(toast => (
          <ToastMessage key={toast.id} toast={toast} onDone={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Enter animation
    requestAnimationFrame(() => setVisible(true));
    // Auto dismiss after 3s
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 max-w-sm w-fit ${
        isSuccess
          ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
          : 'bg-red-50/95 border-red-200 text-red-800'
      } ${
        visible && !exiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-3 scale-95'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
      )}
      <p className="text-sm font-bold flex-1">{toast.message}</p>
      <button
        onClick={() => { setExiting(true); setTimeout(onDone, 300); }}
        className={`p-1 rounded-lg transition-colors shrink-0 ${
          isSuccess ? 'hover:bg-emerald-100' : 'hover:bg-red-100'
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
