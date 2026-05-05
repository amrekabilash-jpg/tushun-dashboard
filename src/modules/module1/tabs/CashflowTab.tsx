import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const cashData = [
  { day: '01', in: 3420, out: 0 }, { day: '03', in: 0, out: 1350 },
  { day: '05', in: 1850, out: 0 }, { day: '08', in: 5680, out: 8760 },
  { day: '10', in: 0, out: 2340 }, { day: '12', in: 4200, out: 0 },
  { day: '15', in: 7100, out: 4120 }, { day: '18', in: 3900, out: 580 },
  { day: '21', in: 6200, out: 0 }, { day: '24', in: 8800, out: 420 },
  { day: '27', in: 5100, out: 310 }, { day: '30', in: 9450, out: 0 },
];

const cashGapRows = [
  { label: 'Остаток начало месяца', val: '₸38 240 000', color: 'var(--tp)' },
  { label: '+ Поступления (факт)', val: '+₸44 698 000', color: 'var(--green)' },
  { label: '− Платежи', val: '−₸40 758 000', color: 'var(--red)' },
  { label: 'Остаток конец месяца', val: '₸42 180 000', color: 'var(--tp)' },
];

const upcoming = [
  { date: '05.05', desc: 'Предоплата — ИП Сейткали', type: 'in', amount: '+1 200 000' },
  { date: '10.05', desc: 'Tushun — партия #TR-0442', type: 'out', amount: '−6 800 000' },
  { date: '15.05', desc: 'Рассрочка — ТОО АвтоПлюс', type: 'in', amount: '+2 100 000' },
  { date: '20.05', desc: 'Зарплата — май', type: 'out', amount: '−4 120 000' },
  { date: '20.05', desc: 'Рассрочка — ТОО МегаДеталь', type: 'in', amount: '+2 400 000' },
  { date: '27.05', desc: 'Аренда — июнь', type: 'out', amount: '−2 100 000' },
  { date: '28.05', desc: 'Рассрочка — ТОО АвтоАлмат', type: 'in', amount: '+2 200 000' },
];

export default function CashflowTab() {
  return (
    <>
      <div className="kpi-row-3">
        <div className="kpi-card" style={{ borderColor: 'rgba(201,162,39,.2)' }}>
          <div className="kpi-label">Остаток на счетах</div>
          <div className="cf-balance">
            <div className="cf-balance-cur">₸</div>
            <div className="cf-balance-val">42 180 000</div>
          </div>
          <div className="cf-balance-label">на 01.05.2026</div>
          <div className="kpi-delta up" style={{ marginTop: 8 }}>▲ +₸3 940 000</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Поступило (факт)</div>
          <div className="kpi-value"><span className="cur">₸</span>44 698 000</div>
          <div className="kpi-delta up">▲ 80.4% от P&L</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Кассовый разрыв (риск)</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}><span className="cur" style={{ color: 'var(--yellow)' }}>₸</span>6 800 000</div>
          <div className="kpi-delta dn">Tushun — платёж 10.05</div>
          <div className="kpi-sub">покрывается ожидаемыми поступлениями</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ДВИЖЕНИЕ ДЕНЕГ — МАЙ 2026</div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#34D399' }} />Поступления</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#F87171' }} />Платежи</div>
          </div>
        </div>
        <div className="chart-wrap-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}К`} />
              <Tooltip contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
              <Bar dataKey="in" name="Поступления" fill="#34D399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="out" name="Платежи" fill="#F87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">БАЛАНС КАССЫ — МАЙ</div>
            <span className="card-badge badge-gold">Итог</span>
          </div>
          <div className="pl-rows">
            {cashGapRows.map((r, i) => (
              <div key={i} className={`pl-row${i === cashGapRows.length - 1 ? ' total' : ''}`}>
                <div className={`pl-label${i === cashGapRows.length - 1 ? '' : ''}`}>{r.label}</div>
                <div className="pl-val" style={{ color: r.color }}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">ПРЕДСТОЯЩИЕ ПЛАТЕЖИ</div>
            <span className="card-badge badge-gold">Май 2026</span>
          </div>
          <table>
            <thead><tr><th>Дата</th><th>Описание</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th></tr></thead>
            <tbody>
              {upcoming.map((u, i) => (
                <tr key={i}>
                  <td className="td-mono td-muted">{u.date}</td>
                  <td className="td-bold">{u.desc}</td>
                  <td className={`td-right ${u.type === 'in' ? 'td-pos' : 'td-neg'}`}>{u.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
