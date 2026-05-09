import { useAppStore } from '../../store';
import ExpensesTab from './tabs/ExpensesTab';
import BudgetTab from './tabs/BudgetTab';
import AnalyticsTab from './tabs/AnalyticsTab';

const TABS = [
  { id: 'm7-overview', label: 'Расходы' },
  { id: 'm7-budget',   label: 'Категории и бюджет' },
  { id: 'm7-analytics', label: 'Анализ' },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm7-overview': return <ExpensesTab />;
    case 'm7-budget':   return <BudgetTab />;
    case 'm7-analytics': return <AnalyticsTab />;
    default:             return <ExpensesTab />;
  }
}

export default function Module7() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[7] || 'm7-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 07</div>
          <div className="page-title">РАСХОДЫ И БЮДЖЕТ</div>
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
            onClick={() => setTab(7, t.id)}
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
