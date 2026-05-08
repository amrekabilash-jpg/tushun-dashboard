import { useAppStore } from '../../store';
import OverviewTab from './tabs/OverviewTab';
import InvoicesTab from './tabs/InvoicesTab';
import CostBreakdownTab from './tabs/CostBreakdownTab';
import TrackingTab from './tabs/TrackingTab';

const TABS = [
  { id: 'm4-overview', label: 'Обзор' },
  { id: 'm4-invoices', label: 'Партии' },
  { id: 'm4-cost',     label: 'Себестоимость' },
  { id: 'm4-tracking', label: 'Отслеживание' },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm4-overview': return <OverviewTab />;
    case 'm4-invoices': return <InvoicesTab />;
    case 'm4-cost':     return <CostBreakdownTab />;
    case 'm4-tracking': return <TrackingTab />;
    default:             return <OverviewTab />;
  }
}

export default function Module4() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[4] || 'm4-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 04</div>
          <div className="page-title">ПОСТАВКИ И ИМПОРТ</div>
        </div>
        <div className="header-actions">
          <span className="card-badge badge-green">PHASE 2 · LIVE</span>
        </div>
      </div>

      <div className="sub-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setTab(4, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="section active">
        {renderTab(activeTab)}
      </div>
    </>
  );
}
