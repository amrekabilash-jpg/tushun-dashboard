const debts = [
  { client: 'ТОО МастерСервис', city: 'Алматы', invoice: 'СФ-2026-029', issued: '02.04.26', due: '02.04.26', days: '+29', amount: '₸2 500 000', statusClass: 's-overdue', status: 'Просрочен' },
  { client: 'ТОО МастерСервис', city: 'Алматы', invoice: 'СФ-2026-038', issued: '22.04.26', due: '22.04.26', days: '+9', amount: '₸1 520 000', statusClass: 's-overdue', status: 'Просрочен' },
  { client: 'ТОО АвтоДел Ю.К.', city: 'Алматы', invoice: 'СФ-2026-041', issued: '02.05.26', due: '02.05.26', days: '0', amount: '₸4 670 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО AutoParts KZ', city: 'Астана', invoice: 'СФ-2026-042', issued: '05.05.26', due: '05.05.26', days: '−3', amount: '₸2 212 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО АвтоПлюс', city: 'Шымкент', invoice: 'СФ-2026-038', issued: '15.05.26', due: '15.05.26', days: '−10', amount: '₸2 100 000', statusClass: 's-pending', status: 'Ожидается' },
  { client: 'ТОО МегаДеталь', city: 'Алматы', invoice: 'СФ-2026-039', issued: '20.05.26', due: '20.05.26', days: '−15', amount: '₸2 400 000', statusClass: 's-pending', status: 'Ожидается' },
];

export default function DebtsTab() {
  const pending = debts.filter(d => d.statusClass === 's-pending').length;

  return (
    <>
      <div className="kpi-row-3">
        <div className="kpi-card" style={{ borderColor: 'rgba(248,113,113,.2)' }}>
          <div className="kpi-label">Просрочено</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}><span className="cur" style={{ color: 'var(--red)' }}>₸</span>4 020 000</div>
          <div className="kpi-delta dn">2 клиента</div>
        </div>
        <div className="kpi-card" style={{ borderColor: 'rgba(251,191,36,.2)' }}>
          <div className="kpi-label">Ожидается (в срок)</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}><span className="cur" style={{ color: 'var(--yellow)' }}>₸</span>11 382 000</div>
          <div className="kpi-delta" style={{ color: 'var(--yellow)', background: 'rgba(251,191,36,.10)' }}>{pending} платежей</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Всего дебиторка</div>
          <div className="kpi-value"><span className="cur">₸</span>15 402 000</div>
          <div className="kpi-delta dn">27.7% от выручки</div>
        </div>
      </div>

      <div className="cashgap-card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-title">РЕЕСТР ДЕБИТОРСКОЙ ЗАДОЛЖЕННОСТИ</div>
            <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>Контроль сроков оплаты</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="filter-select"><option>Все клиенты</option></select>
            <button className="btn btn-outline btn-sm">Отправить напоминание</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Клиент</th><th>Счёт-фактура</th><th>Выставлен</th><th>Срок</th>
              <th style={{ textAlign: 'right' }}>Дней</th><th style={{ textAlign: 'right' }}>Сумма, ₸</th><th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {debts.map((d, i) => (
              <tr key={i}>
                <td className="td-bold">{d.client} <span className="td-muted" style={{ fontWeight: 400, fontSize: 10 }}>· {d.city}</span></td>
                <td className="td-mono td-muted">{d.invoice}</td>
                <td className="td-mono td-muted">{d.issued}</td>
                <td className="td-mono">{d.due}</td>
                <td className="td-right td-mono" style={{ color: d.statusClass === 's-overdue' ? 'var(--red)' : 'var(--ts)' }}>{d.days}</td>
                <td className="td-neutral td-right">{d.amount}</td>
                <td><span className={`status ${d.statusClass}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
