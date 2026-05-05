import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const ok = login(email.trim(), password);
    if (!ok) setError(t('login.error'));
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" />

      <div className="login-box">
        {/* LOGO */}
        <div className="login-logo">
          <div className="login-logo-mark">TUSHUN</div>
          <div className="login-logo-sub">{t('subtitle')}</div>
        </div>

        {/* TITLE */}
        <div className="login-title">{t('login.title')}</div>
        <div className="login-sub">{t('login.subtitle')}</div>

        {/* FORM */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">{t('login.email')}</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                className="login-input"
                type="email"
                placeholder={t('login.email_placeholder')}
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">{t('login.password')}</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                className="login-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                }
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading
              ? <span className="login-spinner" />
              : t('login.btn')
            }
          </button>
        </form>

        {/* HINT */}
        <div className="login-hint">
          <span>{t('login.hint_admin')}</span>
          <span className="login-hint-cred" onClick={() => { setEmail('admin@tushun.kz'); setPassword('admin123'); }}>
            admin@tushun.kz / admin123
          </span>
        </div>

        {/* LANG */}
        <div className="login-lang">
          <LanguageSwitcher />
        </div>
      </div>

      {/* DECORATION */}
      <div className="login-deco login-deco-1" />
      <div className="login-deco login-deco-2" />
    </div>
  );
}
