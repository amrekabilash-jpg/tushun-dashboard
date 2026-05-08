import { useAppStore } from '../../store';
import OverviewTab from './tabs/OverviewTab';
import CatalogTab from './tabs/CatalogTab';
import StockTab from './tabs/StockTab';
import MovementTab from './tabs/MovementTab';
import ForecastTab from './tabs/ForecastTab';

const TABS = [
  { id: 'm2-overview', label: 'Обзор' },
  { id: 'm2-catalog',  label: 'Справочник товаров' },
  { id: 'm2-stock',    label: 'Остатки' },
  { id: 'm2-movement', label: 'Движение' },
  { id: 'm2-forecast', label: 'Прогноз закупок' },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm2-overview': return <OverviewTab />;
    case 'm2-catalog':  return <CatalogTab />;
    case 'm2-stock':    return <StockTab />;
    case 'm2-movement': return <MovementTab />;
    case 'm2-forecast': return <ForecastTab />;
    default:             return <OverviewTab />;
  }
}

export default function Module2() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[2] || 'm2-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 02</div>
          <div className="page-title">ТОВАРНЫЙ УЧЁТ</div>
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
            onClick={() => setTab(2, t.id)}
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
