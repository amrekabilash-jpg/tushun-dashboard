import { useEffect, useMemo, useState } from 'react';
import {
  api, ClaimStatus, ClaimType, Customer, Product, RefundMethod,
  WarrantyClaim, WarrantyClaimDetail,
} from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const STATUS_LABEL: Record<ClaimStatus, string> = {
  open: 'Открыта', in_review: 'На рассмотрении',
  resolved: 'Решена', rejected: 'Отклонена',
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  open: 'var(--red)', in_review: 'var(--yellow)',
  resolved: 'var(--green)', rejected: 'var(--tm)',
};

const STATUS_BG: Record<ClaimStatus, string> = {
  open:      'rgba(248,113,113,.06)',
  in_review: 'rgba(251,191,36,.08)',
  resolved:  'rgba(52,211,153,.06)',
  rejected:  'rgba(150,150,150,.04)',
};

const TYPE_LABEL: Record<ClaimType, string> = {
  defect: 'Брак', damage: 'Повреждение',
  wrong_item: 'Не тот товар', other: 'Другое',
};

const REFUND_LABEL: Record<RefundMethod, string> = {
  cash: 'Наличные', bank: 'Банк', exchange: 'Обмен', credit: 'Кредит',
};

const NEXT_STATUSES: Record<ClaimStatus, ClaimStatus[]> = {
  open:      ['in_review', 'resolved', 'rejected'],
  in_review: ['resolved', 'rejected', 'open'],
  resolved:  ['in_review'],
  rejected:  ['in_review', 'open'],
};

