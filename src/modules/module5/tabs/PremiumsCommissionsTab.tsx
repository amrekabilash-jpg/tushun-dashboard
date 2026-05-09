import { useEffect, useState } from 'react';
import {
  api, Commission, CommissionType, Premium, PremiumPeriod, PremiumRole, PremiumType,
} from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const PERIOD_LABEL: Record<PremiumPeriod, string> = {
  monthly: 'Ежемесячно', quarterly: 'Ежеквартально', yearly: 'Ежегодно', 'one-time': 'Разово',
};

const ROLE_LABEL: Record<PremiumRole, string> = {
  sales: 'Продажи', warehouse: 'Склад', management: 'Руководство', all: 'Все',
};

const COMM_TYPE_LABEL: Record<CommissionType, string> = {
  sales: 'Продажи', service: 'Сервис', returns: 'Возвраты', logistics: 'Логистика',
};

const COMM_TYPE_COLOR: Record<CommissionType, string> = {
  sales: 'var(--green)', service: 'var(--gold)',
  returns: 'var(--red)', logistics: 'var(--yellow)',
};

interface PremiumForm {
  id: number | null;
  name: string;
  premium_type: PremiumType;
  amount: string;
  description: string;
  period: PremiumPeriod | '';
  target_role: PremiumRole | '';
  is_active: boolean;
}

interface CommissionForm {
  id: number | null;
  name: string;
  commission_type: CommissionType;
  percent: string;
  min_amount_kzt: string;
  max_amount_kzt: string;
  description: string;
  is_active: boolean;
}

const EMPTY_PREMIUM: PremiumForm = {
  id: null, name: '', premium_type: 'fixed', amount: '0', description: '',
  period: 'monthly', target_role: 'all', is_active: true,
};

const EMPTY_COMMISSION: CommissionForm = {
  id: null, name: '', commission_type: 'sales', percent: '0',
  min_amount_kzt: '0', max_amount_kzt: '', description: '', is_active: true,
};

