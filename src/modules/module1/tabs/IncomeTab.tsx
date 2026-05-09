import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../../utils/api';

type Sale = Awaited<ReturnType<typeof api.listSales>>[number];
type MarginRow = Awaited<ReturnType<typeof api.getMarginByProduct>>['rows'][number];
type Receivable = Awaited<ReturnType<typeof api.listReceivables>>[number];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtMln = (n: number) => n >= 1_000_000 ? `₸${(n / 1_000_000).toFixed(1)}М` : `₸${(n / 1000).toFixed(0)}К`;

const PRODUCT_COLORS = ['#C9A227', '#60A5FA', '#34D399', '#a78bfa', '#fbbf24', '#F87171'];
const BAR_COLORS = ['#C9A227', '#60A5FA', '#34D399', '#a78bfa', '#fbbf24', '#F87171', '#6EE7B7'];

export default function IncomeTab() {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [margin, setMargin] = useState<MarginRow[] | null>(null);
  const [receivables, setReceivables] = useState<Receivable[] | null>(null);

  useEffect(() => {
    api.listSales().then(setSales).catch(() => setSales([]));
    api.getMarginByProduct(30).then(d => setMargin(d.rows)).catch(() => setMargin([]));
    api.listReceivables().then(setReceivables).catch(() => setReceivables([]));
  }, []);

  // Агрегации
  const stats = useMemo(() => {
    if (!sales) return { revenue: 0, count: 0, avgCheck: 0, pendingCount: 0, paidCount: 0 };
    const revenue = sales.reduce((s, x) => s + x.total_revenue_kzt, 0);
    const pendingCount = sales.filter(s => s.payment_status === 'pending' || s.payment_status === 'overdue').length;
    const paidCount = sales.filter(s => s.payment_status === 'paid').length;
    return {
      revenue, count: sales.length,
      avgCheck: sales.length > 0 ? revenue / sales.length : 0,
      pendingCount, paidCount,
    };
  }, [sales]);

  const totalOutstanding = useMemo(
    () => (receivables ?? []).reduce((s, r) => s + r.outstanding_kzt, 0),
    [receivables],
  );

  // Bar-chart продаж по дням (полная дата для сортировки + короткий label для оси)
  const dailyData = useMemo(() => {
    if (!sales) return [];
    const map = new Map<string, { fullDate: string; date: string; amount: number }>();
    for (const s of sales) {
      const fullDate = s.sale_date ?? '';
      if (!fullDate) continue;
      // короткий формат "DD.MM"
      const [, m, d] = fullDate.split('-');
      const short = `${d}.${m}`;
      if (!map.has(fullDate)) map.set(fullDate, { fullDate, date: short, amount: 0 });
      map.get(fullDate)!.amount += s.total_revenue_kzt;
    }
    return Array.from(map.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [sales]);

  // Топ клиентов
  const topClients = useMemo(() => {
    if (!sales) return [];
    const map = new Map<string, { name: string; deals: number; amount: number }>();
    for (const s of sales) {
      const name = s.customer_name ?? '— без имени —';
      if (!map.has(name)) map.set(name, { name, deals: 0, amount: 0 });
      const c = map.get(name)!;
      c.deals += 1;
      c.amount += s.total_revenue_kzt;
    }
    const total = stats.revenue;
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .map(c => ({ ...c, share: total > 0 ? (c.amount / total * 100) : 0 }));
  }, [sales, stats.revenue]);

  // Категории = топ-товары из margin (как proxy для категорий, пока в БД нет товарных групп)
  const totalProductRevenue = useMemo(
    () => (margin ?? []).reduce((s, r) => s + r.revenue_kzt, 0),
    [margin],
  );

  return (
    <>
      <div className="filter-bar">
        <select className="filter-select" disabled><option>За 30 дней</option></select>
        <select className="filter-select" disabled title="Phase 2.6"><option>Все категории</option></select>
        <select className="filter-select" disabled title="Phase 2.6"><option>Все менеджеры</option></select>
        <select className="filter-select" disabled title="Phase 2.6"><option>Все клиенты</option></select>
      </div>

      <div className="kpi-row-3">
        <div className="kpi-card">
          <div className="kpi-label">Выручка за период</div>
          <div className="kpi-value"><span className="cur">₸</span>{sales ? fmt(stats.revenue) : '…'}</div>
          <div className="kpi-delta up">за 30 дней · live</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Средний чек</div>
          <div className="kpi-value"><span className="cur">₸</span>{sales ? fmt(stats.avgCheck) : '…'}</div>
          <div className="kpi-delta up">{sales ? `на ${stats.count} сделок` : '…'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Кол-во сделок</div>
          <div className="kpi-value">{sales ? stats.count : '…'}</div>
          <div className="kpi-delta up">за 30 дней · live</div>
          <div className="kpi-sub">
            {sales ? `${stats.paidCount} оплачено · ${stats.pendingCount} в ожидании` : '…'}
          </div>
        </div>
      </div>

      <div className="grid-65-35">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ПРОДАЖИ ПО ДАТАМ</div>
            <span className="card-badge badge-gold">live</span>
          </div>
          <div className="chart-wrap-lg">
            {!sales ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tm)' }}>Загрузка…</div>
            ) : dailyData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tm)' }}>Нет продаж за период</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                  <Tooltip
                    formatter={(v) => [`₸${fmt(Number(v))}`, 'Продажи']}
                    cursor={{ fill: 'rgba(201,162,39,0.06)' }}
                    contentStyle={{ background: 'var(--bg-el)', border: '1px solid rgba(201,162,39,.28)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }}
                    labelStyle={{ color: 'var(--ts)', fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: '#C9A227', fontWeight: 600 }}
                  />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {dailyData.map((_, idx) => (
                      <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">ПО ТОВАРАМ</div>
            <span className="card-badge badge-gold">{margin ? fmtMln(totalProductRevenue) : '…'}</span>
          </div>
          <div className="hbar-list" style={{ marginTop: 8 }}>
            {!margin && <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Загрузка…</div>}
            {margin?.map((r, i) => {
              const pct = totalProductRevenue > 0 ? (r.revenue_kzt / totalProductRevenue * 100) : 0;
              const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
              return (
                <div key={r.product_id} className="hbar-item">
                  <div className="hbar-meta">
                    <span className="hbar-name">{r.product_name}</span>
                    <span className="hbar-val">{fmtMln(r.revenue_kzt)}</span>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ТОП КЛИЕНТОВ</div>
            <span className="card-badge badge-gold">{topClients.length} клиентов</span>
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Клиент</th><th>Сделок</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th><th style={{ textAlign: 'right' }}>Доля</th></tr></thead>
            <tbody>
              {!sales && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>}
              {sales && topClients.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Нет клиентов</td></tr>}
              {topClients.map((c) => (
                <tr key={c.name}>
                  <td className="td-bold">{c.name}</td>
                  <td className="td-mono">{c.deals}</td>
                  <td className="td-neutral td-right">{fmt(c.amount)}</td>
                  <td className="td-mono td-right" style={{ color: 'var(--gold)' }}>{c.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ПО МЕНЕДЖЕРАМ
              <span style={{ fontSize: 9, color: 'var(--tm)', fontWeight: 400, marginLeft: 6 }}>· demo</span>
            </div>
            <span className="card-badge badge-gold">Phase 2.6</span>
          </div>
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tm)', fontSize: 12 }}>
            Атрибуция продажа → менеджер появится когда добавим<br />
            <code style={{ background: 'var(--bg-el)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>manager_id</code> в таблицу <code style={{ background: 'var(--bg-el)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>sale_items</code>.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ОЖИДАЕМЫЕ ПОСТУПЛЕНИЯ</div>
          <span className="card-badge badge-gold">
            ₸{Math.round(totalOutstanding).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Счёт-фактура</th>
              <th>Клиент</th>
              <th>Срок оплаты</th>
              <th style={{ textAlign: 'right' }}>Дней</th>
              <th style={{ textAlign: 'right' }}>Сумма, ₸</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {!receivables && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>
            )}
            {receivables && receivables.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Все счета оплачены</td></tr>
            )}
            {receivables?.map(r => {
              const isOverdue = r.payment_status === 'overdue';
              const dayLabel = isOverdue
                ? `+${r.days_overdue}`
                : r.days_until_due > 0 ? `−${r.days_until_due}` : '0';
              return (
                <tr key={r.id}>
                  <td className="td-mono">{r.invoice_number ?? '#' + r.id}</td>
                  <td className="td-bold">{r.customer_name ?? '—'}</td>
                  <td className="td-mono">{r.due_date ?? '—'}</td>
                  <td className="td-mono td-right" style={{ color: isOverdue ? 'var(--red)' : 'var(--ts)' }}>
                    {dayLabel}
                  </td>
                  <td className="td-neutral td-right">
                    {Math.round(r.outstanding_kzt).toLocaleString('ru-RU')}
                  </td>
                  <td>
                    <span className={`status ${isOverdue ? 's-overdue' : 's-pending'}`}>
                      {isOverdue ? 'Просрочен' : 'Ожидается'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
