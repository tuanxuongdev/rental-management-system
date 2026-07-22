import { create } from 'zustand';

/**
 * In-memory UI shell state only.
 * Must never store access or refresh tokens (see auth coding standard).
 */
type AuthShellState = {
  isAuthenticatedSkeleton: boolean;
  activeOrganizationLabel: string | null;
  setAuthenticatedSkeleton: (value: boolean) => void;
  setActiveOrganizationLabel: (label: string | null) => void;
  reset: () => void;
};

export const useAuthShellStore = create<AuthShellState>((set) => ({
  isAuthenticatedSkeleton: false,
  activeOrganizationLabel: null,
  setAuthenticatedSkeleton: (value) => set({ isAuthenticatedSkeleton: value }),
  setActiveOrganizationLabel: (label) => set({ activeOrganizationLabel: label }),
  reset: () => set({ isAuthenticatedSkeleton: false, activeOrganizationLabel: null }),
}));
