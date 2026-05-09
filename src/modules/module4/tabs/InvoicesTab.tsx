import { useEffect, useMemo, useState } from 'react';
import { api, BatchStatus, BatchSummary, Product, Warehouse } from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule4Store } from '../store';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtUsd = (n: number) => Math.round(n).toLocaleString('en-US');

const STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'Черновик', in_transit: 'В пути', arrived: 'Прибыл',
  completed: 'Завершён', cancelled: 'Отменён',
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  draft: 'var(--tm)', in_transit: 'var(--gold)', arrived: 'var(--green)',
  completed: 'var(--blue, #5fa8ff)', cancelled: 'var(--red)',
};

const STATUS_BG: Record<BatchStatus, string> = {
  draft:      'transparent',
  in_transit: 'rgba(212,175,55,.06)',
  arrived:    'rgba(52,211,153,.06)',
  completed:  'rgba(95,168,255,.04)',
  cancelled:  'rgba(150,150,150,.05)',
};

interface NewLine {
  product_id: number | '';
  quantity: string;
  price_per_unit_usd: string;
}

const EMPTY_LINE: NewLine = { product_id: '', quantity: '', price_per_unit_usd: '' };

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function InvoicesTab() {
  const setTab = useAppStore(s => s.setTab);
  const setSelectedBatch = useModule4Store(s => s.setSelectedBatch);

  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | BatchStatus>('all');
  const [search, setSearch] = useState('');

  // New batch form
  const [showForm, setShowForm] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplier, setSupplier] = useState('Tushun Co., Ltd');
  const [shippingCost, setShippingCost] = useState('500');
  const [exchangeRate, setExchangeRate] = useState('450');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [etaDate, setEtaDate] = useState(addDays(today(), 14));
  const [destWarehouse, setDestWarehouse] = useState<number | ''>('');
  const [initStatus, setInitStatus] = useState<BatchStatus>('in_transit');
  const [lines, setLines] = useState<NewLine[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const data = await api.listBatches({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setBatches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [ps, ws] = await Promise.all([api.listProducts(), api.listWarehouses()]);
        setProducts(ps);
        setWarehouses(ws);
        if (ws.length > 0) setDestWarehouse(ws[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return batches;
    const q = search.toLowerCase();
    return batches.filter(b =>
      b.batch_number.toLowerCase().includes(q) ||
      (b.supplier_name || '').toLowerCase().includes(q) ||
      (b.tracking_number || '').toLowerCase().includes(q),
    );
  }, [batches, search]);

  const openDetails = (id: number) => {
    setSelectedBatch(id);
    setTab(4, 'm4-tracking');
  };

  // Auto-generate batch number
  useEffect(() => {
    if (!showForm) return;
    const next = batches.length + 1;
    setBatchNumber(`BATCH-2026-${String(next).padStart(3, '0')}`);
  }, [showForm, batches.length]);

  const addLine = () => setLines(ls => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => setLines(ls => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls);
  const setLine = (idx: number, patch: Partial<NewLine>) =>
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const newTotalFob = useMemo(() =>
    lines.reduce((acc, l) => acc + (parseFloat(l.quantity) || 0) * (parseFloat(l.price_per_unit_usd) || 0), 0)
  , [lines]);

  const submitNew = async () => {
    if (!batchNumber.trim()) {
      setError('Укажи номер партии');
      return;
    }
    const items = lines
      .filter(l => l.product_id !== '' && l.quantity && l.price_per_unit_usd)
      .map(l => ({
        product_id: l.product_id as number,
        quantity: parseInt(l.quantity),
        price_per_unit_usd: parseFloat(l.price_per_unit_usd),
      }));
    if (!items.length) {
      setError('Добавь хотя бы одну позицию');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createBatch({
        batch_number: batchNumber,
        invoice_number: invoiceNumber || undefined,
        supplier_name: supplier || undefined,
        shipping_cost_usd: parseFloat(shippingCost) || 0,
        exchange_rate: parseFloat(exchangeRate) || 450,
        tracking_number: trackingNumber || undefined,
        eta_date: etaDate || undefined,
        destination_warehouse_id: destWarehouse === '' ? undefined : destWarehouse,
        status: initStatus,
        items,
      });
      // Сброс
      setShowForm(false);
      setLines([{ ...EMPTY_LINE }]);
      setInvoiceNumber('');
      setTrackingNumber('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка партий…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input
          type="text" placeholder="Поиск по № или поставщику…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 240 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="all">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="in_transit">В пути</option>
          <option value="arrived">Прибыл</option>
          <option value="completed">Завершён</option>
          <option value="cancelled">Отменён</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Показано: {filtered.length}
        </span>
        <button className="btn btn-gold" onClick={() => { setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Новая партия'}
        </button>
      </div>

      {/* New batch form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Новая партия импорта
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Field label="№ партии" required>
              <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
            </Field>
            <Field label="№ инвойса">
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="INV-2026-..." />
            </Field>
            <Field label="Поставщик">
              <input value={supplier} onChange={e => setSupplier(e.target.value)} />
            </Field>
            <Field label="Доставка USD">
              <input type="number" step="50" value={shippingCost}
                onChange={e => setShippingCost(e.target.value)} />
            </Field>
            <Field label="Курс USD→KZT">
              <input type="number" step="1" value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)} />
            </Field>
            <Field label="Tracking №">
              <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                placeholder="CH123456" />
            </Field>
            <Field label="ETA (ожидаемое прибытие)">
              <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} />
            </Field>
            <Field label="Склад назначения">
              <select value={destWarehouse}
                onChange={e => setDestWarehouse(e.target.value === '' ? '' : parseInt(e.target.value))}>
                <option value="">— не указан —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>)}
              </select>
            </Field>
            <Field label="Начальный статус">
              <select value={initStatus} onChange={e => setInitStatus(e.target.value as BatchStatus)}>
                <option value="draft">Черновик</option>
                <option value="in_transit">В пути</option>
              </select>
            </Field>
          </div>

          <div style={{ marginBottom: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Позиции партии
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {lines.map((line, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '2fr 100px 130px 100px 36px',
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
                <input type="number" min="0" step="0.1" placeholder="$/шт (FOB)"
                  value={line.price_per_unit_usd}
                  onChange={e => setLine(idx, { price_per_unit_usd: e.target.value })}
                  style={inputStyle}
                />
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                  color: 'var(--gold)', textAlign: 'right',
                }}>
                  ${fmtUsd((parseFloat(line.quantity) || 0) * (parseFloat(line.price_per_unit_usd) || 0))}
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
              FOB: ${fmtUsd(newTotalFob)}
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submitNew} disabled={submitting}>
              {submitting ? 'Создание…' : 'Создать партию'}
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
          Партий не найдено. Создай первую — кнопка «+ Новая партия».
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="mobile-cards">
            {filtered.map(b => (
              <div key={b.id} className="m-card" onClick={() => openDetails(b.id)} style={{ cursor: 'pointer' }}>
                <div className="m-card-top">
                  <span className="m-card-title">{b.batch_number}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 4,
                    color: STATUS_COLOR[b.status],
                    border: '1px solid ' + STATUS_COLOR[b.status],
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{STATUS_LABEL[b.status]}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Поставщик</span>
                  <span className="m-card-val">{b.supplier_name || '—'}</span>
                </div>
                {b.tracking_number && (
                  <div className="m-card-row">
                    <span className="m-card-label">Tracking</span>
                    <span className="m-card-val">{b.tracking_number}</span>
                  </div>
                )}
                <div className="m-card-row">
                  <span className="m-card-label">Позиций</span>
                  <span className="m-card-val">{b.items_count}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Импорт / ETA</span>
                  <span className="m-card-val">{b.import_date || '—'} / {b.eta_date || '—'}</span>
                </div>
                <div className="m-card-divider" />
                <div className="m-card-row">
                  <span className="m-card-label">FOB $</span>
                  <span className="m-card-val">{b.total_fob_usd ? fmtUsd(b.total_fob_usd) : '—'}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">Себест ₸</span>
                  <span className="m-card-val warn">{b.total_cost_kzt ? fmtKzt(b.total_cost_kzt) : '—'}</span>
                </div>
                {b.stock_in_created && (
                  <div className="m-card-row">
                    <span className="m-card-label">Склад</span>
                    <span className="m-card-val pos">📦 Зачислено</span>
                  </div>
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
            gridTemplateColumns: '130px 1.6fr 100px 100px 110px 110px 110px 130px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>№ Партии</span>
            <span>Поставщик / Tracking</span>
            <span>Импорт</span>
            <span>ETA</span>
            <span style={{ textAlign: 'right' }}>FOB $</span>
            <span style={{ textAlign: 'right' }}>Себест $</span>
            <span style={{ textAlign: 'right' }}>Себест ₸</span>
            <span>Статус</span>
          </div>
          {filtered.map(b => (
            <div
              key={b.id}
              onClick={() => openDetails(b.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1.6fr 100px 100px 110px 110px 110px 130px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
                background: STATUS_BG[b.status],
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                {b.batch_number}
              </span>
              <span style={{ color: 'var(--tp)' }}>
                {b.supplier_name || '—'}
                {b.tracking_number && (
                  <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                    · {b.tracking_number}
                  </span>
                )}
                <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                  · {b.items_count} поз.
                </span>
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>{b.import_date || '—'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>{b.eta_date || '—'}</span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                {b.total_fob_usd ? fmtUsd(b.total_fob_usd) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)', fontWeight: 600 }}>
                {b.total_cost_usd ? fmtUsd(b.total_cost_usd) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                {b.total_cost_kzt ? fmtKzt(b.total_cost_kzt) : '—'}
              </span>
              <span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  color: STATUS_COLOR[b.status],
                  border: '1px solid ' + STATUS_COLOR[b.status],
                }}>{STATUS_LABEL[b.status]}</span>
                {b.stock_in_created && (
                  <span style={{
                    marginLeft: 4, fontSize: 10, color: 'var(--green)', fontFamily: 'var(--mono)',
                  }} title="Stock-in создан">📦</span>
                )}
              </span>
            </div>
          ))}
          </div>
          </div>
        </>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Клик по строке → вкладка «Отслеживание» с деталями + смена статуса.
        📦 = автоматически зачислено на склад при arrived.
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
