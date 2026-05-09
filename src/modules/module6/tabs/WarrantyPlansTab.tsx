import { useEffect, useState } from 'react';
import { api, Product, WarrantyPlan } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

interface Form {
  id: number | null;
  product_id: number | '';
  name: string;
  months: string;
  coverage_percent: string;
  price_kzt: string;
  description: string;
  is_active: boolean;
}

const EMPTY: Form = {
  id: null, product_id: '', name: '', months: '12',
  coverage_percent: '100', price_kzt: '0',
  description: '', is_active: true,
};

export default function WarrantyPlansTab() {
  const [plans, setPlans] = useState<WarrantyPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const [p, pr] = await Promise.all([
        api.listWarrantyPlans(),
        api.listProducts(),
      ]);
      setPlans(p);
      setProducts(pr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const editPlan = (p: WarrantyPlan) => {
    setForm({
      id: p.id, product_id: p.product_id, name: p.name,
      months: String(p.months), coverage_percent: String(p.coverage_percent),
      price_kzt: String(p.price_kzt),
      description: p.description || '', is_active: p.is_active,
    });
    setShowForm(true);
    setError(null);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.product_id || !form.months) {
      setError('Название, товар и срок обязательны');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        product_id: form.product_id as number,
        name: form.name.trim(),
        months: parseInt(form.months) || 12,
        coverage_percent: parseFloat(form.coverage_percent) || 100,
        price_kzt: parseFloat(form.price_kzt) || 0,
        description: form.description.trim() || undefined,
        is_active: form.is_active,
      };
      if (form.id) {
        await api.updateWarrantyPlan(form.id, payload);
      } else {
        await api.createWarrantyPlan(payload);
      }
      setForm(EMPTY);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  const removePlan = async (id: number) => {
    if (!confirm('Удалить гарантийный план?')) return;
    try {
      await api.deleteWarrantyPlan(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const toggleActive = async (p: WarrantyPlan) => {
    try {
      await api.updateWarrantyPlan(p.id, { is_active: !p.is_active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка планов…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Планов: {plans.length} ({plans.filter(p => p.is_active).length} активных)
        </span>
        <button className="btn btn-gold" style={{ marginLeft: 'auto' }}
          onClick={() => { setForm(EMPTY); setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Новый план'}
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
            {form.id ? `Редактирование плана #${form.id}` : 'Новый гарантийный план'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Название" required>
              <input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Стандартная гарантия 12 мес." />
            </Field>
            <Field label="Товар" required>
              <select value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: parseInt(e.target.value) || '' }))}>
                <option value="">— выбрать —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Срок (мес.)" required>
              <input type="number" min="1" max="120"
                value={form.months}
                onChange={e => setForm(f => ({ ...f, months: e.target.value }))} />
            </Field>
            <Field label="Покрытие %">
              <input type="number" min="0" max="100" step="5"
                value={form.coverage_percent}
                onChange={e => setForm(f => ({ ...f, coverage_percent: e.target.value }))} />
            </Field>
            <Field label="Цена ₸ (доплата)">
              <input type="number" min="0" step="100"
                value={form.price_kzt}
                onChange={e => setForm(f => ({ ...f, price_kzt: e.target.value }))} />
            </Field>
            <Field label="Активен">
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 5,
              }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span style={{ fontSize: 12.5, color: 'var(--tp)' }}>
                  {form.is_active ? 'Активен' : 'Неактивен'}
                </span>
              </label>
            </Field>
            <Field label="Описание">
              <input value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submit} disabled={submitting}>
              {submitting ? 'Сохранение…' : (form.id ? 'Сохранить' : 'Создать')}
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

      {/* Table */}
      {plans.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Гарантийных планов пока нет
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 2fr 1.4fr 90px 100px 110px 100px 60px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Статус</span>
            <span>Название</span>
            <span>Товар</span>
            <span style={{ textAlign: 'right' }}>Срок</span>
            <span style={{ textAlign: 'right' }}>Покрытие</span>
            <span style={{ textAlign: 'right' }}>Цена ₸</span>
            <span></span>
            <span></span>
          </div>
          {plans.map(p => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '60px 2fr 1.4fr 90px 100px 110px 100px 60px',
              gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
              opacity: p.is_active ? 1 : 0.55,
            }}>
              <button onClick={() => toggleActive(p)} style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                background: 'transparent',
                color: p.is_active ? 'var(--green)' : 'var(--tm)',
                border: '1px solid ' + (p.is_active ? 'var(--green)' : 'var(--tm)'),
              }}>{p.is_active ? '✓ ON' : '✕ OFF'}</button>
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>
                {p.name}
                {p.description && (
                  <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{p.description}</div>
                )}
              </span>
              <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                {p.product_name || '—'}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: 'var(--gold)', fontWeight: 600,
              }}>{p.months} мес.</span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: p.coverage_percent === 100 ? 'var(--green)' :
                       p.coverage_percent >= 50 ? 'var(--gold)' : 'var(--red)',
                fontWeight: 600,
              }}>{p.coverage_percent}%</span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: p.price_kzt > 0 ? 'var(--gold)' : 'var(--green)',
              }}>
                {p.price_kzt > 0 ? fmtKzt(p.price_kzt) : 'бесплатно'}
              </span>
              <button onClick={() => editPlan(p)} style={editBtn}>Изменить</button>
              <button onClick={() => removePlan(p.id)} style={delBtn}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Кнопка ON/OFF — быстрое включение/выключение плана. 100% покрытие = полное возмещение.
      </div>
    </div>
  );
}

const editBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--gold)',
  color: 'var(--gold)', cursor: 'pointer', borderRadius: 4,
  padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
};

const delBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--red)', cursor: 'pointer', borderRadius: 4,
  padding: '3px 8px', fontSize: 13, fontFamily: 'inherit',
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
          outline: none; border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
