import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trendData = [
  { month: 'Янв', purchase: 18000, logistics: 3200, salary: 4100, rent: 2100, marketing: 600 },
  { month: 'Фев', purchase: 19400, logistics: 3800, salary: 4100, rent: 2100, marketing: 750 },
  { month: 'Мар', purchase: 17800, logistics: 3500, salary: 4100, rent: 2100, marketing: 680 },
  { month: 'Апр', purchase: 24200, logistics: 4200, salary: 4120, rent: 2100, marketing: 800 },
  { month: 'Май', purchase: 26800, logistics: 4900, salary: 4100, rent: 2100, marketing: 820 },
];

const categories = [
  { icon: '📦', name: 'Закупка товара', val: '₸26.8М', pct: '65% от расходов' },
  { icon: '🚢', name: 'Логистика / таможня', val: '₸4.9М', pct: '12% от расходов' },
  { icon: '👥', name: 'Зарплата', val: '₸4.1М', pct: '10% от расходов' },
  { icon: '🏢', name: 'Аренда', val: '₸2.1М', pct: '5% от расходов' },
  { icon: '📢', name: 'Маркетинг и реклама', val: '₸820К', pct: '2% от расходов' },
  { icon: '💡', name: 'Коммунальные услуги', val: '₸490К', pct: '1.2% от расходов' },
  { icon: '🍽️', name: 'Еда / хозрасходы', val: '₸310К', pct: '0.8% от расходов' },
  { icon: '⚡', name: 'Непредвиденные', val: '₸680К', pct: '1.7% от расходов' },
];

const salaryDepts = [
  { name: 'Менеджеры продаж (3)', val: '₸1 500 000', pct: 37, color: '#a78bfa' },
  { name: 'Склад Алматы (4)', val: '₸1 000 000', pct: 24, color: '#60A5FA' },
  { name: 'Склад Астана (2)', val: '₸520 000', pct: 13, color: '#34D399' },
  { name: 'Бухгалтерия (2)', val: '₸620 000', pct: 15, color: '#fbbf24' },
  { name: 'Администрация (1)', val: '₸460 000', pct: 11, color: '#F87171' },
];

const rentItems = [
  { name: 'Склад Алматы (1200м²)', val: '₸1 350 000', pct: 64, color: '#F87171' },
  { name: 'Офис Алматы', val: '₸450 000', pct: 21, color: '#fbbf24' },
  { name: 'Склад Астана (400м²)', val: '₸300 000', pct: 14, color: '#a78bfa' },
];

const expenses = [
  { date: '01.05.26', cat: 'Закупка', catClass: 'cat-purchase', desc: 'Tushun — партия #TR-0441', supplier: 'Tushun Auto Parts, CN', doc: 'ТН-441', amount: '−8 760 000' },
  { date: '30.04.26', cat: 'Зарплата', catClass: 'cat-salary', desc: 'Зарплата персонала — апрель', supplier: '12 сотрудников', doc: 'ВЕД-04', amount: '−4 120 000' },
  { date: '28.04.26', cat: 'Логистика', catClass: 'cat-logistics', desc: 'Таможенное оформление + фрахт', supplier: 'ТОО КазЭкспедиция', doc: 'СФ-КЭ-88', amount: '−2 340 000' },
  { date: '27.04.26', cat: 'Аренда', catClass: 'cat-rent', desc: 'Аренда склада Алматы — май', supplier: 'ТОО АлматыПрим', doc: 'ДОГ-12', amount: '−1 350 000' },
  { date: '25.04.26', cat: 'Маркетинг', catClass: 'cat-market', desc: 'Реклама Instagram + 2ГИС', supplier: 'Digital Agency', doc: 'АКТ-33', amount: '−420 000' },
  { date: '24.04.26', cat: 'Коммунальные', catClass: 'cat-util', desc: 'Электричество + интернет (склад)', supplier: 'АЛЭС / Кселл', doc: 'КВ-044', amount: '−310 000' },
  { date: '22.04.26', cat: 'Логистика', catClass: 'cat-logistics', desc: 'Доставка клиентам — апрель', supplier: 'ТОО КазДоставка', doc: 'АКТ-29', amount: '−580 000' },
  { date: '20.04.26', cat: 'Еда/хоз', catClass: 'cat-food', desc: 'Хозтовары для офиса и склада', supplier: 'Магазин', doc: 'ЧЕК', amount: '−180 000' },
  { date: '15.04.26', cat: 'Непредвид.', catClass: 'cat-other', desc: 'Ремонт погрузчика', supplier: 'ИП Серик М.', doc: 'АКТ-21', amount: '−380 000' },
];

export default function ExpensesTab() {
  return (
    <>
      <div className="exp-cat-grid">
        {categories.map((c) => (
          <div key={c.name} className="exp-cat-card">
            <div className="exp-cat-icon">{c.icon}</div>
            <div className="exp-cat-name">{c.name}</div>
            <div className="exp-cat-val">{c.val}</div>
            <div className="exp-cat-pct">{c.pct}</div>
          </div>
        ))}
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">ДИНАМИКА РАСХОДОВ ПО КАТЕГОРИЯМ</div>
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
            <div className="card-title">ЗАРПЛАТА ПО ОТДЕЛАМ</div>
            <span className="card-badge badge-gold">₸4.1М</span>
          </div>
          <div className="hbar-list" style={{ marginTop: 8 }}>
            {salaryDepts.map((d) => (
              <div key={d.name} className="hbar-item">
                <div className="hbar-meta"><span className="hbar-name">{d.name}</span><span className="hbar-val">{d.val}</span></div>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: `${d.pct}%`, background: d.color }} /></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tm)', marginBottom: 6 }}>Аренда по объектам</div>
            <div className="hbar-list">
              {rentItems.map((r) => (
                <div key={r.name} className="hbar-item">
                  <div className="hbar-meta"><span className="hbar-name">{r.name}</span><span className="hbar-val">{r.val}</span></div>
                  <div className="hbar-track"><div className="hbar-fill" style={{ width: `${r.pct}%`, background: r.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ДЕТАЛЬНЫЙ РЕЕСТР РАСХОДОВ</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="filter-select"><option>Все категории</option><option>Закупка</option><option>Логистика</option><option>Зарплата</option><option>Аренда</option></select>
            <button className="btn btn-outline btn-sm">+ Добавить расход</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Дата</th><th>Категория</th><th>Описание</th><th>Поставщик / Получатель</th><th>Документ</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th></tr></thead>
          <tbody>
            {expenses.map((e, i) => (
              <tr key={i}>
                <td className="td-mono td-muted">{e.date}</td>
                <td><span className={`cat ${e.catClass}`}>{e.cat}</span></td>
                <td className="td-bold">{e.desc}</td>
                <td className="td-muted">{e.supplier}</td>
                <td className="td-mono td-muted">{e.doc}</td>
                <td className="td-neg td-right">{e.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
