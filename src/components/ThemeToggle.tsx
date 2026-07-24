import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';

const SunIcon = () => (
  <svg viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 16 16" fill="none">
    <path
      d="M13.5 9.7A5.8 5.8 0 016.3 2.5a5.8 5.8 0 107.2 7.2z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
    />
  </svg>
);

export default function ThemeToggle() {
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const { t } = useTranslation();

  const isLight = theme === 'light';
  // Кнопка подписана тем, куда переключимся, а не текущим состоянием
  const label = isLight ? t('sidebar.theme_dark') : t('sidebar.theme_light');

  return (
    <button className="theme-toggle" onClick={toggleTheme} title={label}>
      {isLight ? <SunIcon /> : <MoonIcon />}
      <span>{label}</span>
    </button>
  );
}
