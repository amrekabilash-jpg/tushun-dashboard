import { create } from 'zustand';

interface Module4Store {
  selectedBatchId: number | null;
  setSelectedBatch: (id: number | null) => void;
}

export const useModule4Store = create<Module4Store>((set) => ({
  selectedBatchId: null,
  setSelectedBatch: (id) => set({ selectedBatchId: id }),
}));
