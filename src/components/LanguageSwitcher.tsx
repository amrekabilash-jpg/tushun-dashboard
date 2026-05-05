import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'ru', label: 'РУС', flag: '🇷🇺' },
  { code: 'tr', label: 'TUR', flag: '🇹🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="lang-switcher">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={`lang-btn${i18n.language === l.code ? ' active' : ''}`}
          onClick={() => i18n.changeLanguage(l.code)}
          title={l.label}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}
