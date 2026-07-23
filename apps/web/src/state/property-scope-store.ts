import { create } from 'zustand';

export type PropertyScopeId = string | 'ALL';

type PropertyScopeState = {
  propertyId: PropertyScopeId;
  setPropertyId: (propertyId: PropertyScopeId) => void;
};

/** In-memory UI preference only — never persists auth tokens. */
export const usePropertyScopeStore = create<PropertyScopeState>((set) => ({
  propertyId: 'ALL',
  setPropertyId: (propertyId) => set({ propertyId }),
}));
