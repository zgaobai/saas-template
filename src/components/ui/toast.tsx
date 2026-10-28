import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  show: (
    message: string,
    options?: { type?: ToastType; description?: string; duration?: number },
  ) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const type = options?.type || "info";
    const duration = options?.duration ?? (type === "error" ? 4500 : 3200);
    const item: ToastItem = {
      id,
      type,
      message,
      description: options?.description,
      duration,
    };
    toasts = [...toasts, item];
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  success: (message: string, description?: string) =>
    toast.show(message, { type: "success", description }),
  error: (message: string, description?: string) =>
    toast.show(message, { type: "error", description }),
  info: (message: string, description?: string) =>
    toast.show(message, { type: "info", description }),
  warning: (message: string, description?: string) =>
    toast.show(message, { type: "warning", description }),
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <aside
      className="toast-viewport"
      aria-label="Notifications"
      role="region"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast-item toast-${item.type}`}
          role={item.type === "error" ? "alert" : "status"}
          aria-live={item.type === "error" ? "assertive" : "polite"}
        >
          <div className="toast-icon-wrap">
            {item.type === "success" && <CheckCircle2 size={18} />}
            {item.type === "error" && <AlertCircle size={18} />}
            {item.type === "warning" && <AlertTriangle size={18} />}
            {item.type === "info" && <Info size={18} />}
          </div>
          <div className="toast-content">
            <p className="toast-message">{item.message}</p>
            {item.description && (
              <p className="toast-description">{item.description}</p>
            )}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => toast.dismiss(item.id)}
            aria-label="关闭提示"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </aside>
  );
}
