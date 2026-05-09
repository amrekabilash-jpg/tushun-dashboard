import { useAppStore } from '../../store';
import WarrantyPlansTab from './tabs/WarrantyPlansTab';
import ClaimsTab from './tabs/ClaimsTab';
import StatsTab from './tabs/StatsTab';

const TABS = [
  { id: 'm6-overview', label: 'Гарантийные планы' },
  { id: 'm6-claims',   label: 'Рекламации' },
  { id: 'm6-stats',    label: 'Статистика' },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm6-overview': return <WarrantyPlansTab />;
    case 'm6-claims':   return <ClaimsTab />;
    case 'm6-stats':    return <StatsTab />;
    default:             return <WarrantyPlansTab />;
  }
}

export default function Module6() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[6] || 'm6-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 06</div>
          <div className="page-title">ГАРАНТИЙНЫЙ УЧЁТ</div>
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
            onClick={() => setTab(6, t.id)}
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
