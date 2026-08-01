import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'warning';

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ToastValue {
  toasts: readonly ToastMessage[];
  push: (text: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastValue | null>(null);

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
