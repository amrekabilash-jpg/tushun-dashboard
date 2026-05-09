import { useEffect, useMemo, useState } from 'react';
import { api, Customer, CustomerStatus, CustomerType } from '../../../utils/api';

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const STATUS_LABEL: Record<CustomerStatus, string> = {
  active:   'Активный',
  inactive: 'Неактивный',
  blocked:  'Заблокирован',
};

const STATUS_COLOR: Record<CustomerStatus, string> = {
  active:   'var(--green)',
  inactive: 'var(--tm)',
  blocked:  'var(--red)',
};

interface Form {
  id: number | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  tax_id: string;
  customer_type: CustomerType;
  status: CustomerStatus;
  discount_percent: string;
  credit_limit_kzt: string;
  notes: string;
}

const EMPTY: Form = {
  id: null, name: '', phone: '', email: '', address: '', tax_id: '',
  customer_type: 'b2b', status: 'active',
  discount_percent: '0', credit_limit_kzt: '0', notes: '',
};

export default function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const data = await api.listCustomers({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setCustomers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.tax_id || '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  const editCustomer = (c: Customer) => {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      tax_id: c.tax_id || '',
      customer_type: c.customer_type,
      status: c.status,
      discount_percent: String(c.discount_percent || 0),
      credit_limit_kzt: String(c.credit_limit_kzt || 0),
      notes: c.notes || '',
    });
    setShowForm(true);
    setError(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Имя обязательно');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        tax_id: form.tax_id.trim() || undefined,
        customer_type: form.customer_type,
        status: form.status,
        discount_percent: parseFloat(form.discount_percent) || 0,
        credit_limit_kzt: parseFloat(form.credit_limit_kzt) || 0,
        notes: form.notes.trim() || undefined,
      };
      if (form.id) {
        await api.updateCustomer(form.id, payload);
      } else {
        await api.createCustomer(payload);
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

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка клиентов…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input
          type="text"
          placeholder="Поиск по имени, телефону, БИН…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          style={selectStyle}
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="blocked">Заблокированные</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Показано: {filtered.length}
        </span>
        <button
          className="btn btn-gold"
          onClick={() => { setForm(EMPTY); setShowForm(s => !s); setError(null); }}
        >
          {showForm ? '✕ Закрыть' : '+ Новый клиент'}
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
            {form.id ? `Редактирование клиента #${form.id}` : 'Новый клиент'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="Название" required>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Телефон">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+7 727 ..." />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="БИН/ИИН">
              <input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
            </Field>
            <Field label="Адрес">
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field label="Тип клиента">
              <select value={form.customer_type}
                onChange={e => setForm(f => ({ ...f, customer_type: e.target.value as CustomerType }))}>
                <option value="b2b">B2B (юр. лицо)</option>
                <option value="b2c">B2C (физ. лицо)</option>
              </select>
            </Field>
            <Field label="Статус">
              <select value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as CustomerStatus }))}>
                <option value="active">Активный</option>
                <option value="inactive">Неактивный</option>
                <option value="blocked">Заблокирован</option>
              </select>
            </Field>
            <Field label="Скидка, %">
              <input type="number" step="0.1" min="0" max="100"
                value={form.discount_percent}
                onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} />
            </Field>
            <Field label="Кредитный лимит, ₸">
              <input type="number" min="0" step="100000"
                value={form.credit_limit_kzt}
                onChange={e => setForm(f => ({ ...f, credit_limit_kzt: e.target.value }))} />
            </Field>
            <Field label="Примечание">
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submit} disabled={submitting}>
              {submitting ? 'Сохранение…' : (form.id ? 'Сохранить' : 'Создать')}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setForm(EMPTY); setError(null); }}>
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
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Клиенты не найдены
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 2.2fr 1fr 1fr 110px 90px 90px 110px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>#</span>
            <span>Название</span>
            <span>Телефон</span>
            <span>БИН/ИИН</span>
            <span style={{ textAlign: 'right' }}>Счетов</span>
            <span style={{ textAlign: 'right' }}>Долг ₸</span>
            <span style={{ textAlign: 'right' }}>Скидка</span>
            <span>Статус</span>
          </div>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => editCustomer(c)}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 2.2fr 1fr 1fr 110px 90px 90px 110px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>{c.id}</span>
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>
                {c.name}
                {c.customer_type === 'b2c' && (
                  <span style={{
                    marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 9,
                    color: 'var(--tm)', padding: '1px 5px', border: '1px solid var(--border)',
                    borderRadius: 3,
                  }}>B2C</span>
                )}
              </span>
              <span style={{ color: 'var(--ts)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {c.phone || '—'}
              </span>
              <span style={{ color: 'var(--ts)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {c.tax_id || '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
                {c.invoice_count ?? '—'}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                color: (c.outstanding_kzt || 0) > 0 ? 'var(--red)' : 'var(--ts)',
              }}>
                {fmt(c.outstanding_kzt || 0)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)' }}>
                {c.discount_percent}%
              </span>
              <span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 4,
                  color: STATUS_COLOR[c.status],
                  border: '1px solid ' + STATUS_COLOR[c.status],
                }}>{STATUS_LABEL[c.status]}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Клик по строке → редактирование клиента
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, width: 280,
};

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
          outline: none; border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
