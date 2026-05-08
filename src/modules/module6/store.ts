import { create } from 'zustand';

interface Module6Store {
  selectedClaimId: number | null;
  setSelectedClaim: (id: number | null) => void;
}

export const useModule6Store = create<Module6Store>((set) => ({
  selectedClaimId: null,
  setSelectedClaim: (id) => set({ selectedClaimId: id }),
}));
