import { useAppStore } from '../../store';
import CustomersTab from './tabs/CustomersTab';
import InvoicesTab from './tabs/InvoicesTab';
import InvoiceDetailTab from './tabs/InvoiceDetailTab';
import PaymentTab from './tabs/PaymentTab';
import AgingTab from './tabs/AgingTab';

const TABS = [
  { id: 'm3-overview',   label: 'Обзор' },
  { id: 'm3-customers',  label: 'Клиенты' },
  { id: 'm3-invoices',   label: 'Счета-фактуры' },
  { id: 'm3-detail',     label: 'Детали счёта' },
  { id: 'm3-payments',   label: 'Платежи' },
  { id: 'm3-aging',      label: 'Дебиторка', style: { color: 'var(--red)' } as React.CSSProperties },
];

function renderTab(tab: string) {
  switch (tab) {
    case 'm3-overview':  return <AgingTab />;  // Aging как обзор по умолчанию
    case 'm3-customers': return <CustomersTab />;
    case 'm3-invoices':  return <InvoicesTab />;
    case 'm3-detail':    return <InvoiceDetailTab />;
    case 'm3-payments':  return <PaymentTab />;
    case 'm3-aging':     return <AgingTab />;
    default:              return <AgingTab />;
  }
}

export default function Module3() {
  const { activeTabs, setTab } = useAppStore();
  const activeTab = activeTabs[3] || 'm3-overview';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 03</div>
          <div className="page-title">ПРОДАЖИ И КЛИЕНТЫ</div>
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
            style={t.style}
            onClick={() => setTab(3, t.id)}
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
