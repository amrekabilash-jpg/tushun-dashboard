import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const planData = [
  { month: 'Янв', plan: 40000, fact: 38200 },
  { month: 'Фев', plan: 42000, fact: 41500 },
  { month: 'Мар', plan: 44000, fact: 39800 },
  { month: 'Апр', plan: 48000, fact: 49800 },
  { month: 'Май', plan: 52000, fact: 55600 },
];

const rows = [
  { label: 'Выручка', plan: '₸52 000 000', fact: '₸55 600 000', pct: 106.9, color: 'var(--green)' },
  { label: 'Расходы', plan: '₸39 000 000', fact: '₸41 200 000', pct: 105.6, color: 'var(--red)' },
  { label: 'Чистая прибыль', plan: '₸13 000 000', fact: '₸14 400 000', pct: 110.8, color: 'var(--green)' },
  { label: 'Маржа', plan: '26.0%', fact: '25.9%', pct: 99.6, color: 'var(--yellow)' },
  { label: 'Закупка товара', plan: '₸24 000 000', fact: '₸26 800 000', pct: 111.7, color: 'var(--red)' },
  { label: 'Зарплата', plan: '₸4 200 000', fact: '₸4 100 000', pct: 97.6, color: 'var(--green)' },
  { label: 'Логистика', plan: '₸4 500 000', fact: '₸4 900 000', pct: 108.9, color: 'var(--yellow)' },
  { label: 'Маркетинг', plan: '₸900 000', fact: '₸820 000', pct: 91.1, color: 'var(--green)' },
];

export default function PlanTab() {
  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Выручка: план vs факт</div>
          <div className="kpi-value">106.9<span className="cur">%</span></div>
          <div className="kpi-delta up">▲ Перевыполнен</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Прибыль: план vs факт</div>
          <div className="kpi-value">110.8<span className="cur">%</span></div>
          <div className="kpi-delta up">▲ +₸1 400 000</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Расходы: план vs факт</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}>105.6<span className="cur">%</span></div>
          <div className="kpi-delta dn">▲ Перерасход ₸2.2М</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Маржа</div>
          <div className="kpi-value">99.6<span className="cur">%</span></div>
          <div className="kpi-delta" style={{ color: 'var(--yellow)', background: 'rgba(251,191,36,.10)' }}>≈ В плане</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПЛАН vs ФАКТ — ДИНАМИКА ВЫРУЧКИ</div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--ts)' }} />План</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#C9A227' }} />Факт</div>
          </div>
        </div>
        <div className="chart-wrap-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}К`} />
              <Tooltip contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
              <Bar dataKey="plan" name="План" fill="var(--border-l)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="fact" name="Факт" fill="#C9A227" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПЛАН vs ФАКТ — ДЕТАЛИЗАЦИЯ</div>
          <span className="card-badge badge-gold">Май 2026</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Показатель</th>
              <th style={{ textAlign: 'right' }}>План</th>
              <th style={{ textAlign: 'right' }}>Факт</th>
              <th style={{ textAlign: 'right' }}>Исполнение</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="td-bold">{r.label}</td>
                <td className="td-mono td-right td-muted">{r.plan}</td>
                <td className="td-mono td-right td-bold">{r.fact}</td>
                <td className="td-right" style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: r.color }}>{r.pct}%</td>
                <td style={{ width: 120 }}>
                  <div className="plan-inline-bar">
                    <div className="plan-inline-fill" style={{ width: `${Math.min(r.pct, 100)}%`, background: r.color }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
