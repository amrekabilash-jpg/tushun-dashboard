import { useEffect, useMemo, useState } from 'react';
import { api, Expense, ExpenseCategory } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const today = () => new Date().toISOString().slice(0, 10);

interface Form {
  id: number | null;
  account_id: number | '';
  amount_kzt: string;
  description: string;
  counterparty: string;
  transaction_date: string;
  expense_category_id: number | '';
}

const EMPTY: Form = {
  id: null, account_id: '', amount_kzt: '',
  description: '', counterparty: '',
  transaction_date: today(), expense_category_id: '',
};

interface Account {
  id: number;
  account_number: string;
  bank_name: string;
  currency: string;
  balance: number;
}

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [catFilter, setCatFilter] = useState<'all' | number>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const params: Parameters<typeof api.listExpenses>[0] = { limit: 200 };
      if (catFilter !== 'all') params.category_id = catFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await api.listExpenses(params);
      setExpenses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [c, a] = await Promise.all([
          api.listExpenseCategories(true),
          api.listAccounts(),
        ]);
        setCategories(c);
        setAccounts(a);
        if (a.length > 0 && form.account_id === '') {
          setForm(f => ({ ...f, account_id: a[0].id }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [catFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(e =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.counterparty || '').toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const totalAmount = useMemo(
    () => filtered.reduce((acc, e) => acc + e.amount_kzt, 0),
    [filtered],
  );

  const editExpense = (e: Expense) => {
    setForm({
      id: e.id,
      account_id: e.account_id,
      amount_kzt: String(e.amount_kzt),
      description: e.description || '',
      counterparty: e.counterparty || '',
      transaction_date: e.transaction_date || today(),
      expense_category_id: e.expense_category_id ?? '',
    });
    setShowForm(true);
    setError(null);
  };

  const submit = async () => {
    if (!form.account_id || !form.amount_kzt) {
      setError('Счёт и сумма обязательны');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        account_id: form.account_id as number,
        amount_kzt: parseFloat(form.amount_kzt) || 0,
        description: form.description || undefined,
        counterparty: form.counterparty || undefined,
        transaction_date: form.transaction_date || undefined,
        expense_category_id: form.expense_category_id === '' ? undefined : (form.expense_category_id as number),
      };
      if (form.id) {
        await api.updateExpense(form.id, {
          ...payload,
          expense_category_id: form.expense_category_id === '' ? null : (form.expense_category_id as number),
        });
      } else {
        await api.createExpense(payload);
      }
      setForm({ ...EMPTY, account_id: form.account_id });
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  const removeExpense = async (id: number) => {
    if (!confirm('Удалить расход?')) return;
    try {
      await api.deleteExpense(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка расходов…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input type="text" placeholder="Поиск по описанию, контрагенту…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 240 }} />
        <select value={catFilter}
          onChange={e => setCatFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={selectStyle}>
          <option value="all">Все категории</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tm)' }}>
          с
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selectStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tm)' }}>
          по
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={selectStyle} />
        </label>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          {filtered.length} • <span style={{ color: 'var(--gold)', fontWeight: 600 }}>₸{fmtKzt(totalAmount)}</span>
        </span>
        <button className="btn btn-gold" onClick={() => {
          setForm({ ...EMPTY, account_id: accounts[0]?.id ?? '' });
          setShowForm(s => !s); setError(null);
        }}>
          {showForm ? '✕ Закрыть' : '+ Новый расход'}
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
            {form.id ? `Редактирование расхода #${form.id}` : 'Новый расход'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Категория">
              <select value={form.expense_category_id}
                onChange={e => setForm(f => ({ ...f, expense_category_id: e.target.value === '' ? '' : parseInt(e.target.value) }))}>
                <option value="">— без категории —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Сумма ₸" required>
              <input type="number" step="100" min="0"
                value={form.amount_kzt}
                onChange={e => setForm(f => ({ ...f, amount_kzt: e.target.value }))} />
            </Field>
            <Field label="Дата">
              <input type="date" value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
            </Field>
            <Field label="Счёт" required>
              <select value={form.account_id}
                onChange={e => setForm(f => ({ ...f, account_id: parseInt(e.target.value) || '' }))}>
                <option value="">— выбрать —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name || a.account_number} ({a.currency})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Описание">
              <input value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Аренда офиса май" />
            </Field>
            <Field label="Контрагент">
              <input value={form.counterparty}
                onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                placeholder="ИП Жанатов" />
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

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Расходов не найдено
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '110px 160px 2.2fr 1.2fr 130px 60px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Дата</span>
            <span>Категория</span>
            <span>Описание</span>
            <span>Контрагент</span>
            <span style={{ textAlign: 'right' }}>Сумма ₸</span>
            <span></span>
          </div>
          {filtered.map(e => (
            <div key={e.id}
              onClick={() => editExpense(e)}
              style={{
                display: 'grid', gridTemplateColumns: '110px 160px 2.2fr 1.2fr 130px 60px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(212,175,55,.04)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>
                {e.transaction_date}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, color: e.expense_category_color || 'var(--tm)',
                fontWeight: 600,
              }}>
                <span style={{ fontSize: 14 }}>{e.expense_category_icon || '📁'}</span>
                {e.expense_category_name || 'Без категории'}
              </span>
              <span style={{ color: 'var(--tp)' }}>{e.description || '—'}</span>
              <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>{e.counterparty || '—'}</span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: 'var(--red)', fontWeight: 700,
              }}>−{fmtKzt(e.amount_kzt)}</span>
              <button onClick={ev => { ev.stopPropagation(); removeExpense(e.id); }} style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--red)', cursor: 'pointer', borderRadius: 4,
                padding: '3px 8px', fontSize: 13,
              }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Клик по строке → редактирование. Сумма всегда отображается красным как расход.
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
