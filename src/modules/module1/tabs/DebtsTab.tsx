import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../../utils/api';

type Receivable = Awaited<ReturnType<typeof api.listReceivables>>[number];
type Summary = Awaited<ReturnType<typeof api.getReceivablesSummary>>;

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const BUCKET_LABEL: Record<string, string> = {
  current: 'В сроке',
  '0-30':  'Просрочка 0–30 дн',
  '31-60': '31–60 дн',
  '61-90': '61–90 дн',
  '90+':   '90+ дн (списание)',
};

const BUCKET_COLOR: Record<string, string> = {
  current: '#34D399',
  '0-30':  '#FBBF24',
  '31-60': '#F59E0B',
  '61-90': '#F87171',
  '90+':   '#DC2626',
};

const STATUS_CLASS: Record<string, string> = {
  paid:    's-paid',
  pending: 's-pending',
  overdue: 's-overdue',
  partial: 's-pending',
};

const STATUS_LABEL: Record<string, string> = {
  paid:    'Оплачен',
  pending: 'Ожидается',
  overdue: 'Просрочен',
  partial: 'Частично',
};

export default function DebtsTab() {
  const [rows, setRows] = useState<Receivable[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [rs, sm] = await Promise.all([
        api.listReceivables(),
        api.getReceivablesSummary(),
      ]);
      setRows(rs);
      setSummary(sm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handlePay = async (saleId: number) => {
    setBusyId(saleId);
    try {
      await api.markPaid(saleId);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрировать оплату');
    } finally {
      setBusyId(null);
    }
  };

  const overdueCount = summary?.overdue_count ?? 0;
  const pendingCount = summary?.pending_count ?? 0;

  return (
    <>
      {error && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 8,
          background: 'rgba(248,113,113,.10)', border: '1px solid rgba(248,113,113,.28)',
          color: 'var(--red)', fontSize: 12,
        }}>⚠ {error}</div>
      )}

      <div className="kpi-row-3">
        <div className="kpi-card" style={{ borderColor: 'rgba(248,113,113,.2)' }}>
          <div className="kpi-label">Просрочено</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>
            <span className="cur" style={{ color: 'var(--red)' }}>₸</span>
            {summary ? fmt(summary.total_overdue_kzt) : '…'}
          </div>
          <div className="kpi-delta dn">{overdueCount} {overdueCount === 1 ? 'счёт' : 'счёта'} · live</div>
        </div>
        <div className="kpi-card" style={{ borderColor: 'rgba(251,191,36,.2)' }}>
          <div className="kpi-label">В сроке</div>
          <div className="kpi-value" style={{ color: 'var(--yellow)' }}>
            <span className="cur" style={{ color: 'var(--yellow)' }}>₸</span>
            {summary ? fmt((summary.aging.find(a => a.bucket === 'current')?.amount_kzt) ?? 0) : '…'}
          </div>
          <div className="kpi-delta" style={{ color: 'var(--yellow)', background: 'rgba(251,191,36,.10)' }}>
            {pendingCount} {pendingCount === 1 ? 'счёт' : 'счёта'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Всего дебиторка</div>
          <div className="kpi-value"><span className="cur">₸</span>{summary ? fmt(summary.total_outstanding_kzt) : '…'}</div>
          <div className="kpi-delta">{rows?.length ?? 0} непогашено</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">AGING (СТАРЕНИЕ ЗАДОЛЖЕННОСТИ)</div>
          <span className="card-badge badge-gold">live · 30+ дней опасно</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {summary?.aging.map(a => (
            <div key={a.bucket} style={{ background: 'var(--bg-card)', padding: '14px 16px' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                color: BUCKET_COLOR[a.bucket], marginBottom: 8,
              }}>{BUCKET_LABEL[a.bucket]}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600,
                color: a.amount_kzt > 0 ? 'var(--tp)' : 'var(--tm)',
              }}>
                ₸{fmt(a.amount_kzt)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 4 }}>{a.count} {a.count === 1 ? 'счёт' : 'счёта'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">РЕЕСТР ДЕБИТОРСКОЙ ЗАДОЛЖЕННОСТИ</div>
            <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>Только непогашенные счета</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={reload}>↻ Обновить</button>
        </div>
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Счёт-фактура</th>
              <th>Клиент</th>
              <th>Товар</th>
              <th>Срок</th>
              <th style={{ textAlign: 'right' }}>Дней</th>
              <th style={{ textAlign: 'right' }}>Сумма, ₸</th>
              <th style={{ textAlign: 'right' }}>Оплачено</th>
              <th>Статус</th>
              <th style={{ textAlign: 'right' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {!rows && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Загрузка…</td></tr>
            )}
            {rows && rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>
                Нет непогашенных счетов. Молодцы!
              </td></tr>
            )}
            {rows?.map(d => {
              const isOverdue = d.payment_status === 'overdue';
              const dayLabel = isOverdue
                ? `+${d.days_overdue}`
                : d.days_until_due > 0 ? `−${d.days_until_due}` : '0';
              return (
                <tr key={d.id}>
                  <td className="td-mono">{d.invoice_number ?? '#' + d.id}</td>
                  <td className="td-bold">{d.customer_name ?? '—'}</td>
                  <td className="td-muted" style={{ fontSize: 11 }}>{d.product_name ?? '—'}</td>
                  <td className="td-mono">{d.due_date ?? '—'}</td>
                  <td className="td-right td-mono" style={{ color: isOverdue ? 'var(--red)' : 'var(--ts)' }}>
                    {dayLabel}
                  </td>
                  <td className="td-neutral td-right">{fmt(d.outstanding_kzt)}</td>
                  <td className="td-mono td-right" style={{ color: 'var(--tm)' }}>{fmt(d.paid_kzt)}</td>
                  <td><span className={`status ${STATUS_CLASS[d.payment_status] ?? 's-pending'}`}>
                    {STATUS_LABEL[d.payment_status] ?? d.payment_status}
                  </span></td>
                  <td className="td-right">
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={busyId === d.id}
                      onClick={() => handlePay(d.id)}
                    >
                      {busyId === d.id ? '…' : '✓ Оплачен'}
                    </button>
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
