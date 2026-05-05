import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import OverviewTab from './tabs/OverviewTab';
import IncomeTab from './tabs/IncomeTab';
import ExpensesTab from './tabs/ExpensesTab';
import CashflowTab from './tabs/CashflowTab';
import MarginTab from './tabs/MarginTab';
import PlanTab from './tabs/PlanTab';
import DebtsTab from './tabs/DebtsTab';
import BanksTab from './tabs/BanksTab';

function renderTab(tab: string) {
  switch (tab) {
    case 'overview': return <OverviewTab />;
    case 'income': return <IncomeTab />;
    case 'expenses': return <ExpensesTab />;
    case 'cashflow': return <CashflowTab />;
    case 'margin': return <MarginTab />;
    case 'plan': return <PlanTab />;
    case 'm1-debts': return <DebtsTab />;
    case 'm1-banks': return <BanksTab />;
    default: return <OverviewTab />;
  }
}

export default function Module1() {
  const { activeTabs, setTab } = useAppStore();
  const { t } = useTranslation();
  const activeTab = activeTabs[1];

  const TABS = [
    { id: 'overview', label: t('module1.tabs.overview') },
    { id: 'income', label: t('module1.tabs.income') },
    { id: 'expenses', label: t('module1.tabs.expenses') },
    { id: 'cashflow', label: t('module1.tabs.cashflow') },
    { id: 'margin', label: t('module1.tabs.margin') },
    { id: 'plan', label: t('module1.tabs.plan') },
    { id: 'm1-debts', label: t('module1.tabs.debts'), style: { color: 'var(--red)' } },
    { id: 'm1-banks', label: t('module1.tabs.banks') },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{t('module1.eyebrow')}</div>
          <div className="page-title">{t('module1.title')}</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            {t('module1.btn_add')}
          </button>
          <button className="btn btn-gold">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 7l3 4 3-4M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t('module1.btn_export')}
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        {TABS.map((t_) => (
          <button
            key={t_.id}
            className={`sub-tab${activeTab === t_.id ? ' active' : ''}`}
            style={t_.style}
            onClick={() => setTab(1, t_.id)}
          >
            {t_.label}
          </button>
        ))}
      </div>

      <div className={`section${true ? ' active' : ''}`}>
        {renderTab(activeTab)}
      </div>
    </>
  );
}
