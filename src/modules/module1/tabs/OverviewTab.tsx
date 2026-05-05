import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

const revenueData = [
  { month: 'Янв', revenue: 38200, expenses: 28400, profit: 9800 },
  { month: 'Фев', revenue: 41500, expenses: 30100, profit: 11400 },
  { month: 'Мар', revenue: 39800, expenses: 29600, profit: 10200 },
  { month: 'Апр', revenue: 49800, expenses: 37100, profit: 12700 },
  { month: 'Май', revenue: 55600, expenses: 41200, profit: 14400 },
];

const transactions = [
  { date: '01 Май', desc: 'Продажа — ТОО АвтоАлмат', catKey: 'cat_income', catClass: 'cat-income', amount: +3420000 },
  { date: '01 Май', desc: 'Оплата Tushun — партия #TR-0441', catKey: 'cat_purchase', catClass: 'cat-purchase', amount: -8760000 },
  { date: '30 Апр', desc: 'Зарплата сотрудников — апрель', catKey: 'cat_salary', catClass: 'cat-salary', amount: -4120000 },
  { date: '29 Апр', desc: 'Продажа — ИП Сейткали Е.Р.', catKey: 'cat_income', catClass: 'cat-income', amount: +1850000 },
  { date: '28 Апр', desc: 'Таможня + фрахт — контейнер #CT-09', catKey: 'cat_logistics', catClass: 'cat-logistics', amount: -2340000 },
  { date: '27 Апр', desc: 'Аренда склада Алматы — май', catKey: 'cat_rent', catClass: 'cat-rent', amount: -950000 },
  { date: '25 Апр', desc: 'Продажа — ТОО КазФильтр, Астана', catKey: 'cat_income', catClass: 'cat-income', amount: +5680000 },
];

const debtors = [
  { name: 'ТОО «МастерСервис»', note: 'Просрочено +29 дн.', amount: '₸2 500 000', color: 'var(--red)' },
  { name: 'ТОО «МастерСервис»', note: 'Просрочено +9 дн.', amount: '₸1 520 000', color: 'var(--red)' },
  { name: 'ТОО «АвтоДел Ю.К.»', note: 'Срок: 02.05.2026 (7 дн.)', amount: '₸4 670 000', color: 'var(--yellow)' },
  { name: 'ТОО «AutoParts KZ»', note: 'Срок: 05.05.2026 (3 дн.)', amount: '₸2 212 000', color: 'var(--yellow)' },
];

const fmt = (n: number) =>
  (n > 0 ? '+' : '') + n.toLocaleString('ru-RU');

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'var(--ts)' }}>{p.name}:</span>
          <span style={{ color: 'var(--tp)', fontWeight: 600 }}>₸{Number(p.value).toLocaleString('ru-RU')}К</span>
        </div>
      ))}
    </div>
  );
};

