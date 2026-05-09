import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../../utils/api';

// Тренд маржи по месяцам — пока demo (нужен monthly bucket в backend).
const marginTrend = [
  { month: 'Янв', margin: 25.7 }, { month: 'Фев', margin: 27.5 }, { month: 'Мар', margin: 25.6 },
  { month: 'Апр', margin: 25.5 }, { month: 'Май', margin: 25.9 },
];

type MarginRow = Awaited<ReturnType<typeof api.getMarginByProduct>>['rows'][number];

const fmt = (n: number) =>
  Math.round(n).toLocaleString('ru-RU');

export default function MarginTab() {
  const [rows, setRows] = useState<MarginRow[] | null>(null);

  useEffect(() => {
    api.getMarginByProduct(30).then(r => setRows(r.rows)).catch(() => setRows([]));
  }, []);

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) {
      return { avgMargin: 0, totalRevenue: 0, totalMargin: 0, best: null as MarginRow | null, alerts: [] as MarginRow[] };
    }
    const totalRevenue = rows.reduce((s, r) => s + r.revenue_kzt, 0);
    const totalMargin = rows.reduce((s, r) => s + r.margin_kzt, 0);
    const avgMargin = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;
    const best = rows.reduce((b, r) => (r.margin_percent > (b?.margin_percent ?? -Infinity) ? r : b), rows[0]);
    const alerts = rows.filter(r => r.margin_percent < 15);
    return { avgMargin, totalRevenue, totalMargin, best, alerts };
  }, [rows]);

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Средняя маржа</div>
          <div className="kpi-value">{rows ? stats.avgMargin.toFixed(1) : '…'}<span className="cur">%</span></div>
          <div className="kpi-sub">за 30 дней · live</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Лучший продукт</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>
            {stats.best ? stats.best.product_name.slice(0, 20) : '…'}
          </div>
          <div className="kpi-delta up" style={{ marginTop: 6 }}>
            {stats.best ? `${stats.best.margin_percent.toFixed(1)}% маржа` : '…'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ниже порога (&lt;15%)</div>
          <div className="kpi-value" style={{ color: stats.alerts.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            {rows ? stats.alerts.length : '…'}
          </div>
          <div className="kpi-delta" style={{ color: 'var(--tm)' }}>
            {stats.alerts.length > 0 ? 'требуют пересмотра' : 'всё в норме'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Валовая прибыль</div>
          <div className="kpi-value"><span className="cur">₸</span>{rows ? fmt(stats.totalMargin) : '…'}</div>
          <div className="kpi-delta up">за 30 дней</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ТРЕНД МАРЖИ ПО МЕСЯЦАМ <span style={{ fontSize: 9, color: 'var(--tm)', fontWeight: 400, marginLeft: 6 }}>· demo</span></div>
            <span className="card-badge badge-gold">2026</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[15, 40]} tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Маржа']} contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                <Line dataKey="margin" stroke="#C9A227" strokeWidth={2} dot={{ fill: '#C9A227', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">МАРЖА ПО ТОВАРАМ</div>
            <span className="card-badge badge-gold">live · {rows?.length ?? 0}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {!rows && <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</div>}
            {rows && rows.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Нет продаж за период</div>
            )}
            {rows?.slice(0, 5).map((r) => {
              const color = r.margin_percent >= 28 ? '#34D399' : r.margin_percent >= 22 ? '#C9A227' : '#F87171';
              const labelColor = r.margin_percent >= 28 ? 'var(--green)' : r.margin_percent >= 22 ? 'var(--gold)' : 'var(--red)';
              const widthPct = Math.min(r.margin_percent * 2.5, 100);
              return (
                <div key={r.product_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ts)' }}>{r.product_name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: labelColor }}>{r.margin_percent.toFixed(1)}%</span>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${widthPct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-65-35">
        <div className="card">
          <div className="card-header">
            <div className="card-title">МАРЖА ПО ПРОДУКТАМ</div>
            <span className="card-badge badge-gold">live · {rows?.length ?? 0}</span>
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Товар</th><th style={{ textAlign: 'right' }}>Продаж</th><th style={{ textAlign: 'right' }}>Выручка ₸</th><th style={{ textAlign: 'right' }}>Маржа ₸</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
            <tbody>
              {!rows && (<tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>)}
              {rows && rows.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Нет продаж за период</td></tr>
              )}
              {rows?.map((r) => (
                <tr key={r.product_id}>
                  <td className="td-bold">{r.product_name}</td>
                  <td className="td-mono td-right">{r.sales_count}</td>
                  <td className="td-mono td-right">{fmt(r.revenue_kzt)}</td>
                  <td className="td-mono td-right" style={{ color: 'var(--green)' }}>+{fmt(r.margin_kzt)}</td>
                  <td className="td-right" style={{ color: r.margin_percent >= 28 ? 'var(--green)' : r.margin_percent >= 15 ? 'var(--gold)' : 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.margin_percent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">АЛЕРТЫ</div>
            <span className={`card-badge ${stats.alerts.length > 0 ? 'badge-red' : 'badge-green'}`}>
              {stats.alerts.length > 0 ? `⚠ ${stats.alerts.length}` : '✓ ok'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--tm)', marginBottom: 10 }}>Позиции с маржой ниже 15%</div>
          <div className="alert-list">
            {stats.alerts.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--tm)', padding: 12 }}>
                Все товары с маржой выше 15%. Хорошая работа.
              </div>
            ) : (
              stats.alerts.map((a) => (
                <div key={a.product_id} className="alert-item">
                  <div className="alert-name">{a.product_name}</div>
                  <div className="alert-margin">{a.margin_percent.toFixed(1)}%</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
