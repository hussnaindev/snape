// Minimal, dependency-free toast system. A module-level pub/sub feeds the
// <Toaster /> mounted in the root layout; anywhere in the app can call
// showToast(...) to surface a transient message.

export interface ToastItem {
  id: number;
  message: string;
  icon?: 'download' | 'check' | 'error';
}

type Listener = (toasts: ToastItem[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];
let nextId = 1;
const DURATION_MS = 3500;

function emit(): void {
  for (const cb of listeners) cb(toasts);
}

export function subscribeToasts(cb: Listener): () => void {
  listeners.add(cb);
  cb(toasts);
  return () => {
    listeners.delete(cb);
  };
}

export function showToast(message: string, icon?: ToastItem['icon']): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, ...(icon ? { icon } : {}) }];
  emit();
  setTimeout(() => dismissToast(id), DURATION_MS);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
