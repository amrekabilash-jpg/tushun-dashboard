import { create } from 'zustand';
import { ModuleId } from '../types';

/** Что показывать в основной области:
 *  - модуль 1..8 (полные модули из плана дашборда)
 *  - инструмент: tax-settings (админ), import-batch, reports (P&L) */
export type RouteId = ModuleId | 'tax-settings' | 'import-batch' | 'reports';

const SIDEBAR_KEY = 'tushun_sidebar_open';

const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

const loadSidebarOpen = (): boolean => {
  if (typeof window === 'undefined') return true;
  if (isMobile()) return false;
  const stored = localStorage.getItem(SIDEBAR_KEY);
  return stored === null ? true : stored === '1';
};

interface AppStore {
  route: RouteId;
  setRoute: (r: RouteId) => void;
  /** legacy совместимость: модуль = текущий, если route это модуль */
  activeModule: ModuleId;
  setModule: (id: ModuleId) => void;
  activeTabs: Record<ModuleId, string>;
  setTab: (module: ModuleId, tab: string) => void;
  /** Состояние sidebar — открыт / закрыт. Сохраняется в localStorage на десктопе. */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  route: 1,
  activeModule: 1,
  setRoute: (route) =>
    set((s) => {
      const next: Partial<AppStore> = {
        route,
        activeModule: typeof route === 'number' ? (route as ModuleId) : s.activeModule,
      };
      // На мобильных автозакрытие sidebar при выборе пункта
      if (isMobile()) {
        next.sidebarOpen = false;
      }
      return next as AppStore;
    }),
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
  sidebarOpen: loadSidebarOpen(),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarOpen;
      if (typeof window !== 'undefined' && !isMobile()) {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      }
      return { sidebarOpen: next };
    }),
  setSidebarOpen: (open) =>
    set(() => {
      if (typeof window !== 'undefined' && !isMobile()) {
        localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0');
      }
      return { sidebarOpen: open };
    }),
}));
