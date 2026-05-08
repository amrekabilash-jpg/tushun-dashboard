import { useAppStore } from '../../store';
import RatesTab from './tabs/RatesTab';
import PremiumsCommissionsTab from './tabs/PremiumsCommissionsTab';
import ConverterTab from './tabs/ConverterTab';

const TABS = [
  { id: 'm5-overview',   label: 'Курсы' },
  { id: 'm5-pc',         label: 'Премии и комиссии' },
  { id: 'm5-convert',    label: 'Конвертор' },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm5-overview': return <RatesTab />;
    case 'm5-pc':       return <PremiumsCommissionsTab />;
    case 'm5-convert':  return <ConverterTab />;
    default:             return <RatesTab />;
  }
}

export default function Module5() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[5] || 'm5-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 05</div>
          <div className="page-title">ФИНАНСОВЫЕ ИНСТРУМЕНТЫ</div>
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
            onClick={() => setTab(5, t.id)}
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
