import { create } from 'zustand';

type PendingMfa = {
  challengeId: string;
  loginTransactionId: string;
};

type AuthState = {
  accessToken: string | null;
  pendingMfa: PendingMfa | null;
  switchingOrganization: boolean;
  setAccessToken: (token: string | null) => void;
  setPendingMfa: (pending: PendingMfa | null) => void;
  setSwitchingOrganization: (switching: boolean) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  pendingMfa: null,
  switchingOrganization: false,
  setAccessToken: (token) => set({ accessToken: token }),
  setPendingMfa: (pending) => set({ pendingMfa: pending }),
  setSwitchingOrganization: (switching) => set({ switchingOrganization: switching }),
  clearSession: () => set({ accessToken: null, pendingMfa: null, switchingOrganization: false }),
}));
