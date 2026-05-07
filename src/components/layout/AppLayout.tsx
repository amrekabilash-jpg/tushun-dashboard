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

  const goHome = () => setRoute(1);

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
    <div className="app">
      <Sidebar />
      <main className="main">{content}</main>
    </div>
  );
}
