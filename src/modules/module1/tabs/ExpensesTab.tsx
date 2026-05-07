import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../../utils/api';

// Помесячная динамика — пока demo (нужен monthly bucket в backend)
const trendData = [
  { month: 'Янв', purchase: 18000, logistics: 3200, salary: 4100, rent: 2100 },
  { month: 'Фев', purchase: 19400, logistics: 3800, salary: 4100, rent: 2100 },
  { month: 'Мар', purchase: 17800, logistics: 3500, salary: 4100, rent: 2100 },
  { month: 'Апр', purchase: 24200, logistics: 4200, salary: 4120, rent: 2100 },
  { month: 'Май', purchase: 26800, logistics: 4900, salary: 4100, rent: 2100 },
];

type Summary = Awaited<ReturnType<typeof api.getCashSummary>>;
type Tx = Awaited<ReturnType<typeof api.listCashTransactions>>['rows'][number];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtMln = (n: number) => n >= 1_000_000 ? `₸${(n / 1_000_000).toFixed(1)}М` : `₸${(n / 1000).toFixed(0)}К`;

const CATEGORY_META: Record<string, { icon: string; label: string; cssClass: string }> = {
  purchase:  { icon: '📦', label: 'Закупка товара',       cssClass: 'cat-purchase' },
  logistics: { icon: '🚢', label: 'Логистика / таможня',  cssClass: 'cat-logistics' },
  salary:    { icon: '👥', label: 'Зарплата',             cssClass: 'cat-salary' },
  rent:      { icon: '🏢', label: 'Аренда',               cssClass: 'cat-rent' },
  marketing: { icon: '📢', label: 'Маркетинг и реклама',  cssClass: 'cat-market' },
  utilities: { icon: '💡', label: 'Коммунальные услуги',  cssClass: 'cat-util' },
  tax:       { icon: '🧾', label: 'Налоги',               cssClass: 'cat-other' },
  other:     { icon: '⚡', label: 'Прочие расходы',       cssClass: 'cat-food' },
  sales:     { icon: '💰', label: 'Поступления',          cssClass: 'cat-income' },
};

export default function ExpensesTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [filterCat, setFilterCat] = useState<string>('all');

  useEffect(() => {
    api.getCashSummary(30).then(setSummary).catch(() => setSummary(null));
    api.listCashTransactions(30).then(d => setTxs(d.rows)).catch(() => setTxs([]));
  }, []);

  const expenses = useMemo(() => {
    const filtered = (txs ?? []).filter(t => t.type === 'expense');
    if (filterCat === 'all') return filtered;
    return filtered.filter(t => t.category === filterCat);
  }, [txs, filterCat]);

  return (
    <>
      <div className="exp-cat-grid">
        {!summary && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--tm)', padding: 30 }}>Загрузка…</div>
        )}
        {summary?.by_category.map(c => {
          const meta = CATEGORY_META[c.category] ?? { icon: '•', label: c.category, cssClass: 'cat-other' };
          return (
            <div key={c.category} className="exp-cat-card">
              <div className="exp-cat-icon">{meta.icon}</div>
              <div className="exp-cat-name">{meta.label}</div>
              <div className="exp-cat-val">{fmtMln(c.total_kzt)}</div>
              <div className="exp-cat-pct">{c.percent_of_expenses}% от расходов</div>
            </div>
          );
        })}
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ДИНАМИКА РАСХОДОВ ПО КАТЕГОРИЯМ
              <span style={{ fontSize: 9, color: 'var(--tm)', fontWeight: 400, marginLeft: 6 }}>· demo</span>
            </div>
            <span className="card-badge badge-gold">Янв — Май 2026</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  {[['gPur','#60A5FA'],['gLog','#fbbf24'],['gSal','#a78bfa']].map(([id,c]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}К`} />
                <Tooltip contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                <Area dataKey="purchase" name="Закупка" stroke="#60A5FA" fill="url(#gPur)" strokeWidth={1.5} dot={false} />
                <Area dataKey="logistics" name="Логистика" stroke="#fbbf24" fill="url(#gLog)" strokeWidth={1.5} dot={false} />
                <Area dataKey="salary" name="Зарплата" stroke="#a78bfa" fill="url(#gSal)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">СТРУКТУРА · 30 ДНЕЙ</div>
            <span className="card-badge badge-gold">{summary ? fmtMln(summary.expense_kzt) : '…'}</span>
          </div>
          <div className="hbar-list" style={{ marginTop: 8 }}>
            {summary?.by_category.slice(0, 8).map((c, i) => {
              const meta = CATEGORY_META[c.category] ?? { label: c.category, icon: '•' };
              const colors = ['#60A5FA', '#a78bfa', '#fbbf24', '#F87171', '#34D399', '#6EE7B7', '#FBBF24', '#9CA3AF'];
              return (
                <div key={c.category} className="hbar-item">
                  <div className="hbar-meta">
                    <span className="hbar-name">{meta.icon} {meta.label}</span>
                    <span className="hbar-val">{fmtMln(c.total_kzt)}</span>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${c.percent_of_expenses}%`, background: colors[i % colors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ДЕТАЛЬНЫЙ РЕЕСТР РАСХОДОВ</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">Все категории</option>
              {Object.entries(CATEGORY_META).filter(([k]) => k !== 'sales').map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm" disabled title="Phase 2.5">+ Добавить расход</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Дата</th><th>Категория</th><th>Описание</th><th>Контрагент</th><th>Счёт</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th></tr></thead>
          <tbody>
            {!txs && (<tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>)}
            {txs && expenses.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Нет расходов в этой категории</td></tr>
            )}
            {expenses.map((e) => {
              const meta = CATEGORY_META[e.category ?? 'other'] ?? CATEGORY_META.other;
              return (
                <tr key={e.id}>
                  <td className="td-mono td-muted">{e.transaction_date}</td>
                  <td><span className={`cat ${meta.cssClass}`}>{meta.label.split(' ')[0]}</span></td>
                  <td className="td-bold">{e.description ?? '—'}</td>
                  <td className="td-muted">{e.counterparty ?? '—'}</td>
                  <td className="td-mono td-muted">{e.bank_name ?? '—'}</td>
                  <td className="td-neg td-right">−{fmt(e.amount_kzt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
