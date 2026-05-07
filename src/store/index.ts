import { create } from 'zustand';
import { ModuleId } from '../types';

/** Что показывать в основной области:
 *  - модуль 1..8 (полные модули из плана дашборда)
 *  - инструмент: tax-settings (админ), import-batch, reports (P&L) */
export type RouteId = ModuleId | 'tax-settings' | 'import-batch' | 'reports';

interface AppStore {
  route: RouteId;
  setRoute: (r: RouteId) => void;
  /** legacy совместимость: модуль = текущий, если route это модуль */
  activeModule: ModuleId;
  setModule: (id: ModuleId) => void;
  activeTabs: Record<ModuleId, string>;
  setTab: (module: ModuleId, tab: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  route: 1,
  activeModule: 1,
  setRoute: (route) =>
    set((s) => ({
      route,
      activeModule: typeof route === 'number' ? (route as ModuleId) : s.activeModule,
    })),
  setModule: (id) => set({ activeModule: id, route: id }),
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