export default function OverviewTab() {
  const { t } = useTranslation();

  const donutData = [
    { nameKey: 'exp_purchase', value: 65, color: '#60A5FA' },
    { nameKey: 'exp_logistics', value: 12, color: '#fbbf24' },
    { nameKey: 'exp_salary', value: 10, color: '#a78bfa' },
    { nameKey: 'exp_rent', value: 5, color: '#F87171' },
    { nameKey: 'exp_marketing', value: 4, color: '#34D399' },
    { nameKey: 'exp_other', value: 4, color: '#6B7280' },
  ];

  const plRows = [
    { labelKey: 'pl_revenue', value: '₸49 800 000', type: 'neutral' },
    { labelKey: 'pl_cogs', value: '−30 870 000', type: 'neg', isSub: true },
    { labelKey: 'pl_gross', value: '₸18 930 000', type: 'pos', isBold: true },
    { labelKey: 'pl_salary', value: '−4 120 000', type: 'neg', isSub: true },
    { labelKey: 'pl_rent', value: '−950 000', type: 'neg', isSub: true },
    { labelKey: 'pl_logistics', value: '−1 160 000', type: 'neg', isSub: true },
    { labelKey: 'pl_other', value: '−560 000', type: 'neg', isSub: true },
    { labelKey: 'pl_net', value: '₸12 140 000', type: 'pos', isTotal: true },
  ];

  return (
    <>
      {/* KPI ROW */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2.5 14V10M6 14V7M9.5 14V10M13 14V4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-label">{t('overview.kpi_revenue')}</div>
          <div className="kpi-value"><span className="cur">₸</span>55 600</div>
          <div className="kpi-delta up">▲ 11.6%</div>
          <div className="kpi-sub">{t('overview.vs_april')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M3 6h11M3 9.5h7M3 13h4" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-label">{t('overview.kpi_expenses')}</div>
          <div className="kpi-value"><span className="cur">₸</span>41 200</div>
          <div className="kpi-delta dn">▲ 11.1%</div>
          <div className="kpi-sub">{t('overview.vs_april')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 3v1.2M8.5 12.8v1.2M5.2 5.2l.85.85M11.1 11.1l.85.85M3.5 8.5h1.2M12.3 8.5h1.2" stroke="#C9A227" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-label">{t('overview.kpi_profit')}</div>
          <div className="kpi-value"><span className="cur">₸</span>14 400</div>
          <div className="kpi-delta up">▲ 18.5%</div>
          <div className="kpi-sub">{t('overview.vs_april')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M3.5 13.5L13.5 3.5M10.5 3.5h3v3" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="kpi-label">{t('overview.kpi_margin')}</div>
          <div className="kpi-value">25.9<span className="cur">%</span></div>
          <div className="kpi-delta up">▲ 0.4пп</div>
          <div className="kpi-sub">{t('overview.plan_pct')}</div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('overview.chart_income_title')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: '#C9A227' }} />{t('overview.legend_revenue')}</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#F87171' }} />{t('overview.legend_expenses')}</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#34D399' }} />{t('overview.legend_profit')}</div>
              </div>
              <span className="card-badge badge-gold">2026</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A227" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F87171" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}К`} />
                <Tooltip content={<CustomTooltip />} />
                <Area dataKey="revenue" name={t('overview.legend_revenue')} stroke="#C9A227" fill="url(#gRev)" strokeWidth={2} dot={false} />
                <Area dataKey="expenses" name={t('overview.legend_expenses')} stroke="#F87171" fill="url(#gExp)" strokeWidth={2} dot={false} />
                <Area dataKey="profit" name={t('overview.legend_profit')} stroke="#34D399" fill="url(#gPro)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('overview.chart_expenses_title')}</div>
            <span className="card-badge badge-gold">{t('overview.month_may')}</span>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} dataKey="value" strokeWidth={0}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-center-val">₸41.2М</div>
              <div className="donut-center-label">{t('overview.donut_label')}</div>
            </div>
          </div>
          <div className="exp-list">
            {donutData.map((d) => (
              <div key={d.nameKey} className="exp-item">
                <div className="exp-dot" style={{ background: d.color }} />
                <div className="exp-name">{t(`overview.${d.nameKey}`)}</div>
                <div className="exp-bar-wrap"><div className="exp-bar-fill" style={{ width: `${d.value}%`, background: d.color }} /></div>
                <div className="exp-pct">{d.value}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LAST OPERATIONS + P&L */}
      <div className="grid-65-35">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('overview.table_ops_title')}</div>
            <button className="btn btn-outline btn-sm">{t('overview.btn_all')}</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('overview.col_date')}</th>
                <th>{t('overview.col_desc')}</th>
                <th>{t('overview.col_cat')}</th>
                <th style={{ textAlign: 'right' }}>{t('overview.col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={i}>
                  <td className="td-mono td-muted">{tx.date}</td>
                  <td className="td-bold">{tx.desc}</td>
                  <td><span className={`cat ${tx.catClass}`}>{t(`overview.${tx.catKey}`)}</span></td>
                  <td className={`td-right ${tx.amount > 0 ? 'td-pos' : 'td-neg'}`}>{fmt(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t('overview.pl_title')}</div>
            <span className="card-badge badge-green">{t('overview.pl_closed')}</span>
          </div>
          <div className="pl-rows">
            {plRows.map((row, i) => (
              <div key={i} className={`pl-row${row.isTotal ? ' total' : ''}`}>
                <div className={`pl-label${row.isSub ? ' sub' : ''}${row.isBold ? ' bold' : ''}`}>{t(`overview.${row.labelKey}`)}</div>
                <div className={`pl-val ${row.type}`} style={row.isTotal ? { fontSize: 17 } : {}}>{row.value}</div>
              </div>
            ))}
          </div>
          <div className="progress-wrap">
            <div className="progress-labels"><span>{t('overview.plan_vs_fact')}</span><span style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontWeight: 600 }}>93.4%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: '93.4%' }} /></div>
            <div className="progress-labels"><span>{t('overview.plan_target')}</span><span>{t('overview.plan_actual')}</span></div>
          </div>
        </div>
      </div>

      {/* CASH GAP */}
      <div className="cashgap-card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-title">{t('overview.cashgap_title')}</div>
            <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>{t('overview.cashgap_sub')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="card-badge badge-red">{t('overview.cashgap_badge')}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          <div>
            <div className="cashgap-row">
              <div className="cashgap-label">{t('overview.cashgap_pl')}</div>
              <div style={{ textAlign: 'right' }}>
                <div className="cashgap-val pos">₸55 600 000</div>
                <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 1 }}>{t('overview.cashgap_invoices')}</div>
              </div>
            </div>
            <div className="cashgap-row">
              <div className="cashgap-label sub">{t('overview.cashgap_expected')}</div>
              <div className="cashgap-val warn" style={{ textAlign: 'right' }}>−₸6 882 000</div>
            </div>
            <div className="cashgap-row">
              <div className="cashgap-label sub">{t('overview.cashgap_overdue')}</div>
              <div className="cashgap-val neg" style={{ textAlign: 'right' }}>−₸4 020 000</div>
            </div>
            <div className="cashgap-row">
              <div className="cashgap-label total">{t('overview.cashgap_received')}</div>
              <div style={{ textAlign: 'right' }}>
                <div className="cashgap-val total">₸44 698 000</div>
                <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 1 }}>{t('overview.cashgap_pct')}</div>
              </div>
            </div>
            <div style={{ paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--tm)', marginBottom: 4 }}>
                <span>{t('overview.cashgap_real')}</span><span style={{ color: 'var(--tp)' }}>₸44.7М / ₸55.6М</span>
              </div>
              <div className="cashgap-bar">
                <div className="cashgap-fill" style={{ width: '80.4%', background: 'linear-gradient(90deg,#34D399,#C9A227)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--tm)' }}>
                <span style={{ color: 'var(--green)' }}>▓ {t('overview.cashgap_real')}: 80.4%</span>
                <span style={{ color: 'var(--yellow)' }}>░ {t('overview.cashgap_expected').replace('— ', '')}: 12.4%</span>
                <span style={{ color: 'var(--red)' }}>░ {t('overview.cashgap_overdue').replace('— ', '')}: 7.2%</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: 4 }}>{t('overview.cashgap_debtors')}</div>
            {debtors.map((d, i) => (
              <div key={i} style={{ background: 'var(--bg-el)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${d.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tp)' }}>{d.name}</div>
                    <div style={{ fontSize: 9.5, color: d.color, marginTop: 2 }}>{d.note}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: d.color }}>{d.amount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
