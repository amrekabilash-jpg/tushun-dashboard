import { create } from 'zustand';
import { ModuleId } from '../types';

interface AppStore {
  activeModule: ModuleId;
  setModule: (id: ModuleId) => void;
  activeTabs: Record<ModuleId, string>;
  setTab: (module: ModuleId, tab: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeModule: 1,
  setModule: (id) => set({ activeModule: id }),
  activeTabs: {
    1: 'overview',
    2: 'm2-overview',
    3: 'm3-overview',
    4: 'm4-overview',
    5: 'm5-overview',
    6: 'm6-overview',
    7: 'm7-overview',
    8: 'm8-overview',
  },
  setTab: (module, tab) =>
    set((s) => ({ activeTabs: { ...s.activeTabs, [module]: tab } })),
}));
