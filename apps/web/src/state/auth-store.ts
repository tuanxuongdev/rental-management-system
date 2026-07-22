import { create } from 'zustand';

type PendingMfa = {
  challengeId: string;
  loginTransactionId: string;
};

type AuthState = {
  accessToken: string | null;
  pendingMfa: PendingMfa | null;
  setAccessToken: (token: string | null) => void;
  setPendingMfa: (pending: PendingMfa | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  pendingMfa: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setPendingMfa: (pending) => set({ pendingMfa: pending }),
  clearSession: () => set({ accessToken: null, pendingMfa: null }),
}));
