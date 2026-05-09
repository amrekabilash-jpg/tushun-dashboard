import { useEffect, useMemo, useState } from 'react';
import {
  api, Customer, InvoiceStatus, InvoiceSummary, Product,
} from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule3Store } from '../store';

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:           'Черновик',
  issued:          'Выставлен',
  paid:            'Оплачен',
  partially_paid:  'Частично оплачен',
  overdue:         'Просрочен',
  cancelled:       'Отменён',
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft:           'var(--tm)',
  issued:          'var(--gold)',
  paid:            'var(--green)',
  partially_paid:  'var(--yellow)',
  overdue:         'var(--red)',
  cancelled:       'var(--tm)',
};

const STATUS_BG: Record<InvoiceStatus, string> = {
  draft:           'transparent',
  issued:          'rgba(212,175,55,.06)',
  paid:            'rgba(52,211,153,.06)',
  partially_paid:  'rgba(251,191,36,.06)',
  overdue:         'rgba(248,113,113,.07)',
  cancelled:       'rgba(150,150,150,.04)',
};

interface NewLine {
  product_id: number | '';
  quantity: string;
  unit_price_kzt: string;
  unit_cost_kzt: string;
}

const EMPTY_LINE: NewLine = {
  product_id: '', quantity: '', unit_price_kzt: '', unit_cost_kzt: '',
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function InvoicesTab() {
  const setRoute = useAppStore(s => s.setRoute);
  const setTab = useAppStore(s => s.setTab);
  const setSelectedInvoice = useModule3Store(s => s.setSelectedInvoice);

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<number | ''>('');
  const [newIssueDate, setNewIssueDate] = useState(today());
  const [newDueDate, setNewDueDate] = useState(addDays(today(), 30));
  const [newNotes, setNewNotes] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const data = await api.listInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setInvoices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [cs, ps] = await Promise.all([api.listCustomers(), api.listProducts()]);
        setCustomers(cs);
        setProducts(ps);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(i =>
      i.invoice_number.toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const openDetails = (id: number) => {
    setSelectedInvoice(id);
    setRoute(3);
    setTab(3, 'm3-detail');
  };

  const changeStatus = async (e: React.MouseEvent, id: number, newStatus: InvoiceStatus) => {
    e.stopPropagation();
    try {
      await api.updateInvoiceStatus(id, newStatus);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены статуса');
    }
  };

  const addLine = () => setNewLines(ls => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => setNewLines(ls => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls);
  const setLine = (idx: number, patch: Partial<NewLine>) =>
    setNewLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const newTotal = useMemo(() =>
    newLines.reduce((acc, l) => {
      const q = parseFloat(l.quantity) || 0;
      const p = parseFloat(l.unit_price_kzt) || 0;
      return acc + q * p;
    }, 0)
  , [newLines]);

  const submitNew = async () => {
    if (!newCustomerId) {
      setError('Выбери клиента');
      return;
    }
    const items = newLines
      .filter(l => l.product_id !== '' && l.quantity && l.unit_price_kzt)
      .map(l => ({
        product_id: l.product_id as number,
        quantity: parseInt(l.quantity),
        unit_price_kzt: parseFloat(l.unit_price_kzt),
        unit_cost_kzt: parseFloat(l.unit_cost_kzt) || 0,
      }));
    if (!items.length) {
      setError('Добавь хотя бы одну позицию');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createInvoice({
        customer_id: newCustomerId as number,
        issue_date: newIssueDate,
        due_date: newDueDate,
        notes: newNotes || undefined,
        items,
      });
      setNewCustomerId('');
      setNewIssueDate(today());
      setNewDueDate(addDays(today(), 30));
      setNewNotes('');
      setNewLines([{ ...EMPTY_LINE }]);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка счетов…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input
          type="text" placeholder="Поиск по № или клиенту…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 240 }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          style={selectStyle}
        >
          <option value="all">Все статусы</option>
          <option value="issued">Выставлен</option>
          <option value="paid">Оплачен</option>
          <option value="partially_paid">Частично оплачен</option>
          <option value="overdue">Просрочен</option>
          <option value="draft">Черновик</option>
          <option value="cancelled">Отменён</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Показано: {filtered.length}
        </span>
        <button className="btn btn-gold" onClick={() => { setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Новый счёт'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Новый счёт-фактура
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Field label="Клиент" required>
              <select
                value={newCustomerId}
                onChange={e => setNewCustomerId(parseInt(e.target.value) || '')}
              >
                <option value="">— выбрать —</option>
                {customers.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Дата выпуска">
              <input type="date" value={newIssueDate}
                onChange={e => {
                  setNewIssueDate(e.target.value);
                  setNewDueDate(addDays(e.target.value, 30));
                }} />
            </Field>
            <Field label="Срок оплаты">
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
            </Field>
            <Field label="Примечание">
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)} />
            </Field>
          </div>

          {/* Lines */}
          <div style={{ marginBottom: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Позиции счёта
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {newLines.map((line, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '2.2fr 90px 130px 130px 110px 36px',
                gap: 8, alignItems: 'center',
              }}>
                <select
                  value={line.product_id}
                  onChange={e => setLine(idx, { product_id: parseInt(e.target.value) || '' })}
                  style={inputStyle}
                >
                  <option value="">Товар…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" placeholder="Кол-во"
                  value={line.quantity}
                  onChange={e => setLine(idx, { quantity: e.target.value })}
                  style={inputStyle}
                />
                <input type="number" min="0" step="100" placeholder="Цена/шт"
                  value={line.unit_price_kzt}
                  onChange={e => setLine(idx, { unit_price_kzt: e.target.value })}
                  style={inputStyle}
                />
                <input type="number" min="0" step="100" placeholder="Себест/шт"
                  value={line.unit_cost_kzt}
                  onChange={e => setLine(idx, { unit_cost_kzt: e.target.value })}
                  style={inputStyle}
                />
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                  color: 'var(--gold)', textAlign: 'right',
                }}>
                  {fmt((parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price_kzt) || 0))}
                </span>
                <button onClick={() => removeLine(idx)} style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 5, color: 'var(--red)', cursor: 'pointer', padding: '6px 10px',
                  fontSize: 14,
                }}>−</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={addLine} style={{
              background: 'transparent', color: 'var(--gold)',
              border: '1px dashed var(--gold)', borderRadius: 6,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Добавить позицию</button>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
              ИТОГО: ₸{fmt(newTotal)}
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submitNew} disabled={submitting}>
              {submitting ? 'Создание…' : 'Создать счёт'}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(null); }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Нет счетов
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="mobile-cards">
            {filtered.map(inv => (
              <div key={inv.id} className="m-card" onClick={() => openDetails(inv.id)} style={{ cursor: 'pointer' }}>
                <div className="m-card-top">
                  <span className="m-card-title">{inv.invoice_number} · {inv.customer_name || '—'}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 4,
                    color: STATUS_COLOR[inv.status],
                    border: '1px solid ' + STATUS_COLOR[inv.status],
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{STATUS_LABEL[inv.status]}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Позиций</span>
                  <span className="m-card-val">{inv.items_count}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Выпуск / Срок</span>
                  <span className="m-card-val">{inv.issue_date} / {inv.due_date}</span>
                </div>
                <div className="m-card-divider" />
                <div className="m-card-row">
                  <span className="m-card-label">Сумма</span>
                  <span className="m-card-val">{fmt(inv.total_kzt)} ₸</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Оплачено</span>
                  <span className="m-card-val pos">{fmt(inv.paid_kzt)} ₸</span>
                </div>
                {inv.outstanding_kzt > 0 && (
                  <div className="m-card-row">
                    <span className="m-card-label">К оплате</span>
                    <span className="m-card-val neg">{fmt(inv.outstanding_kzt)} ₸</span>
                  </div>
                )}
                {inv.status === 'draft' && (
                  <button
                    onClick={e => changeStatus(e, inv.id, 'issued')}
                    style={statusBtn(inv.status)}
                  >
                    {STATUS_LABEL[inv.status]} →
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="desktop-only" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1.8fr 100px 100px 110px 110px 110px 130px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>№ Счёта</span>
            <span>Клиент</span>
            <span>Выпуск</span>
            <span>Срок</span>
            <span style={{ textAlign: 'right' }}>Сумма ₸</span>
            <span style={{ textAlign: 'right' }}>Оплачено ₸</span>
            <span style={{ textAlign: 'right' }}>К оплате ₸</span>
            <span>Статус</span>
          </div>
          {filtered.map(inv => (
            <div
              key={inv.id}
              onClick={() => openDetails(inv.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1.8fr 100px 100px 110px 110px 110px 130px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
                background: STATUS_BG[inv.status],
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--tp)', fontWeight: 600 }}>
                {inv.invoice_number}
              </span>
              <span style={{ color: 'var(--tp)' }}>
                {inv.customer_name || '—'}
                <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                  · {inv.items_count} поз.
                </span>
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>{inv.issue_date}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>{inv.due_date}</span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
                {fmt(inv.total_kzt)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--green)' }}>
                {fmt(inv.paid_kzt)}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                color: inv.outstanding_kzt > 0 ? 'var(--red)' : 'var(--tm)',
              }}>
                {inv.outstanding_kzt > 0 ? fmt(inv.outstanding_kzt) : '—'}
              </span>
              <span>
                {inv.status === 'draft' ? (
                  <button onClick={e => changeStatus(e, inv.id, 'issued')} style={statusBtn(inv.status)}>
                    {STATUS_LABEL[inv.status]} →
                  </button>
                ) : (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4,
                    color: STATUS_COLOR[inv.status],
                    border: '1px solid ' + STATUS_COLOR[inv.status],
                  }}>{STATUS_LABEL[inv.status]}</span>
                )}
              </span>
            </div>
          ))}
          </div>
          </div>
        </>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Клик по строке → детали счёта (вкладка «Детали»)
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'inherit',
};
const selectStyle: React.CSSProperties = { ...inputStyle };

const statusBtn = (status: InvoiceStatus): React.CSSProperties => ({
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
  padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
  background: 'transparent', color: STATUS_COLOR[status],
  border: '1px solid ' + STATUS_COLOR[status],
});

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
