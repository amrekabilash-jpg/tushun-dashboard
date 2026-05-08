import { create } from 'zustand';

interface Module3Store {
  selectedInvoiceId: number | null;
  setSelectedInvoice: (id: number | null) => void;
}

export const useModule3Store = create<Module3Store>((set) => ({
  selectedInvoiceId: null,
  setSelectedInvoice: (id) => set({ selectedInvoiceId: id }),
}));
