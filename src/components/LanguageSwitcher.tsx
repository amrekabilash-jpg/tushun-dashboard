import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'ru', label: 'РУС' },
  { code: 'tr', label: 'TUR' },
  { code: 'zh', label: '中文' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const current = i18n.resolvedLanguage ?? i18n.language ?? 'ru';

  const handleChange = (code: string) => {
    if (current === code) return;
    i18n.changeLanguage(code);
  };

  return (
    <div className="lang-switcher">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={`lang-btn${current === l.code ? ' active' : ''}`}
          onClick={() => handleChange(l.code)}
          title={l.label}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
