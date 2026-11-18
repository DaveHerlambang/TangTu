import { create } from 'zustand';

export interface ToastInput {
  message: string;
  /** e.g. "Undo" or "Open". */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /**
   * Runs when the toast goes away *without* its action being pressed — the place to make an
   * undoable change permanent (e.g. clean up something that can't be undone).
   */
  onExpire?: () => void | Promise<void>;
  /** ms; defaults to 5s. */
  duration?: number;
}

interface Toast extends ToastInput {
  id: number;
}

interface ToastState {
  toast: Toast | null;
  show: (toast: ToastInput) => void;
  /** Close the current toast. `acted` = its action ran, so skip onExpire. */
  dismiss: (id: number, acted?: boolean) => void;
}

let nextId = 1;

/** One toast at a time; showing a new one finalizes (expires) the previous one first. */
export const useToastStore = create<ToastState>()((set, get) => ({
  toast: null,
  show: (input) => {
    const previous = get().toast;
    if (previous) void previous.onExpire?.();
    set({ toast: { ...input, id: nextId++ } });
  },
  dismiss: (id, acted = false) => {
    const current = get().toast;
    if (!current || current.id !== id) return;
    if (!acted) void current.onExpire?.();
    set({ toast: null });
  },
}));

export const showToast = (toast: ToastInput) => useToastStore.getState().show(toast);
