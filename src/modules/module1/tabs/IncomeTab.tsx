import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const salesData = [
  { date: '01', amount: 3420 }, { date: '05', amount: 1850 }, { date: '08', amount: 5680 },
  { date: '12', amount: 4200 }, { date: '15', amount: 7100 }, { date: '18', amount: 3900 },
  { date: '21', amount: 6200 }, { date: '24', amount: 8800 }, { date: '27', amount: 5100 },
  { date: '30', amount: 9450 },
];

const categories = [
  { name: 'Масляные фильтры (легк.)', value: '₸19.5М', pct: 35, color: '#C9A227' },
  { name: 'Грузовые фильтры', value: '₸15.6М', pct: 28, color: '#60A5FA' },
  { name: 'Воздушные фильтры (легк.)', value: '₸11.1М', pct: 20, color: '#34D399' },
  { name: 'Японские / корейские', value: '₸6.7М', pct: 12, color: '#a78bfa' },
  { name: 'Прочие', value: '₸2.8М', pct: 5, color: '#6B7280' },
];

const topClients = [
  { name: 'ТОО АвтоАлмат', city: 'Алматы', deals: 5, amount: '12 400 000', share: '22.3%' },
  { name: 'ТОО КазФильтр', city: 'Астана', deals: 4, amount: '9 800 000', share: '17.6%' },
  { name: 'ИП Сейткали Е.Р.', city: 'Алматы', deals: 3, amount: '6 200 000', share: '11.2%' },
  { name: 'ТОО АвтоПлюс', city: 'Шымкент', deals: 3, amount: '5 100 000', share: '9.2%' },
  { name: 'ТОО МегаДеталь', city: 'Алматы', deals: 2, amount: '4 800 000', share: '8.6%' },
  { name: 'Прочие клиенты', city: '—', deals: 2, amount: '17 300 000', share: '31.1%' },
];

const managers = [
  { name: 'Нурсеит А.', dir: 'Алматы', deals: 9, revenue: '22 400 000', pct: 40.3, color: '#C9A227' },
  { name: 'Жанар К.', dir: 'Астана', deals: 7, revenue: '18 600 000', pct: 33.5, color: '#60A5FA' },
  { name: 'Арман Т.', dir: 'Юг (Шымкент)', deals: 3, revenue: '8 800 000', pct: 15.8, color: '#34D399' },
  { name: 'Дистр. Астана', dir: 'Филиал', deals: 0, revenue: '5 800 000', pct: 10.4, color: '#a78bfa' },
];

const payments = [
  { client: 'ТОО КазФильтр', type: 'Предоплата', typeClass: 'cat-prepay', invoice: 'СФ-2026-041', due: '30.04.2026', amount: '3 500 000', statusClass: 's-overdue', status: 'Просрочен' },
  { client: 'ИП Сейткали Е.Р.', type: 'Предоплата', typeClass: 'cat-prepay', invoice: 'СФ-2026-044', due: '05.05.2026', amount: '1 200 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО АвтоПлюс', type: 'Рассрочка 30д', typeClass: 'cat-install', invoice: 'СФ-2026-038', due: '15.05.2026', amount: '2 100 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО МегаДеталь', type: 'Рассрочка 30д', typeClass: 'cat-install', invoice: 'СФ-2026-039', due: '20.05.2026', amount: '2 400 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО АвтоАлмат', type: 'Рассрочка 30д', typeClass: 'cat-install', invoice: 'СФ-2026-036', due: '28.05.2026', amount: '2 200 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО КазФильтр', type: 'Предоплата', typeClass: 'cat-prepay', invoice: 'СФ-2026-042', due: '01.05.2026', amount: '4 800 000', statusClass: 's-paid', status: 'Оплачен' },
];

