// utils/toast.ts — Lightweight event-based toast system (no extra store state)
import { useStore } from '../store';
import { localizeWarning } from './warningLanguage';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastEvent {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

type ToastListener = (toast: ToastEvent) => void;
let listeners: ToastListener[] = [];

const emit = (message: string, type: ToastType, duration: number) => {
  const text = type === 'warning' || type === 'error' ? localizeWarning(message, useStore.getState().warningLanguage) : message;
  const event: ToastEvent = { id: `toast_${Date.now()}_${Math.random()}`, message: text, type, duration };
  listeners.forEach(l => l(event));
};

export const toast = {
  subscribe: (listener: ToastListener): (() => void) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  },
  success: (message: string, duration = 3500) => emit(message, 'success', duration),
  error:   (message: string, duration = 5000) => emit(message, 'error', duration),
  info:    (message: string, duration = 3500) => emit(message, 'info', duration),
  warning: (message: string, duration = 4000) => emit(message, 'warning', duration),
};
