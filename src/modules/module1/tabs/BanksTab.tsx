import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../utils/api';

type Account = Awaited<ReturnType<typeof api.listAccounts>>[number];

// Карточные акценты — циклически по индексу из backend
const ACCENTS = [
  { color: '#C9A227', bg: 'rgba(201,162,39,.15)', logo: 'KS' },
  { color: '#60A5FA', bg: 'rgba(96,165,250,.15)', logo: 'HL' },
  { color: '#34D399', bg: 'rgba(52,211,153,.15)', logo: 'BC' },
  { color: '#a78bfa', bg: 'rgba(167,139,250,.15)', logo: 'BR' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const USD_RATE = 450; // должно приходить с бэка из app_settings, пока default

export default function BanksTab() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const totals = useMemo(() => {
    if (!accounts) return { kzt: 0, usd: 0, usdEqKzt: 0 };
    const kzt = accounts.filter(a => a.currency === 'KZT').reduce((s, a) => s + a.balance, 0);
    const usd = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
    return { kzt, usd, usdEqKzt: usd * USD_RATE };
  }, [accounts]);

  return (
    <>
      <div className="bank-grid">
        {!accounts && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--tm)', padding: 30 }}>Загрузка счетов…</div>
        )}
        {accounts?.map((a, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          // Пытаемся вытащить инициалы банка
          const initials = (a.bank_name ?? a.account_number).split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={a.id} className="bank-card">
              <div className="bank-card-accent" style={{ background: accent.color }} />
              <div className="bank-logo" style={{ background: accent.bg, color: accent.color }}>{initials || accent.logo}</div>
              <div className="bank-name">{a.bank_name ?? '—'}</div>
              <div className="bank-account-name">
                {a.currency === 'KZT' ? 'Расчётный KZT' : `Валютный ${a.currency}`}
              </div>
              <div className="bank-balance">
                <span className="bank-balance-cur">{a.currency === 'KZT' ? '₸' : '$'}</span>
                {fmt(a.balance)}
              </div>
              <div className="bank-balance-usd">
                {a.currency === 'KZT'
                  ? `≈ $${fmt(a.balance / USD_RATE)}`
                  : `≈ ₸${fmt(a.balance * USD_RATE)}`}
              </div>
              <div className="bank-footer">
                <span className="bank-status-active">Активен</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tm)' }}>{a.account_number}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ИТОГО ПО ВСЕМ СЧЕТАМ</div>
          <span className="card-badge badge-gold">
            ≈ ₸{accounts ? fmt(totals.kzt + totals.usdEqKzt) : '…'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {[
            { icon: '₸', label: 'Баланс KZT', val: fmt(totals.kzt), sub: `${accounts?.filter(a => a.currency === 'KZT').length ?? 0} счёта` },
            { icon: '$', label: 'Баланс USD', val: fmt(totals.usd), sub: `≈ ₸${fmt(totals.usdEqKzt)} по курсу ${USD_RATE}` },
            { icon: '↕', label: 'Курс USD/KZT', val: USD_RATE.toString(), sub: 'из app_settings' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: '18px 20px' }}>
              <div style={{ fontSize: 22, marginBottom: 8, fontFamily: 'var(--mono)', color: 'var(--gold)' }}>{c.icon}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--tp)' }}>{c.val}</div>
              <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            ПОСЛЕДНИЕ БАНКОВСКИЕ ОПЕРАЦИИ
            <span style={{ fontSize: 10, color: 'var(--tm)', fontWeight: 400, marginLeft: 8 }}>· cash_transactions API в Phase 2.4</span>
          </div>
        </div>
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tm)', fontSize: 12 }}>
          Транзакции по счетам появятся когда подключим эндпойнт <code style={{ background: 'var(--bg-el)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>/api/finance/cash-transactions</code>.<br />
          Пока остатки видны выше — они обновляются после операций (когда такой эндпойнт появится).
        </div>
      </div>
    </>
  );
}
