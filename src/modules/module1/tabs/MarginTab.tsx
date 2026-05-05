import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const marginTrend = [
  { month: 'Янв', margin: 25.7 }, { month: 'Фев', margin: 27.5 }, { month: 'Мар', margin: 25.6 },
  { month: 'Апр', margin: 25.5 }, { month: 'Май', margin: 25.9 },
];

const byCategory = [
  { name: 'Грузовые фильтры', margin: 31.2, revenue: '₸15.6М' },
  { name: 'Японские / корейские', margin: 29.8, revenue: '₸6.7М' },
  { name: 'Масляные (легк.)', margin: 24.4, revenue: '₸19.5М' },
  { name: 'Воздушные (легк.)', margin: 22.1, revenue: '₸11.1М' },
  { name: 'Прочие', margin: 18.3, revenue: '₸2.8М' },
];

const alerts = [
  { name: 'Фильтр масл. МАЗ-500 (LF3349)', margin: '4.2%' },
  { name: 'Фильтр салонный BMW (C2500)', margin: '7.8%' },
  { name: 'Фильтр возд. VW Golf (7H0129620)', margin: '9.1%' },
];

const products = [
  { name: 'Фильтр масл. КАМАЗ-740', cat: 'Грузовые', cost: 1420, price: 2150, margin: 34.0 },
  { name: 'Фильтр масл. Toyota (JPN)', cat: 'JPN/KOR', cost: 890, price: 1260, margin: 29.4 },
  { name: 'Фильтр возд. КАМАЗ', cat: 'Грузовые', cost: 1640, price: 2310, margin: 29.0 },
  { name: 'Фильтр масл. ГАЗ-3110', cat: 'Грузовые', cost: 780, price: 1080, margin: 27.8 },
  { name: 'Фильтр масл. Honda Civic', cat: 'JPN/KOR', cost: 580, price: 790, margin: 26.6 },
  { name: 'Фильтр салонный Toyota', cat: 'Легковые', cost: 410, price: 550, margin: 25.5 },
  { name: 'Фильтр возд. Nissan', cat: 'JPN/KOR', cost: 760, price: 1010, margin: 24.8 },
  { name: 'Фильтр возд. VW Golf', cat: 'Легковые', cost: 1480, price: 1850, margin: 20.0 },
  { name: 'Фильтр салонный BMW', cat: 'Легковые', cost: 1720, price: 2100, margin: 18.1 },
  { name: 'Фильтр масл. МАЗ-500', cat: 'Грузовые', cost: 2880, price: 3240, margin: 11.1 },
];

export default function MarginTab() {
  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Средняя маржа</div>
          <div className="kpi-value">25.9<span className="cur">%</span></div>
          <div className="kpi-delta up">▲ 0.4пп vs апрель</div>
          <div className="kpi-sub">план: 26%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Лучший продукт</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>КАМАЗ-740</div>
          <div className="kpi-delta up" style={{ marginTop: 6 }}>34.0% маржа</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ниже порога (&lt;15%)</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>3</div>
          <div className="kpi-delta dn">позиции требуют пересмотра</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Валовая прибыль</div>
          <div className="kpi-value"><span className="cur">₸</span>14 400</div>
          <div className="kpi-delta up">▲ 18.5% vs апрель</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ТРЕНД МАРЖИ ПО МЕСЯЦАМ</div>
            <span className="card-badge badge-gold">2026</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[22, 30]} tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Маржа']} contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                <Line dataKey="margin" stroke="#C9A227" strokeWidth={2} dot={{ fill: '#C9A227', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">МАРЖА ПО КАТЕГОРИЯМ</div>
            <span className="card-badge badge-gold">%</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {byCategory.map((c) => (
              <div key={c.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--ts)' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: c.margin >= 28 ? 'var(--green)' : c.margin >= 22 ? 'var(--gold)' : 'var(--red)' }}>{c.margin}%</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${c.margin * 3}%`, background: c.margin >= 28 ? '#34D399' : c.margin >= 22 ? '#C9A227' : '#F87171' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-65-35">
        <div className="card">
          <div className="card-header">
            <div className="card-title">МАРЖА ПО ПРОДУКТАМ</div>
            <span className="card-badge badge-gold">Топ-10</span>
          </div>
          <table>
            <thead><tr><th>Наименование</th><th>Категория</th><th style={{ textAlign: 'right' }}>Себест., ₸</th><th style={{ textAlign: 'right' }}>Цена, ₸</th><th style={{ textAlign: 'right' }}>Маржа</th></tr></thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  <td className="td-bold">{p.name}</td>
                  <td className="td-muted td-mono">{p.cat}</td>
                  <td className="td-mono td-right">{p.cost.toLocaleString('ru-RU')}</td>
                  <td className="td-mono td-right">{p.price.toLocaleString('ru-RU')}</td>
                  <td className="td-right" style={{ color: p.margin >= 28 ? 'var(--green)' : p.margin >= 15 ? 'var(--gold)' : 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">АЛЕРТЫ</div>
            <span className="card-badge badge-red">⚠ {alerts.length}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--tm)', marginBottom: 10 }}>Позиции с маржой ниже 15%</div>
          <div className="alert-list">
            {alerts.map((a, i) => (
              <div key={i} className="alert-item">
                <div className="alert-name">{a.name}</div>
                <div className="alert-margin">{a.margin}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
