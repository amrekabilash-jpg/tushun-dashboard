import { useEffect, useState } from 'react';
import { api, BudgetMonth, ExpenseCategory } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const MONTHS_RU = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

interface CatForm {
  id: number | null;
  code: string;
  name: string;
  color: string;
  icon: string;
  monthly_limit_kzt: string;
  alert_percent: string;
  is_active: boolean;
}

const EMPTY_CAT: CatForm = {
  id: null, code: '', name: '', color: '#d4af37', icon: '📁',
  monthly_limit_kzt: '500000', alert_percent: '80', is_active: true,
};

export default function BudgetTab() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budget, setBudget] = useState<BudgetMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [catForm, setCatForm] = useState<CatForm>(EMPTY_CAT);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{
    category_id: number; budget_id: number | null; limit: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const [c, b] = await Promise.all([
        api.listExpenseCategories(true),
        api.getBudgets(year, month),
      ]);
      setCategories(c);
      setBudget(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [year, month]);

  const editCat = (c: ExpenseCategory) => {
    setCatForm({
      id: c.id, code: c.code, name: c.name,
      color: c.color, icon: c.icon || '📁',
      monthly_limit_kzt: String(c.monthly_limit_kzt),
      alert_percent: String(c.alert_percent),
      is_active: c.is_active,
    });
    setShowCatForm(true);
    setError(null);
  };

  const submitCat = async () => {
    if (!catForm.name.trim() || !catForm.code.trim()) {
      setError('Название и код обязательны');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        code: catForm.code.trim(),
        name: catForm.name.trim(),
        color: catForm.color,
        icon: catForm.icon,
        monthly_limit_kzt: parseFloat(catForm.monthly_limit_kzt) || 0,
        alert_percent: parseFloat(catForm.alert_percent) || 80,
        is_active: catForm.is_active,
      };
      if (catForm.id) {
        // code не меняем
        const { code: _, ...rest } = payload;
        void _;
        await api.updateExpenseCategory(catForm.id, rest);
      } else {
        await api.createExpenseCategory(payload);
      }
      setCatForm(EMPTY_CAT);
      setShowCatForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCat = async (id: number) => {
    if (!confirm('Удалить категорию? Связанные транзакции потеряют связь.')) return;
    try {
      await api.deleteExpenseCategory(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const saveBudget = async () => {
    if (!editingBudget) return;
    const limit = parseFloat(editingBudget.limit) || 0;
    setSubmitting(true);
    try {
      await api.upsertBudget({
        category_id: editingBudget.category_id,
        year, month,
        limit_amount_kzt: limit,
      });
      setEditingBudget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Period selector */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>Период:</span>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={selectStyle}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={selectStyle}>
          {MONTHS_RU.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {budget && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
            Бюджет: <span style={{ color: 'var(--gold)' }}>₸{fmtKzt(budget.totals.limit_kzt)}</span>
            {' · '}
            Факт: <span style={{ color: budget.totals.fact_kzt > budget.totals.limit_kzt ? 'var(--red)' : 'var(--green)' }}>
              ₸{fmtKzt(budget.totals.fact_kzt)}
            </span>
            {' · '}
            <span style={{
              color: budget.totals.used_percent > 100 ? 'var(--red)' :
                     budget.totals.used_percent > 80 ? 'var(--yellow)' : 'var(--green)',
              fontWeight: 700,
            }}>{budget.totals.used_percent}%</span>
          </span>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* Budget grid: категория × бюджет/факт/% */}
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
          План vs Факт · {MONTHS_RU[month - 1]} {year}
        </div>
        {budget?.rows.map(r => {
          const pct = Math.min(150, r.used_percent);  // ограничим бар на 150%
          const barColor =
            r.used_percent > 100 ? 'var(--red)' :
            r.used_percent >= r.alert_percent ? 'var(--yellow)' :
            'var(--green)';
          const isEditing = editingBudget?.category_id === r.category_id;

          return (
            <div key={r.category_id} style={{
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '36px 1.4fr 1.5fr 130px 130px 90px 110px',
                gap: 12, alignItems: 'center', marginBottom: 8,
              }}>
                <span style={{ fontSize: 22, textAlign: 'center' }}>{r.category_icon || '📁'}</span>
                <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{r.category_name}</span>

                {/* Bar */}
                <div style={{
                  height: 14, background: 'var(--bg-el)', borderRadius: 7, position: 'relative',
                  overflow: 'hidden', border: '1px solid var(--border)',
                }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, pct)}%`,
                    background: barColor, transition: 'width 0.3s',
                  }} />
                  {pct > 100 && (
                    <div style={{
                      position: 'absolute', top: 0, left: '100%', width: `${pct - 100}%`,
                      height: '100%', background: 'var(--red)',
                      borderLeft: '2px solid #fff',
                    }} />
                  )}
                </div>

                {isEditing ? (
                  <>
                    <input
                      type="number" min="0" step="10000"
                      value={editingBudget.limit}
                      onChange={e => setEditingBudget({ ...editingBudget, limit: e.target.value })}
                      style={{ ...inputStyle, textAlign: 'right' }}
                      autoFocus
                    />
                    <button onClick={saveBudget} disabled={submitting} className="btn btn-gold"
                      style={{ fontSize: 11, padding: '5px 10px' }}>
                      {submitting ? '…' : '✓'}
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      onClick={() => setEditingBudget({
                        category_id: r.category_id,
                        budget_id: r.budget_id,
                        limit: String(r.limit_amount_kzt),
                      })}
                      style={{
                        fontFamily: 'var(--mono)', textAlign: 'right',
                        color: 'var(--gold)', fontWeight: 600, cursor: 'pointer',
                        padding: '4px 8px', border: '1px dashed transparent', borderRadius: 4,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                      title="Клик для изменения лимита"
                    >
                      ₸{fmtKzt(r.limit_amount_kzt)}
                    </span>
                  </>
                )}
                <span style={{
                  fontFamily: 'var(--mono)', textAlign: 'right',
                  color: r.is_over ? 'var(--red)' : 'var(--ts)',
                  fontWeight: 600,
                }}>₸{fmtKzt(r.fact_amount_kzt)}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  textAlign: 'right',
                  color: r.is_over ? 'var(--red)' :
                         r.is_alert ? 'var(--yellow)' : 'var(--green)',
                }}>{r.used_percent}%</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right',
                  color: r.diff_kzt > 0 ? 'var(--red)' : 'var(--green)',
                  fontWeight: 600,
                }}>
                  {r.diff_kzt > 0 ? '+' : ''}₸{fmtKzt(Math.abs(r.diff_kzt))}
                </span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '36px 1.4fr 1.5fr 130px 130px 90px 110px',
                gap: 12, fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginLeft: 0, marginTop: 4, paddingLeft: 48,
              }}>
                <span></span>
                <span>{r.fact_count} операций</span>
                <span style={{ textAlign: 'right' }}>Лимит</span>
                <span style={{ textAlign: 'right' }}>Факт</span>
                <span style={{ textAlign: 'right' }}>%</span>
                <span style={{ textAlign: 'right' }}>{r.diff_kzt > 0 ? 'Перерасход' : 'Остаток'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Categories CRUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gold)',
          textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700,
        }}>
          ⚙️ Управление категориями
        </div>
        <button className="btn btn-gold"
          onClick={() => { setCatForm(EMPTY_CAT); setShowCatForm(s => !s); setError(null); }}>
          {showCatForm ? '✕ Отмена' : '+ Новая категория'}
        </button>
      </div>

      {showCatForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            {catForm.id ? `Редактирование #${catForm.id}` : 'Новая категория'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Field label="Код (slug)" required>
              <input value={catForm.code} disabled={!!catForm.id}
                onChange={e => setCatForm(f => ({ ...f, code: e.target.value }))}
                placeholder="marketing" />
            </Field>
            <Field label="Название" required>
              <input value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Иконка (emoji)">
              <input value={catForm.icon}
                onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="📁" maxLength={4} />
            </Field>
            <Field label="Цвет">
              <input type="color" value={catForm.color}
                onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                style={{ height: 32 }} />
            </Field>
            <Field label="Лимит/мес ₸">
              <input type="number" min="0" step="10000"
                value={catForm.monthly_limit_kzt}
                onChange={e => setCatForm(f => ({ ...f, monthly_limit_kzt: e.target.value }))} />
            </Field>
            <Field label="Алерт при %">
              <input type="number" min="0" max="200" step="5"
                value={catForm.alert_percent}
                onChange={e => setCatForm(f => ({ ...f, alert_percent: e.target.value }))} />
            </Field>
            <Field label="Активна">
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 5,
              }}>
                <input type="checkbox" checked={catForm.is_active}
                  onChange={e => setCatForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span style={{ fontSize: 12.5, color: 'var(--tp)' }}>
                  {catForm.is_active ? 'Активна' : 'Неактивна'}
                </span>
              </label>
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submitCat} disabled={submitting}>
              {submitting ? 'Сохранение…' : (catForm.id ? 'Сохранить' : 'Создать')}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowCatForm(false); setError(null); }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 100px 1.5fr 1fr 130px 90px 100px 60px',
          gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span></span>
          <span>Код</span>
          <span>Название</span>
          <span>Цвет</span>
          <span style={{ textAlign: 'right' }}>Default лимит</span>
          <span style={{ textAlign: 'right' }}>Alert%</span>
          <span></span>
          <span></span>
        </div>
        {categories.map(c => (
          <div key={c.id} style={{
            display: 'grid', gridTemplateColumns: '36px 100px 1.5fr 1fr 130px 90px 100px 60px',
            gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 18, textAlign: 'center' }}>{c.icon || '📁'}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>{c.code}</span>
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{c.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4, background: c.color,
                border: '1px solid var(--border)',
              }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
                {c.color}
              </span>
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)' }}>
              ₸{fmtKzt(c.monthly_limit_kzt)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {c.alert_percent}%
            </span>
            <button onClick={() => editCat(c)} style={editBtn}>Изменить</button>
            <button onClick={() => removeCat(c.id)} style={delBtn}>×</button>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Клик по сумме лимита в верхнем блоке → быстрое изменение бюджета на этот месяц.
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
