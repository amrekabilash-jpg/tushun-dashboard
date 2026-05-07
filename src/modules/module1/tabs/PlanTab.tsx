import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../../utils/api';

type PvF = Awaited<ReturnType<typeof api.getPlanVsFact>>;

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

// Цвет по проценту исполнения относительно метрики (для доходов/прибыли — выше=лучше; для расходов — ниже=лучше)
const colorByPct = (pct: number, isExpense: boolean) => {
  if (isExpense) {
    if (pct <= 95) return 'var(--green)';
    if (pct <= 105) return 'var(--yellow)';
    return 'var(--red)';
  }
  if (pct >= 100) return 'var(--green)';
  if (pct >= 90) return 'var(--yellow)';
  return 'var(--red)';
};

export default function PlanTab() {
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<PvF | null>(null);

  useEffect(() => {
    api.getPlanVsFact(year, month).then(setData).catch(() => setData(null));
  }, [year, month]);

  const headlineKpis = useMemo(() => {
    if (!data) return null;
    const find = (m: string) => data.main_rows.find(r => r.metric === m);
    return {
      revenue:    find('revenue'),
      cost:       find('cost'),
      net_profit: find('net_profit'),
      gross:      find('gross_margin'),
    };
  }, [data]);

  // Bar-chart выручки по месяцам — пока показываем только текущий месяц
  // (для тренда нужно запросить несколько месяцев, делаем proxy)
  const chartData = useMemo(() => {
    if (!data) return [];
    const map: Record<string, number> = {};
    [...data.main_rows, ...data.expense_rows].forEach(r => {
      map[r.metric] = r.fact_kzt;
    });
    return [
      { name: 'Выручка',        plan: data.main_rows.find(r => r.metric === 'revenue')?.plan_kzt    ?? 0, fact: data.main_rows.find(r => r.metric === 'revenue')?.fact_kzt    ?? 0 },
      { name: 'Себестоимость',  plan: data.main_rows.find(r => r.metric === 'cost')?.plan_kzt       ?? 0, fact: data.main_rows.find(r => r.metric === 'cost')?.fact_kzt       ?? 0 },
      { name: 'Валовая маржа',  plan: data.main_rows.find(r => r.metric === 'gross_margin')?.plan_kzt ?? 0, fact: data.main_rows.find(r => r.metric === 'gross_margin')?.fact_kzt ?? 0 },
      { name: 'Чистая прибыль', plan: data.main_rows.find(r => r.metric === 'net_profit')?.plan_kzt ?? 0, fact: data.main_rows.find(r => r.metric === 'net_profit')?.fact_kzt ?? 0 },
    ];
  }, [data]);

  const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  return (
    <>
      <div className="filter-bar">
        <select className="filter-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS_RU.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m} {year}</option>
          ))}
        </select>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
          alignSelf: 'center', marginLeft: 8, letterSpacing: '.08em',
        }}>
          {data ? `${data.period_start} — ${data.period_end}` : '…'}
        </span>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Выручка: план vs факт</div>
          <div className="kpi-value">
            {headlineKpis?.revenue ? headlineKpis.revenue.achievement_percent.toFixed(1) : '…'}<span className="cur">%</span>
          </div>
          <div className="kpi-delta" style={{
            color: colorByPct(headlineKpis?.revenue?.achievement_percent ?? 0, false),
            background: 'rgba(201,162,39,.08)',
          }}>
            {headlineKpis?.revenue && headlineKpis.revenue.diff_kzt >= 0 ? '▲' : '▼'} {headlineKpis ? fmt(Math.abs(headlineKpis.revenue?.diff_kzt ?? 0)) : '…'} ₸
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Чистая прибыль</div>
          <div className="kpi-value">
            {headlineKpis?.net_profit ? headlineKpis.net_profit.achievement_percent.toFixed(1) : '…'}<span className="cur">%</span>
          </div>
          <div className="kpi-delta" style={{
            color: colorByPct(headlineKpis?.net_profit?.achievement_percent ?? 0, false),
          }}>
            план: ₸{headlineKpis ? fmt(headlineKpis.net_profit?.plan_kzt ?? 0) : '…'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Себестоимость</div>
          <div className="kpi-value" style={{ color: colorByPct(headlineKpis?.cost?.achievement_percent ?? 0, true) }}>
            {headlineKpis?.cost ? headlineKpis.cost.achievement_percent.toFixed(1) : '…'}<span className="cur" style={{ color: 'inherit' }}>%</span>
          </div>
          <div className="kpi-delta">
            факт: ₸{headlineKpis ? fmt(headlineKpis.cost?.fact_kzt ?? 0) : '…'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Валовая маржа</div>
          <div className="kpi-value">
            {headlineKpis?.gross ? headlineKpis.gross.achievement_percent.toFixed(1) : '…'}<span className="cur">%</span>
          </div>
          <div className="kpi-delta">факт: ₸{headlineKpis ? fmt(headlineKpis.gross?.fact_kzt ?? 0) : '…'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПЛАН vs ФАКТ — ОСНОВНЫЕ ПОКАЗАТЕЛИ</div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--border-l)' }} />План</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#C9A227' }} />Факт</div>
          </div>
        </div>
        <div className="chart-wrap-lg">
          {!data ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tm)' }}>Загрузка…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                <Tooltip
                  formatter={(v) => `₸${fmt(Number(v))}`}
                  contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }}
                />
                <Bar dataKey="plan" name="План" fill="var(--border-l)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="fact" name="Факт" fill="#C9A227" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПЛАН vs ФАКТ — ДЕТАЛИЗАЦИЯ</div>
          <span className="card-badge badge-gold">{MONTHS_RU[month - 1]} {year}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Показатель</th>
              <th style={{ textAlign: 'right' }}>План</th>
              <th style={{ textAlign: 'right' }}>Факт</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th style={{ textAlign: 'right' }}>Исполнение</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {!data && (<tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>)}
            {data && [
              ...data.main_rows.map(r => ({ ...r, isExpense: false })),
              ...data.expense_rows.map(r => ({ ...r, isExpense: true })),
            ].map((r) => {
              const color = colorByPct(r.achievement_percent, r.isExpense);
              return (
                <tr key={r.metric}>
                  <td className="td-bold">
                    {r.isExpense ? '— ' : ''}{r.label}
                  </td>
                  <td className="td-mono td-right td-muted">{fmt(r.plan_kzt)}</td>
                  <td className="td-mono td-right td-bold">{fmt(r.fact_kzt)}</td>
                  <td className="td-mono td-right" style={{ color: r.diff_kzt >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r.diff_kzt >= 0 ? '+' : ''}{fmt(r.diff_kzt)}
                  </td>
                  <td className="td-right" style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color }}>
                    {r.achievement_percent.toFixed(1)}%
                  </td>
                  <td style={{ width: 120 }}>
                    <div className="plan-inline-bar">
                      <div className="plan-inline-fill" style={{ width: `${Math.min(r.achievement_percent, 100)}%`, background: color }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
