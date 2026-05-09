import { useEffect, useState } from 'react';
import { api, InvoiceDetail, InvoiceStatus, PaymentMethod } from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule3Store } from '../store';

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Черновик', issued: 'Выставлен', paid: 'Оплачен',
  partially_paid: 'Частично оплачен', overdue: 'Просрочен', cancelled: 'Отменён',
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: 'var(--tm)', issued: 'var(--gold)', paid: 'var(--green)',
  partially_paid: 'var(--yellow)', overdue: 'var(--red)', cancelled: 'var(--tm)',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank: 'Банк', cash: 'Наличные', kaspi: 'Kaspi', card: 'Карта', other: 'Другое',
};

const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceDetailTab() {
  const selectedInvoiceId = useModule3Store(s => s.selectedInvoiceId);
  const setSelectedInvoice = useModule3Store(s => s.setSelectedInvoice);
  const setTab = useAppStore(s => s.setTab);

  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pay form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bank');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    if (!selectedInvoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInvoice(selectedInvoiceId);
      setInv(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [selectedInvoiceId]);

  if (!selectedInvoiceId) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📄</div>
        <div style={{ fontSize: 14, color: 'var(--ts)', marginBottom: 14 }}>
          Счёт-фактура не выбрана
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setTab(3, 'm3-invoices')}
        >
          Перейти к списку счетов
        </button>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!inv) return null;

  const submitPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setError('Сумма платежа должна быть > 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createPayment({
        invoice_id: inv.id,
        amount_kzt: amount,
        method: payMethod,
        reference: payRef || undefined,
        payment_date: payDate,
      });
      setPayAmount('');
      setPayRef('');
      setShowPayForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось зарегистрировать платёж');
    } finally {
      setSubmitting(false);
    }
  };

  const removePayment = async (paymentId: number) => {
    if (!confirm('Удалить платёж?')) return;
    try {
      await api.deletePayment(paymentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const changeStatus = async (newStatus: InvoiceStatus) => {
    try {
      await api.updateInvoiceStatus(inv.id, newStatus);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const closeDetail = () => {
    setSelectedInvoice(null);
    setTab(3, 'm3-invoices');
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Счёт-фактура · ID #{inv.id}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.02em' }}>
              {inv.invoice_number}
            </div>
            <div style={{ fontSize: 14, color: 'var(--tp)', marginTop: 6 }}>
              <strong>{inv.customer_name || '—'}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              padding: '5px 12px', borderRadius: 5,
              color: STATUS_COLOR[inv.status],
              border: '1px solid ' + STATUS_COLOR[inv.status],
              letterSpacing: '0.05em',
            }}>{STATUS_LABEL[inv.status]}</span>
            <button onClick={closeDetail} className="btn btn-outline" style={{ fontSize: 11 }}>
              ← К списку
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCell label="Дата выпуска" value={inv.issue_date || '—'} mono />
          <KpiCell label="Срок оплаты" value={inv.due_date || '—'} mono
                   color={inv.status === 'overdue' ? 'var(--red)' : undefined} />
          <KpiCell label="Сумма счёта" value={`₸${fmt(inv.total_kzt)}`} accent />
          <KpiCell
            label="К оплате"
            value={`₸${fmt(inv.outstanding_kzt)}`}
            color={inv.outstanding_kzt > 0 ? 'var(--red)' : 'var(--green)'}
          />
        </div>

        {inv.notes && (
          <div style={{
            marginTop: 14, padding: '10px 14px', background: 'var(--bg-el)',
            border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 12, color: 'var(--ts)', fontStyle: 'italic',
          }}>
            <strong style={{ fontStyle: 'normal', color: 'var(--tm)' }}>Примечание:</strong> {inv.notes}
          </div>
        )}

        {/* Actions */}
        {inv.status !== 'cancelled' && inv.status !== 'paid' && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {inv.outstanding_kzt > 0 && (
              <button className="btn btn-gold" onClick={() => {
                setPayAmount(String(Math.round(inv.outstanding_kzt)));
                setShowPayForm(s => !s);
              }}>
                {showPayForm ? '✕ Отмена' : '+ Зарегистрировать платёж'}
              </button>
            )}
            {inv.status === 'draft' && (
              <button className="btn btn-outline" onClick={() => changeStatus('issued')}>
                Выставить (issued)
              </button>
            )}
            <button className="btn btn-outline" onClick={() => changeStatus('cancelled')}
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
              Отменить счёт
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
            borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
          }}>{error}</div>
        )}
      </div>

      {/* Pay form */}
      {showPayForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Регистрация платежа
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Сумма ₸" required>
              <input type="number" min="0.01" step="100"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)} />
            </Field>
            <Field label="Метод">
              <select value={payMethod}
                onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                <option value="bank">Банк</option>
                <option value="kaspi">Kaspi</option>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="other">Другое</option>
              </select>
            </Field>
            <Field label="Дата">
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </Field>
            <Field label="Референс">
              <input value={payRef} onChange={e => setPayRef(e.target.value)}
                placeholder="№ платёжки или чека" />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submitPayment} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Зарегистрировать'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowPayForm(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          Позиции счёта · {inv.items.length} шт.
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 2.4fr 80px 110px 110px 110px 100px',
          gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
          fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>#</span>
          <span>Товар</span>
          <span style={{ textAlign: 'right' }}>Кол-во</span>
          <span style={{ textAlign: 'right' }}>Цена ₸</span>
          <span style={{ textAlign: 'right' }}>Себест ₸</span>
          <span style={{ textAlign: 'right' }}>Маржа %</span>
          <span style={{ textAlign: 'right' }}>Итого ₸</span>
        </div>
        {inv.items.map((it, idx) => (
          <div key={it.id} style={{
            display: 'grid',
            gridTemplateColumns: '40px 2.4fr 80px 110px 110px 110px 100px',
            gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--tm)' }}>{idx + 1}</span>
            <span style={{ color: 'var(--tp)' }}>{it.product_name}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>{it.quantity}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {fmt(it.unit_price_kzt)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
              {fmt(it.unit_cost_kzt)}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right',
              color: it.gross_margin_percent >= 30 ? 'var(--green)' : it.gross_margin_percent >= 15 ? 'var(--yellow)' : 'var(--red)',
            }}>
              {it.gross_margin_percent.toFixed(1)}%
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
              {fmt(it.total_revenue_kzt)}
            </span>
          </div>
        ))}
        <div style={{
          padding: '14px 16px', background: 'var(--bg-el)',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14,
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em',
          }}>ИТОГО:</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--gold)',
          }}>₸{fmt(inv.total_kzt)}</span>
        </div>
      </div>

      {/* Payments */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          Платежи · {inv.payments.length} шт. · оплачено ₸{fmt(inv.paid_kzt)}
        </div>
        {inv.payments.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Платежей пока нет
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '110px 100px 130px 1.5fr 130px 60px',
              gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
              fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Дата</span>
              <span>Метод</span>
              <span style={{ textAlign: 'right' }}>Сумма ₸</span>
              <span>Референс</span>
              <span>Создано</span>
              <span></span>
            </div>
            {inv.payments.map(p => (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '110px 100px 130px 1.5fr 130px 60px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{p.payment_date}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: p.method === 'cash' ? 'var(--yellow)' : p.method === 'kaspi' ? 'var(--gold)' : 'var(--green)',
                }}>{METHOD_LABEL[p.method]}</span>
                <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                  +{fmt(p.amount_kzt)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                  {p.reference || '—'}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                  {p.created_at?.slice(0, 16).replace('T', ' ')}
                </span>
                <button onClick={() => removePayment(p.id)} style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--red)', cursor: 'pointer',
                  padding: '3px 8px', fontSize: 11,
                }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCell({ label, value, mono, accent, color }: {
  label: string; value: string; mono?: boolean; accent?: boolean; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-el)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        fontSize: 16, fontWeight: 600,
        color: color || (accent ? 'var(--gold)' : 'var(--tp)'),
      }}>{value}</div>
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        {label}{required && <span style={{ color: 'var(--red)' }}> *</span>}
      </span>
      <div>{children}</div>
      <style>{`
        label > div input, label > div select {
          width: 100%;
          background: var(--bg-el);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 7px 10px;
          color: var(--tp);
          font-size: 12.5px;
          font-family: inherit;
          box-sizing: border-box;
        }
        label > div input:focus, label > div select:focus {
          outline: none; border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