export default function ClaimsTab() {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ClaimStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ClaimType>('all');
  const [search, setSearch] = useState('');

  // New claim form
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState<number | ''>('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('1');
  const [claimType, setClaimType] = useState<ClaimType>('defect');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WarrantyClaimDetail | null>(null);
  const [resolution, setResolution] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnQty, setReturnQty] = useState('1');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnMethod, setReturnMethod] = useState<RefundMethod>('bank');
  const [returnReason, setReturnReason] = useState('');

  const refresh = async () => {
    try {
      const params: Parameters<typeof api.listClaims>[0] = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.claim_type = typeFilter;
      const data = await api.listClaims(params);
      setClaims(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([api.listProducts(), api.listCustomers()]);
        setProducts(p);
        setCustomers(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter, typeFilter]);

  const refreshDetail = async (id: number) => {
    try {
      const d = await api.getClaim(id);
      setDetail(d);
      setResolution(d.resolution || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  useEffect(() => {
    if (detailId) refreshDetail(detailId);
    else { setDetail(null); setShowReturnForm(false); }
  }, [detailId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return claims;
    const q = search.toLowerCase();
    return claims.filter(c =>
      c.claim_number.toLowerCase().includes(q) ||
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.product_name || '').toLowerCase().includes(q),
    );
  }, [claims, search]);

  const submitNew = async () => {
    if (!productId) {
      setError('Выбери товар');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createClaim({
        product_id: productId as number,
        customer_id: customerId === '' ? undefined : customerId,
        quantity: parseInt(quantity) || 1,
        claim_type: claimType,
        description: description || undefined,
        status: 'open',
      });
      setShowForm(false);
      setProductId(''); setCustomerId(''); setQuantity('1');
      setClaimType('defect'); setDescription('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (id: number, newStatus: ClaimStatus) => {
    try {
      await api.updateClaimStatus(id, {
        status: newStatus,
        resolution: resolution || undefined,
      });
      if (detailId === id) await refreshDetail(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const submitReturn = async () => {
    if (!detail) return;
    const amt = parseFloat(returnAmount) || 0;
    setSubmitting(true);
    setError(null);
    try {
      await api.createReturn({
        claim_id: detail.id,
        quantity: parseInt(returnQty) || 1,
        refund_amount_kzt: amt,
        refund_method: returnMethod,
        reason: returnReason || undefined,
        status: 'pending',
      });
      setShowReturnForm(false);
      setReturnAmount(''); setReturnReason(''); setReturnQty('1');
      await refreshDetail(detail.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка рекламаций…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input type="text" placeholder="Поиск по №, клиенту, товару…"
          value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 240 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="all">Все статусы</option>
          <option value="open">Открыты</option>
          <option value="in_review">На рассмотрении</option>
          <option value="resolved">Решены</option>
          <option value="rejected">Отклонены</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={selectStyle}>
          <option value="all">Все типы</option>
          <option value="defect">Брак</option>
          <option value="damage">Повреждение</option>
          <option value="wrong_item">Не тот товар</option>
          <option value="other">Другое</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Показано: {filtered.length}
        </span>
        <button className="btn btn-gold" onClick={() => { setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Новая рекламация'}
        </button>
      </div>

      {/* New form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Новая рекламация
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Товар" required>
              <select value={productId}
                onChange={e => setProductId(parseInt(e.target.value) || '')}>
                <option value="">— выбрать —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Клиент">
              <select value={customerId}
                onChange={e => setCustomerId(parseInt(e.target.value) || '')}>
                <option value="">— не указан —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Количество">
              <input type="number" min="1" value={quantity}
                onChange={e => setQuantity(e.target.value)} />
            </Field>
            <Field label="Тип">
              <select value={claimType} onChange={e => setClaimType(e.target.value as ClaimType)}>
                <option value="defect">Брак</option>
                <option value="damage">Повреждение</option>
                <option value="wrong_item">Не тот товар</option>
                <option value="other">Другое</option>
              </select>
            </Field>
            <Field label="Описание">
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Обстоятельства рекламации" />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submitNew} disabled={submitting}>
              {submitting ? 'Создание…' : 'Создать'}
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
          Рекламаций не найдено
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1.4fr 1.6fr 100px 90px 110px 130px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>№ Рекл.</span>
            <span>Клиент</span>
            <span>Товар</span>
            <span>Тип</span>
            <span>Дата</span>
            <span>Решено за</span>
            <span>Статус</span>
          </div>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => setDetailId(c.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1.4fr 1.6fr 100px 90px 110px 130px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
                background: STATUS_BG[c.status],
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                {c.claim_number}
              </span>
              <span style={{ color: 'var(--tp)' }}>{c.customer_name || '—'}</span>
              <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                {c.product_name} <span style={{ color: 'var(--tm)' }}>× {c.quantity}</span>
                {c.description && (
                  <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 2 }}>
                    {c.description.length > 60 ? c.description.slice(0, 60) + '…' : c.description}
                  </div>
                )}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: c.claim_type === 'defect' ? 'var(--red)'
                  : c.claim_type === 'damage' ? 'var(--yellow)'
                  : c.claim_type === 'wrong_item' ? 'var(--gold)' : 'var(--tm)',
              }}>{TYPE_LABEL[c.claim_type]}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                {c.claim_date}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: c.resolution_days === null ? 'var(--tm)'
                  : c.resolution_days <= 3 ? 'var(--green)'
                  : c.resolution_days <= 7 ? 'var(--yellow)' : 'var(--red)',
              }}>
                {c.resolution_days !== null ? `${c.resolution_days} дн.` : '—'}
              </span>
              <span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  color: STATUS_COLOR[c.status],
                  border: '1px solid ' + STATUS_COLOR[c.status],
                }}>{STATUS_LABEL[c.status]}</span>
                {c.returns_count > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--mono)',
                  }}>· возвр. {c.returns_count}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailId && detail && (
        <div
          onClick={() => setDetailId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
            zIndex: 100, display: 'flex', justifyContent: 'center',
            alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-deep)', border: '1px solid var(--border-l)',
              borderRadius: 12, padding: 24, maxWidth: 920, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4,
                }}>
                  Рекламация #{detail.id}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>
                  {detail.claim_number}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ts)', marginTop: 6 }}>
                  {detail.customer_name} · {detail.product_name} × {detail.quantity}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  padding: '5px 12px', borderRadius: 5,
                  color: STATUS_COLOR[detail.status],
                  border: '1px solid ' + STATUS_COLOR[detail.status],
                }}>{STATUS_LABEL[detail.status]}</span>
                <button onClick={() => setDetailId(null)} className="btn btn-outline" style={{ fontSize: 11 }}>
                  ✕ Закрыть
                </button>
              </div>
            </div>

            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              <KpiCell label="Тип" value={TYPE_LABEL[detail.claim_type]} />
              <KpiCell label="Открыта" value={detail.claim_date || '—'} mono />
              <KpiCell label="Решена" value={detail.resolved_date || '—'} mono
                color={detail.resolved_date ? 'var(--green)' : undefined} />
              <KpiCell label="Срок"
                value={detail.resolution_days !== null ? `${detail.resolution_days} дн.` : '—'} />
            </div>

            {detail.description && (
              <div style={{
                padding: '10px 14px', background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 6, marginBottom: 14,
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
                }}>Описание</div>
                <div style={{ fontSize: 13, color: 'var(--tp)' }}>{detail.description}</div>
              </div>
            )}

            {/* Resolution */}
            <div style={{
              padding: '12px 14px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 6, marginBottom: 14,
            }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
              }}>Решение / резолюция</div>
              <textarea value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="Опиши решение перед закрытием рекламации"
                style={{
                  width: '100%', minHeight: 60,
                  background: 'var(--bg-el)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: 10, color: 'var(--tp)',
                  fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                }} />
            </div>

            {/* Status transitions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {NEXT_STATUSES[detail.status].map(s => (
                <button key={s} onClick={() => changeStatus(detail.id, s)}
                  className="btn btn-outline"
                  style={{
                    fontSize: 12, color: STATUS_COLOR[s], borderColor: STATUS_COLOR[s],
                  }}>
                  → {STATUS_LABEL[s]}
                </button>
              ))}
              {detail.status !== 'rejected' && (
                <button onClick={() => setShowReturnForm(s => !s)} className="btn btn-gold" style={{ marginLeft: 'auto' }}>
                  {showReturnForm ? '✕ Отмена' : '+ Зарегистрировать возврат'}
                </button>
              )}
            </div>

            {/* Return form */}
            {showReturnForm && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--gold)',
                borderRadius: 8, padding: 14, marginBottom: 14,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <Field label="Кол-во">
                    <input type="number" min="1" value={returnQty}
                      onChange={e => setReturnQty(e.target.value)} />
                  </Field>
                  <Field label="Сумма ₸">
                    <input type="number" min="0" step="100" value={returnAmount}
                      onChange={e => setReturnAmount(e.target.value)} />
                  </Field>
                  <Field label="Метод">
                    <select value={returnMethod} onChange={e => setReturnMethod(e.target.value as RefundMethod)}>
                      <option value="bank">Банк</option>
                      <option value="cash">Наличные</option>
                      <option value="exchange">Обмен</option>
                      <option value="credit">Кредит</option>
                    </select>
                  </Field>
                  <Field label="Причина">
                    <input value={returnReason} onChange={e => setReturnReason(e.target.value)} />
                  </Field>
                </div>
                <button className="btn btn-gold" onClick={submitReturn} disabled={submitting}
                  style={{ marginTop: 10 }}>
                  {submitting ? 'Сохранение…' : 'Зарегистрировать'}
                </button>
              </div>
            )}

            {/* Returns list */}
            {detail.returns.length > 0 && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 6, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px', background: 'var(--bg-el)',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                }}>
                  Возвраты по рекламации · {detail.returns.length}
                </div>
                {detail.returns.map(r => (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '110px 70px 110px 100px 1fr 100px',
                    gap: 8, padding: '10px 14px', fontSize: 12, alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{r.return_date}</span>
                    <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
                      × {r.quantity}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                      {REFUND_LABEL[r.refund_method]}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 600, textAlign: 'right' }}>
                      ₸{fmtKzt(r.refund_amount_kzt)}
                    </span>
                    <span style={{ color: 'var(--ts)', fontSize: 11 }}>{r.reason || '—'}</span>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 4, textAlign: 'center',
                      color: r.status === 'refunded' ? 'var(--green)' :
                             r.status === 'pending' ? 'var(--yellow)' :
                             r.status === 'approved' ? 'var(--gold)' : 'var(--red)',
                      border: '1px solid currentColor',
                    }}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'inherit',
};
const selectStyle: React.CSSProperties = { ...inputStyle };

function KpiCell({ label, value, mono, color }: {
  label: string; value: string; mono?: boolean; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '10px 12px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        fontSize: 14, fontWeight: 600, color: color || 'var(--tp)',
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
