import { useEffect, useMemo, useState } from 'react';
import { api, MovementType, Product, StockMovement, Warehouse } from '../../../utils/api';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const MTYPE_LABEL: Record<MovementType, string> = {
  in:           'Приход',
  out:          'Расход',
  transfer_in:  'Перемещение ←',
  transfer_out: 'Перемещение →',
  adjustment:   'Корректировка',
};

const MTYPE_COLOR: Record<MovementType, string> = {
  in:           'var(--green)',
  out:          'var(--red)',
  transfer_in:  'var(--gold)',
  transfer_out: 'var(--gold)',
  adjustment:   'var(--tm)',
};

type FormMode = 'in' | 'out' | 'transfer';

interface MovForm {
  mode: FormMode;
  product_id: number | '';
  warehouse_id: number | '';
  to_warehouse_id: number | '';  // только для transfer
  quantity: string;
  document_ref: string;
  counterparty: string;
  note: string;
  movement_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: MovForm = {
  mode: 'in', product_id: '', warehouse_id: '', to_warehouse_id: '',
  quantity: '', document_ref: '', counterparty: '', note: '',
  movement_date: today(),
};

export default function MovementTab() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterWarehouse, setFilterWarehouse] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<MovementType | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MovForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const refreshList = async () => {
    try {
      const params: Parameters<typeof api.listStockMovements>[0] = { limit: 100 };
      if (filterWarehouse !== 'all') params.warehouse_id = filterWarehouse;
      if (filterType !== 'all') params.movement_type = filterType;
      const data = await api.listStockMovements(params);
      setMovements(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [p, w] = await Promise.all([api.listProducts(), api.listWarehouses()]);
        setProducts(p);
        setWarehouses(w);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
  }, []);

  useEffect(() => { refreshList(); /* eslint-disable-next-line */ }, [filterWarehouse, filterType]);

  const submit = async () => {
    if (form.product_id === '' || form.warehouse_id === '' || !form.quantity) {
      setError('Заполни обязательные поля');
      return;
    }
    const qty = parseInt(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Количество должно быть > 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (form.mode === 'transfer') {
        if (form.to_warehouse_id === '' || form.to_warehouse_id === form.warehouse_id) {
          setError('Выбери склад-получатель');
          return;
        }
        await api.transferStock({
          product_id: form.product_id as number,
          from_warehouse_id: form.warehouse_id as number,
          to_warehouse_id: form.to_warehouse_id as number,
          quantity: qty,
          note: form.note || undefined,
          document_ref: form.document_ref || undefined,
          movement_date: form.movement_date || undefined,
        });
      } else {
        await api.createStockMovement({
          product_id: form.product_id as number,
          warehouse_id: form.warehouse_id as number,
          movement_type: form.mode,
          quantity: qty,
          document_ref: form.document_ref || undefined,
          counterparty: form.counterparty || undefined,
          note: form.note || undefined,
          movement_date: form.movement_date || undefined,
        });
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  if (loading && movements.length === 0)
    return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка движений…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <select
          value={filterWarehouse}
          onChange={e => setFilterWarehouse(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={selectStyle}
        >
          <option value="all">Все склады</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
          style={selectStyle}
        >
          <option value="all">Все типы</option>
          <option value="in">Приход</option>
          <option value="out">Расход</option>
          <option value="transfer_in">Перемещение ←</option>
          <option value="transfer_out">Перемещение →</option>
          <option value="adjustment">Корректировка</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Всего: {total} {total > 100 && '(показано 100)'}
        </span>
        <button className="btn btn-gold" onClick={() => { setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Зарегистрировать'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['in', 'out', 'transfer'] as FormMode[]).map(m => (
              <button
                key={m}
                onClick={() => setForm(f => ({ ...f, mode: m }))}
                style={{
                  background: form.mode === m ? 'var(--gold)' : 'var(--bg-el)',
                  color: form.mode === m ? 'var(--bg-deep)' : 'var(--ts)',
                  border: '1px solid ' + (form.mode === m ? 'var(--gold)' : 'var(--border)'),
                  borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {m === 'in' ? '↓ Приход' : m === 'out' ? '↑ Расход' : '⇌ Перемещение'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Товар" required>
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: parseInt(e.target.value) || '' }))}
              >
                <option value="">— выбрать —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={form.mode === 'transfer' ? 'Склад-источник' : 'Склад'} required>
              <select
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: parseInt(e.target.value) || '' }))}
              >
                <option value="">— выбрать —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>
                ))}
              </select>
            </Field>
            {form.mode === 'transfer' && (
              <Field label="Склад-получатель" required>
                <select
                  value={form.to_warehouse_id}
                  onChange={e => setForm(f => ({ ...f, to_warehouse_id: parseInt(e.target.value) || '' }))}
                >
                  <option value="">— выбрать —</option>
                  {warehouses
                    .filter(w => w.id !== form.warehouse_id)
                    .map(w => (
                      <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Количество" required>
              <input
                type="number" min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="100"
              />
            </Field>
            <Field label="Дата">
              <input
                type="date"
                value={form.movement_date}
                onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))}
              />
            </Field>
            <Field label="Документ">
              <input
                value={form.document_ref}
                onChange={e => setForm(f => ({ ...f, document_ref: e.target.value }))}
                placeholder={form.mode === 'in' ? 'BATCH-2026-001' : form.mode === 'out' ? 'СФ-2026-105' : 'TRF-2026-01'}
              />
            </Field>
            {form.mode !== 'transfer' && (
              <Field label="Контрагент">
                <input
                  value={form.counterparty}
                  onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                  placeholder={form.mode === 'in' ? 'Tushun Co., Ltd' : 'ТОО АвтоАлмат'}
                />
              </Field>
            )}
            <Field label="Примечание">
              <input
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="опционально"
              />
            </Field>
          </div>

          {/* Preview unit cost */}
          {form.mode === 'in' && form.product_id !== '' && (
            <div style={{
              marginTop: 12, padding: '8px 12px', background: 'var(--bg-el)',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            }}>
              Налоги для «{productMap.get(form.product_id as number)?.name}»:
              пошлина {((productMap.get(form.product_id as number)?.customs_duty_percent || 0) * 100).toFixed(0)}% ·
              НДС импорт {((productMap.get(form.product_id as number)?.vat_import_percent || 0) * 100).toFixed(0)}%
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submit} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Зарегистрировать'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>
          {error}
        </div>
      )}

      {/* List */}
      {movements.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Нет движений по выбранным фильтрам
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 130px 2fr 1.2fr 1fr 110px 80px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Дата</span>
            <span>Тип</span>
            <span>Товар</span>
            <span>Склад</span>
            <span>Документ / контрагент</span>
            <span style={{ textAlign: 'right' }}>Кол-во</span>
            <span style={{ textAlign: 'right' }}>ID</span>
          </div>
          {movements.map(m => (
            <div
              key={m.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 130px 2fr 1.2fr 1fr 110px 80px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
                {m.movement_date}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: MTYPE_COLOR[m.movement_type] }}>
                {MTYPE_LABEL[m.movement_type]}
              </span>
              <span style={{ color: 'var(--tp)' }}>{m.product_name || '—'}</span>
              <span style={{ color: 'var(--ts)' }}>{m.warehouse_name || '—'}</span>
              <span style={{ color: 'var(--ts)', fontSize: 11.5, fontFamily: 'var(--mono)' }}>
                {m.document_ref || m.counterparty || m.note || '—'}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, textAlign: 'right',
                color: m.quantity > 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {m.quantity > 0 ? '+' : ''}{fmt(m.quantity)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', textAlign: 'right' }}>
                #{m.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'inherit',
};

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
          outline: none;
          border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
