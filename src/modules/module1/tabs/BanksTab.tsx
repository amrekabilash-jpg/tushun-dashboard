const banks = [
  { accent: '#C9A227', logoColor: 'rgba(201,162,39,.15)', logoText: 'ДБ', bank: 'Дочерний Банк', name: 'Расчётный — Алматы', balance: '18 240 000', usd: '≈ $38 900', txns: 124, since: '2019' },
  { accent: '#60A5FA', logoColor: 'rgba(96,165,250,.15)', logoText: 'КЗ', bank: 'Казком / Forte', name: 'Резервный счёт', balance: '12 680 000', usd: '≈ $27 100', txns: 47, since: '2021' },
  { accent: '#34D399', logoColor: 'rgba(52,211,153,.15)', logoText: 'НБ', bank: 'Народный Банк', name: 'Текущий — Астана', balance: '8 940 000', usd: '≈ $19 100', txns: 89, since: '2020' },
  { accent: '#a78bfa', logoColor: 'rgba(167,139,250,.15)', logoText: 'BI', name: 'Валютный счёт (USD)', bank: 'Bereke Bank', balance: '2 320 000', usd: '≈ $4 960', txns: 18, since: '2022' },
];

const txns = [
  { date: '01.05.26', bank: 'ДБ Алматы', desc: 'Поступление — ТОО АвтоАлмат', type: 'in', amount: '+3 420 000' },
  { date: '01.05.26', bank: 'ДБ Алматы', desc: 'Оплата Tushun #TR-0441', type: 'out', amount: '−8 760 000' },
  { date: '30.04.26', bank: 'Forte', desc: 'Зарплата персонала', type: 'out', amount: '−4 120 000' },
  { date: '29.04.26', bank: 'НБ Астана', desc: 'Поступление — ИП Сейткали', type: 'in', amount: '+1 850 000' },
  { date: '28.04.26', bank: 'ДБ Алматы', desc: 'Таможня + фрахт КТ-09', type: 'out', amount: '−2 340 000' },
  { date: '27.04.26', bank: 'Forte', desc: 'Аренда склада Алматы', type: 'out', amount: '−1 350 000' },
];

export default function BanksTab() {
  return (
    <>
      <div className="bank-grid">
        {banks.map((b, i) => (
          <div key={i} className="bank-card">
            <div className="bank-card-accent" style={{ background: b.accent }} />
            <div className="bank-logo" style={{ background: b.logoColor, color: b.accent }}>{b.logoText}</div>
            <div className="bank-name">{b.bank}</div>
            <div className="bank-account-name">{b.name}</div>
            <div className="bank-balance">
              <span className="bank-balance-cur">₸</span>
              {b.balance}
            </div>
            <div className="bank-balance-usd">{b.usd}</div>
            <div className="bank-footer">
              <span className="bank-status-active">Активен</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tm)' }}>{b.txns} операций · с {b.since}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ИТОГО ПО ВСЕМ СЧЕТАМ</div>
          <span className="card-badge badge-gold">₸42 180 000</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {[
            { icon: '₸', label: 'Баланс KZT', val: '42 180 000', sub: '4 счёта активны' },
            { icon: '$', label: 'Баланс USD', val: '90 060', sub: '≈ ₸42.2М по курсу' },
            { icon: '↕', label: 'Оборот — май', val: '85 456 000', sub: 'вх. + исх.' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: '18px 20px' }}>
              <div style={{ fontSize: 22, marginBottom: 8, fontFamily: 'var(--mono)', color: 'var(--gold)' }}>{c.icon}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--tp)' }}>{c.val}</div>
              <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ПОСЛЕДНИЕ БАНКОВСКИЕ ОПЕРАЦИИ</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="filter-select"><option>Все банки</option><option>ДБ Алматы</option><option>Forte</option><option>НБ Астана</option></select>
          </div>
        </div>
        <table>
          <thead><tr><th>Дата</th><th>Банк</th><th>Описание</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th></tr></thead>
          <tbody>
            {txns.map((t, i) => (
              <tr key={i}>
                <td className="td-mono td-muted">{t.date}</td>
                <td className="td-mono td-muted">{t.bank}</td>
                <td className="td-bold">{t.desc}</td>
                <td className={`td-right ${t.type === 'in' ? 'td-pos' : 'td-neg'}`}>{t.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
