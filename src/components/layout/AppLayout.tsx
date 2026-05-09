import { useEffect } from 'react';
import { useAppStore } from '../../store';
import Sidebar from './Sidebar';
import { ModuleId } from '../../types';
import { getModuleComponent } from '../../modules/moduleRegistry';
import TaxSettingsPage from '../../pages/TaxSettingsPage';
import ImportBatchPage from '../../pages/ImportBatchPage';
import FinanceReportsPage from '../../pages/FinanceReportsPage';

export default function AppLayout() {
  const route = useAppStore(s => s.route);
  const setRoute = useAppStore(s => s.setRoute);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);

  const goHome = () => setRoute(1);

  // Закрывать sidebar при resize до мобильного, открывать при возврате на десктоп (если был открыт)
  useEffect(() => {
    const onResize = () => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      if (isMobile && sidebarOpen) {
        // При переходе в mobile — оставляем как есть (пользователь может закрыть burger'ом)
        // Не трогаем чтобы не дёргать UX
      } else if (!isMobile) {
        // На desktop восстанавливаем из localStorage
        const stored = localStorage.getItem('tushun_sidebar_open');
        if (stored === null) {
          setSidebarOpen(true);
        } else {
          setSidebarOpen(stored === '1');
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sidebarOpen, setSidebarOpen]);

  let content;
  if (route === 'tax-settings') {
    content = (
      <TaxSettingsPage
        onOpenImport={() => setRoute('import-batch')}
        onOpenReports={() => setRoute('reports')}
      />
    );
  } else if (route === 'import-batch') {
    content = <ImportBatchPage onBack={goHome} />;
  } else if (route === 'reports') {
    content = <FinanceReportsPage onBack={goHome} />;
  } else {
    const ModuleComponent = getModuleComponent(route as ModuleId);
    content = <ModuleComponent />;
  }

  return (
    <div className={`app${sidebarOpen ? ' sidebar-open' : ' sidebar-closed'}`}>
      {/* Burger button — fixed top-left, виден всегда на мобильных, опционально на десктопе */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Скрыть меню' : 'Показать меню'}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          {sidebarOpen ? (
            // Иконка ✕
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          ) : (
            // Иконка ☰
            <>
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </button>

      {/* Backdrop — затемнение при открытом sidebar на мобильных */}
      <div
        className="sidebar-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar />
      <main className="main">{content}</main>
    </div>
  );
}
