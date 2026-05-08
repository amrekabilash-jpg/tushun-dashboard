import { useEffect, useMemo, useState } from 'react';
import { api, Product } from '../../../utils/api';

const CATEGORY_LABELS: Record<string, string> = {
  oil_filter:    'Фильтр масляный',
  air_filter:    'Фильтр воздушный',
  fuel_filter:   'Фильтр топливный',
  cabin_filter:  'Фильтр салонный',
  rubber_hose:   'Патрубок резиновый',
  silicone_hose: 'Патрубок силиконовый',
  other:         'Другое',
};

interface Form {
  name: string;
  tn_ved_code: string;
  category: string;
  unit: string;
  customs_duty_percent: string;
  vat_import_percent: string;
  vat_sale_percent: string;
  kpn_percent: string;
}

const EMPTY: Form = {
  name: '', tn_ved_code: '', category: 'oil_filter', unit: 'шт',
  customs_duty_percent: '12', vat_import_percent: '12',
  vat_sale_percent: '16', kpn_percent: '10',
};

export default function CatalogTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const data = await api.listProducts();
      setProducts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.tn_ved_code || '').toLowerCase().includes(q) ||
      (CATEGORY_LABELS[p.category] || p.category).toLowerCase().includes(q),
    );
  }, [products, search]);

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Укажи наименование');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createProduct({
        name: form.name.trim(),
        tn_ved_code: form.tn_ved_code.trim() || undefined,
        category: form.category,
        unit: form.unit || 'шт',
        customs_duty_percent: parseFloat(form.customs_duty_percent) / 100,
        vat_import_percent: parseFloat(form.vat_import_percent) / 100,
        vat_sale_percent: parseFloat(form.vat_sale_percent) / 100,
        kpn_percent: parseFloat(form.kpn_percent) / 100,
      });
      setForm(EMPTY);
      setShowAdd(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка справочника…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            placeholder="Поиск по названию, ТН ВЭД, категории…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg-el)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 12px', color: 'var(--tp)',
              fontSize: 12.5, width: 320,
            }}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
            {filtered.length} / {products.length}
          </span>
        </div>
        <button
          className="btn btn-gold"
          onClick={() => { setShowAdd(s => !s); setError(null); }}
        >
          {showAdd ? '✕ Отмена' : '+ Добавить товар'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Новый товар
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Наименование" required>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Фильтр масляный TY-101"
              />
            </Field>
            <Field label="Категория">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, lab]) => (
                  <option key={key} value={key}>{lab}</option>
                ))}
              </select>
            </Field>
            <Field label="Код ТН ВЭД">
              <input
                value={form.tn_ved_code}
                onChange={e => setForm(f => ({ ...f, tn_ved_code: e.target.value }))}
                placeholder="8421.23"
              />
            </Field>
            <Field label="Ед. изм.">
              <input
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              />
            </Field>
            <Field label="Пошлина, %">
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.customs_duty_percent}
                onChange={e => setForm(f => ({ ...f, customs_duty_percent: e.target.value }))}
              />
            </Field>
            <Field label="НДС импорт, %">
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.vat_import_percent}
                onChange={e => setForm(f => ({ ...f, vat_import_percent: e.target.value }))}
              />
            </Field>
            <Field label="НДС продажа, %">
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.vat_sale_percent}
                onChange={e => setForm(f => ({ ...f, vat_sale_percent: e.target.value }))}
              />
            </Field>
            <Field label="КПН, %">
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.kpn_percent}
                onChange={e => setForm(f => ({ ...f, kpn_percent: e.target.value }))}
              />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submit} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Создать'}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowAdd(false); setForm(EMPTY); }}>
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

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 2fr 1fr 100px 80px 70px 70px 70px 70px',
          gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>#</span>
          <span>Наименование</span>
          <span>Категория</span>
          <span>ТН ВЭД</span>
          <span>Ед.</span>
          <span style={{ textAlign: 'right' }}>Пошл.%</span>
          <span style={{ textAlign: 'right' }}>НДС имп.</span>
          <span style={{ textAlign: 'right' }}>НДС прод.</span>
          <span style={{ textAlign: 'right' }}>КПН</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Ничего не найдено
          </div>
        ) : filtered.map(p => (
          <div
            key={p.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 2fr 1fr 100px 80px 70px 70px 70px 70px',
              gap: 8, padding: '11px 16px', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              fontSize: 12.5,
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>{p.id}</span>
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{p.name}</span>
            <span style={{ color: 'var(--ts)' }}>{CATEGORY_LABELS[p.category] || p.category}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
              {p.tn_ved_code || '—'}
            </span>
            <span style={{ color: 'var(--ts)' }}>{p.unit}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {(p.customs_duty_percent * 100).toFixed(0)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {(p.vat_import_percent * 100).toFixed(0)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {(p.vat_sale_percent * 100).toFixed(0)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {(p.kpn_percent * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        marginTop: -4,
      }}>
        Подсказка: налоговые ставки можно менять в инструменте «Налоговые ставки» с историей изменений.
      </div>
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
      <div style={{
        display: 'flex',
      }}>
        {children}
      </div>
      <style>{`
        label > div input, label > div select {
          flex: 1;
          background: var(--bg-el);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 7px 10px;
          color: var(--tp);
          font-size: 12.5px;
          font-family: inherit;
          width: 100%;
        }
        label > div input:focus, label > div select:focus {
          outline: none;
          border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
