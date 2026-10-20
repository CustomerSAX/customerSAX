import { create } from "zustand";

export type NotificationVariant = "success" | "error" | "warning" | "info";

export interface AppNotification {
  id: string;
  variant: NotificationVariant;
  title: string;
  description?: string;
  createdAt: number;
  read: boolean;
  /** Still shown as a pop-up toast; cleared after a few seconds or on dismiss. */
  toast: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  notify: (n: { variant: NotificationVariant; title: string; description?: string }) => void;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const MAX_KEPT = 30;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  notify: ({ variant, title, description }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      notifications: [{ id, variant, title, description, createdAt: Date.now(), read: false, toast: true }, ...s.notifications].slice(0, MAX_KEPT)
    }));
    // The toaster hides it after a few seconds (paused on hover); errors stay until closed.
  },
  dismissToast: (id) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, toast: false } : n)) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clear: () => set({ notifications: [] })
}));

/** Shorthand for non-React callers (mutation handlers, effects). */
export const notify = (n: { variant: NotificationVariant; title: string; description?: string }) =>
  useNotificationStore.getState().notify(n);