export default function IncomeTab() {
  return (
    <>
      <div className="filter-bar">
        <select className="filter-select"><option>Май 2026</option><option>Апрель 2026</option><option>Q1 2026</option></select>
        <select className="filter-select"><option>Все категории</option><option>Масляные фильтры</option><option>Воздушные фильтры</option><option>Грузовые фильтры</option></select>
        <select className="filter-select"><option>Все менеджеры</option><option>Нурсеит А.</option><option>Жанар К.</option><option>Арман Т.</option></select>
        <select className="filter-select"><option>Все клиенты</option><option>ТОО АвтоАлмат</option><option>ТОО КазФильтр</option></select>
      </div>

      <div className="kpi-row-3">
        <div className="kpi-card">
          <div className="kpi-label">Выручка за период</div>
          <div className="kpi-value"><span className="cur">₸</span>55 600 000</div>
          <div className="kpi-delta up">▲ 11.6% vs апр</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Средний чек</div>
          <div className="kpi-value"><span className="cur">₸</span>2 840 000</div>
          <div className="kpi-delta up">▲ 4.2% vs апр</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Кол-во сделок</div>
          <div className="kpi-value">19</div>
          <div className="kpi-delta up">▲ 2 vs апр</div>
          <div className="kpi-sub">из них 6 — рассрочка</div>
        </div>
      </div>

      <div className="grid-65-35">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ПРОДАЖИ ПО ДАТАМ</div>
            <span className="card-badge badge-gold">Май 2026</span>
          </div>
          <div className="chart-wrap-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}К`} />
                <Tooltip formatter={(v: any) => [`₸${v}К`, 'Продажи']} contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
                <Bar dataKey="amount" fill="#C9A227" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">ПО КАТЕГОРИЯМ</div>
            <span className="card-badge badge-gold">₸55.6М</span>
          </div>
          <div className="hbar-list" style={{ marginTop: 8 }}>
            {categories.map((c) => (
              <div key={c.name} className="hbar-item">
                <div className="hbar-meta"><span className="hbar-name">{c.name}</span><span className="hbar-val">{c.value}</span></div>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: `${c.pct}%`, background: c.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ТОП КЛИЕНТОВ</div>
            <span className="card-badge badge-gold">По выручке</span>
          </div>
          <table>
            <thead><tr><th>Клиент</th><th>Город</th><th>Сделок</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th><th style={{ textAlign: 'right' }}>Доля</th></tr></thead>
            <tbody>
              {topClients.map((c, i) => (
                <tr key={i}>
                  <td className="td-bold">{c.name}</td>
                  <td className="td-muted td-mono">{c.city}</td>
                  <td className="td-mono">{c.deals || '—'}</td>
                  <td className="td-neutral td-right">{c.amount}</td>
                  <td className="td-mono td-right" style={{ color: 'var(--gold)' }}>{c.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">ПО МЕНЕДЖЕРАМ</div>
            <span className="card-badge badge-gold">Май 2026</span>
          </div>
          <table>
            <thead><tr><th>Менеджер</th><th>Направление</th><th>Сделок</th><th style={{ textAlign: 'right' }}>Выручка, ₸</th></tr></thead>
            <tbody>
              {managers.map((m, i) => (
                <tr key={i}>
                  <td className="td-bold">{m.name}</td>
                  <td className="td-muted td-mono">{m.dir}</td>
                  <td className="td-mono">{m.deals || '—'}</td>
                  <td className="td-neutral td-right">{m.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14 }}>
            <div className="hbar-list">
              {managers.map((m) => (
                <div key={m.name} className="hbar-item">
                  <div className="hbar-meta">
                    <span className="hbar-name">{m.name}</span>
                    <span className="hbar-val" style={{ color: m.color }}>{m.pct}%</span>
                  </div>
                  <div className="hbar-track"><div className="hbar-fill" style={{ width: `${m.pct}%`, background: m.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПРЕДОПЛАТЫ И РАССРОЧКИ</div>
          <span className="card-badge badge-gold">Ожидается: ₸11 400 000</span>
        </div>
        <table>
          <thead><tr><th>Клиент</th><th>Тип</th><th>Счёт-фактура</th><th>Срок оплаты</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th><th>Статус</th></tr></thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={i}>
                <td className="td-bold">{p.client}</td>
                <td><span className={`cat ${p.typeClass}`}>{p.type}</span></td>
                <td className="td-mono td-muted">{p.invoice}</td>
                <td className="td-mono">{p.due}</td>
                <td className="td-neutral td-right">{p.amount}</td>
                <td><span className={`status ${p.statusClass}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
