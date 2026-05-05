import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { ModuleId } from '../../types';
import LanguageSwitcher from '../LanguageSwitcher';

const NAV_ITEMS: { id: ModuleId; key: string; icon: React.ReactNode }[] = [
  {
    id: 1,
    key: 'finance',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="10" width="3" height="4" rx=".5" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8" rx=".5" fill="currentColor" opacity=".7"/><rect x="11" y="2" width="3" height="12" rx=".5" fill="currentColor" opacity=".5"/></svg>,
  },
  {
    id: 2,
    key: 'inventory',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>,
  },
  {
    id: 3,
    key: 'sales',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    id: 4,
    key: 'supply',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 12L5 8l3 3 3-4 3 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 5,
    key: 'competitors',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/><circle cx="10.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/></svg>,
  },
  {
    id: 6,
    key: 'claims',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M8 3v5l3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2"/></svg>,
  },
  {
    id: 7,
    key: 'analytics',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 13L5 8l3 3 3-6 3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 8,
    key: 'telegram',
    icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M11 3H5a2 2 0 00-2 2v4a2 2 0 002 2h1l2 2 2-2h1a2 2 0 002-2V5a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="6" cy="7" r=".8" fill="currentColor"/><circle cx="8" cy="7" r=".8" fill="currentColor"/><circle cx="10" cy="7" r=".8" fill="currentColor"/></svg>,
  },
];

export default function Sidebar() {
  const { activeModule, setModule } = useAppStore();
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">TUSHUN</div>
        <div className="logo-sub">{t('sidebar.subtitle')}</div>
      </div>
      <nav className="nav">
        <div className="nav-label">{t('sidebar.modules_label')}</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`nav-item${activeModule === item.id ? ' active' : ''}`}
            onClick={() => setModule(item.id)}
          >
            {item.icon}
            {t(`sidebar.nav.${item.key}`)}
            <span className="nav-num">{String(item.id).padStart(2, '0')}</span>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <LanguageSwitcher />
        <div className="user-row">
          <div className="avatar">АД</div>
          <div>
            <div className="user-name">{t('sidebar.user_name')}</div>
            <div className="user-role">{t('sidebar.user_role')}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