export default function PremiumsCommissionsTab() {
  const [premiums, setPremiums] = useState<Premium[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pForm, setPForm] = useState<PremiumForm>(EMPTY_PREMIUM);
  const [showPForm, setShowPForm] = useState(false);
  const [cForm, setCForm] = useState<CommissionForm>(EMPTY_COMMISSION);
  const [showCForm, setShowCForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const [p, c] = await Promise.all([
        api.listPremiums(),
        api.listCommissions(),
      ]);
      setPremiums(p);
      setCommissions(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // ---------- PREMIUMS ----------

  const editPremium = (p: Premium) => {
    setPForm({
      id: p.id,
      name: p.name,
      premium_type: p.premium_type,
      amount: String(p.amount),
      description: p.description || '',
      period: p.period || '',
      target_role: p.target_role || '',
      is_active: p.is_active,
    });
    setShowPForm(true);
    setError(null);
  };

  const submitPremium = async () => {
    if (!pForm.name.trim()) {
      setError('Название обязательно');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: pForm.name.trim(),
        premium_type: pForm.premium_type,
        amount: parseFloat(pForm.amount) || 0,
        description: pForm.description.trim() || null,
        period: (pForm.period || null) as PremiumPeriod | null,
        target_role: (pForm.target_role || null) as PremiumRole | null,
        is_active: pForm.is_active,
      };
      if (pForm.id) {
        await api.updatePremium(pForm.id, payload);
      } else {
        await api.createPremium(payload);
      }
      setPForm(EMPTY_PREMIUM);
      setShowPForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const removePremium = async (id: number) => {
    if (!confirm('Удалить премию?')) return;
    try {
      await api.deletePremium(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  // ---------- COMMISSIONS ----------

  const editCommission = (c: Commission) => {
    setCForm({
      id: c.id,
      name: c.name,
      commission_type: c.commission_type,
      percent: String(c.percent),
      min_amount_kzt: String(c.min_amount_kzt),
      max_amount_kzt: c.max_amount_kzt !== null ? String(c.max_amount_kzt) : '',
      description: c.description || '',
      is_active: c.is_active,
    });
    setShowCForm(true);
    setError(null);
  };

  const submitCommission = async () => {
    if (!cForm.name.trim()) {
      setError('Название обязательно');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: cForm.name.trim(),
        commission_type: cForm.commission_type,
        percent: parseFloat(cForm.percent) || 0,
        min_amount_kzt: parseFloat(cForm.min_amount_kzt) || 0,
        max_amount_kzt: cForm.max_amount_kzt ? parseFloat(cForm.max_amount_kzt) : null,
        description: cForm.description.trim() || null,
        is_active: cForm.is_active,
      };
      if (cForm.id) {
        await api.updateCommission(cForm.id, payload);
      } else {
        await api.createCommission(payload);
      }
      setCForm(EMPTY_COMMISSION);
      setShowCForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCommission = async (id: number) => {
    if (!confirm('Удалить комиссию?')) return;
    try {
      await api.deleteCommission(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* PREMIUMS BLOCK */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700,
          }}>
            🎁 Премии · {premiums.length}
          </div>
          <button className="btn btn-gold"
            onClick={() => { setPForm(EMPTY_PREMIUM); setShowPForm(s => !s); setError(null); }}>
            {showPForm ? '✕ Отмена' : '+ Новая премия'}
          </button>
        </div>

        {showPForm && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--gold)',
            borderRadius: 10, padding: 18,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
              textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
            }}>
              {pForm.id ? `Редактирование премии #${pForm.id}` : 'Новая премия'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Название" required>
                <input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Тип">
                <select value={pForm.premium_type}
                  onChange={e => setPForm(f => ({ ...f, premium_type: e.target.value as PremiumType }))}>
                  <option value="fixed">Фиксированная (₸)</option>
                  <option value="percent">Процент (%)</option>
                </select>
              </Field>
              <Field label={pForm.premium_type === 'fixed' ? 'Сумма ₸' : 'Процент %'} required>
                <input type="number" step={pForm.premium_type === 'fixed' ? '1000' : '0.1'} min="0"
                  value={pForm.amount}
                  onChange={e => setPForm(f => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Период">
                <select value={pForm.period}
                  onChange={e => setPForm(f => ({ ...f, period: e.target.value as PremiumPeriod | '' }))}>
                  <option value="">— нет —</option>
                  <option value="monthly">Ежемесячно</option>
                  <option value="quarterly">Ежеквартально</option>
                  <option value="yearly">Ежегодно</option>
                  <option value="one-time">Разово</option>
                </select>
              </Field>
              <Field label="Кому">
                <select value={pForm.target_role}
                  onChange={e => setPForm(f => ({ ...f, target_role: e.target.value as PremiumRole | '' }))}>
                  <option value="">— все —</option>
                  <option value="sales">Продажи</option>
                  <option value="warehouse">Склад</option>
                  <option value="management">Руководство</option>
                  <option value="all">Все</option>
                </select>
              </Field>
              <Field label="Описание">
                <input value={pForm.description}
                  onChange={e => setPForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Активна">
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 5,
                }}>
                  <input type="checkbox" checked={pForm.is_active}
                    onChange={e => setPForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span style={{ fontSize: 12.5, color: 'var(--tp)' }}>
                    {pForm.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </label>
              </Field>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button className="btn btn-gold" onClick={submitPremium} disabled={submitting}>
                {submitting ? 'Сохранение…' : (pForm.id ? 'Сохранить' : 'Создать')}
              </button>
              <button className="btn btn-outline" onClick={() => { setShowPForm(false); setError(null); }}>
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
            display: 'grid', gridTemplateColumns: '60px 2fr 100px 130px 130px 110px 100px 60px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Статус</span>
            <span>Название</span>
            <span>Тип</span>
            <span style={{ textAlign: 'right' }}>Сумма</span>
            <span>Период</span>
            <span>Кому</span>
            <span></span>
            <span></span>
          </div>
          {premiums.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
              Премий пока нет
            </div>
          ) : premiums.map(p => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '60px 2fr 100px 130px 130px 110px 100px 60px',
              gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
              opacity: p.is_active ? 1 : 0.5,
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
                color: p.is_active ? 'var(--green)' : 'var(--tm)',
                border: '1px solid ' + (p.is_active ? 'var(--green)' : 'var(--tm)'),
                textAlign: 'center',
              }}>{p.is_active ? '✓' : '✕'}</span>
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>
                {p.name}
                {p.description && (
                  <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{p.description}</div>
                )}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ts)' }}>
                {p.premium_type === 'percent' ? '%' : '₸'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                {p.premium_type === 'percent' ? `${p.amount}%` : `₸${fmtKzt(p.amount)}`}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ts)' }}>
                {p.period ? PERIOD_LABEL[p.period] : '—'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ts)' }}>
                {p.target_role ? ROLE_LABEL[p.target_role] : '—'}
              </span>
              <button onClick={() => editPremium(p)} style={editBtn}>Изменить</button>
              <button onClick={() => removePremium(p.id)} style={delBtn}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* COMMISSIONS BLOCK */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700,
          }}>
            💰 Комиссии · {commissions.length}
          </div>
          <button className="btn btn-gold"
            onClick={() => { setCForm(EMPTY_COMMISSION); setShowCForm(s => !s); setError(null); }}>
            {showCForm ? '✕ Отмена' : '+ Новая комиссия'}
          </button>
        </div>

        {showCForm && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--gold)',
            borderRadius: 10, padding: 18,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
              textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
            }}>
              {cForm.id ? `Редактирование комиссии #${cForm.id}` : 'Новая комиссия'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Название" required>
                <input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Тип">
                <select value={cForm.commission_type}
                  onChange={e => setCForm(f => ({ ...f, commission_type: e.target.value as CommissionType }))}>
                  <option value="sales">Продажи</option>
                  <option value="service">Сервис</option>
                  <option value="returns">Возвраты</option>
                  <option value="logistics">Логистика</option>
                </select>
              </Field>
              <Field label="Процент %" required>
                <input type="number" step="0.1" min="0" max="100"
                  value={cForm.percent}
                  onChange={e => setCForm(f => ({ ...f, percent: e.target.value }))} />
              </Field>
              <Field label="Мин. сумма ₸">
                <input type="number" step="1000" min="0"
                  value={cForm.min_amount_kzt}
                  onChange={e => setCForm(f => ({ ...f, min_amount_kzt: e.target.value }))} />
              </Field>
              <Field label="Макс. сумма ₸ (cap)">
                <input type="number" step="1000" min="0"
                  value={cForm.max_amount_kzt} placeholder="без ограничения"
                  onChange={e => setCForm(f => ({ ...f, max_amount_kzt: e.target.value }))} />
              </Field>
              <Field label="Описание">
                <input value={cForm.description}
                  onChange={e => setCForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Активна">
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 5,
                }}>
                  <input type="checkbox" checked={cForm.is_active}
                    onChange={e => setCForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span style={{ fontSize: 12.5, color: 'var(--tp)' }}>
                    {cForm.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </label>
              </Field>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button className="btn btn-gold" onClick={submitCommission} disabled={submitting}>
                {submitting ? 'Сохранение…' : (cForm.id ? 'Сохранить' : 'Создать')}
              </button>
              <button className="btn btn-outline" onClick={() => { setShowCForm(false); setError(null); }}>
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
            display: 'grid', gridTemplateColumns: '60px 2.2fr 110px 80px 130px 130px 100px 60px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Статус</span>
            <span>Название</span>
            <span>Тип</span>
            <span style={{ textAlign: 'right' }}>%</span>
            <span style={{ textAlign: 'right' }}>Min ₸</span>
            <span style={{ textAlign: 'right' }}>Max ₸</span>
            <span></span>
            <span></span>
          </div>
          {commissions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
              Комиссий пока нет
            </div>
          ) : commissions.map(c => (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '60px 2.2fr 110px 80px 130px 130px 100px 60px',
              gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
              opacity: c.is_active ? 1 : 0.5,
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
                color: c.is_active ? 'var(--green)' : 'var(--tm)',
                border: '1px solid ' + (c.is_active ? 'var(--green)' : 'var(--tm)'),
                textAlign: 'center',
              }}>{c.is_active ? '✓' : '✕'}</span>
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>
                {c.name}
                {c.description && (
                  <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{c.description}</div>
                )}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: COMM_TYPE_COLOR[c.commission_type],
              }}>{COMM_TYPE_LABEL[c.commission_type]}</span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: 'var(--gold)', fontWeight: 600,
              }}>{c.percent}</span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                {c.min_amount_kzt > 0 ? fmtKzt(c.min_amount_kzt) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                {c.max_amount_kzt !== null ? fmtKzt(c.max_amount_kzt) : '∞'}
              </span>
              <button onClick={() => editCommission(c)} style={editBtn}>Изменить</button>
              <button onClick={() => removeCommission(c.id)} style={delBtn}>×</button>
            </div>
          ))}
        </div>
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
