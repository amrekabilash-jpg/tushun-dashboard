import { useEffect, useState } from 'react';
import { api, AgingResponse, ARSummaryRow } from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule3Store } from '../store';

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const BUCKET_LABEL: Record<string, string> = {
  current: 'В сроке',
  '0-30':  'Просрочка 0–30 дн.',
  '31-60': 'Просрочка 31–60 дн.',
  '61-90': 'Просрочка 61–90 дн.',
  '90+':   'Просрочка 90+ дн.',
};

const BUCKET_COLOR: Record<string, string> = {
  current: 'var(--green)',
  '0-30':  'var(--yellow)',
  '31-60': 'var(--gold)',
  '61-90': 'var(--red)',
  '90+':   '#a93226',
};

const BUCKET_BG: Record<string, string> = {
  current: 'rgba(52,211,153,.08)',
  '0-30':  'rgba(251,191,36,.10)',
  '31-60': 'rgba(212,175,55,.12)',
  '61-90': 'rgba(248,113,113,.10)',
  '90+':   'rgba(169,50,38,.15)',
};

export default function AgingTab() {
  const setRoute = useAppStore(s => s.setRoute);
  const setTab = useAppStore(s => s.setTab);
  const setSelectedInvoice = useModule3Store(s => s.setSelectedInvoice);

  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [summary, setSummary] = useState<{
    customers: ARSummaryRow[];
    total_outstanding_kzt: number;
    total_overdue_kzt: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, s] = await Promise.all([api.getArAging(), api.getArSummary()]);
        setAging(a);
        setSummary(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openInvoice = (id: number) => {
    setSelectedInvoice(id);
    setRoute(3);
    setTab(3, 'm3-detail');
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Расчёт дебиторки…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!aging || !summary) return null;

  const totalOutstanding = aging.total_outstanding_kzt;
  const totalOverdue = aging.total_overdue_kzt;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <KpiBig
          label="Всего к получению"
          value={`₸${fmt(totalOutstanding)}`}
          color="var(--gold)"
          hint="общая дебиторка"
        />
        <KpiBig
          label="Просрочено"
          value={`₸${fmt(totalOverdue)}`}
          color={totalOverdue > 0 ? 'var(--red)' : 'var(--green)'}
          hint={`${aging.overdue_count} счёт${aging.overdue_count === 1 ? '' : aging.overdue_count < 5 ? 'а' : 'ов'}`}
        />
        <KpiBig
          label="Доля просрочки"
          value={totalOutstanding > 0 ? `${Math.round(totalOverdue / totalOutstanding * 100)}%` : '0%'}
          color={
            totalOutstanding === 0 ? 'var(--tm)' :
            totalOverdue / totalOutstanding > 0.3 ? 'var(--red)' :
            totalOverdue / totalOutstanding > 0.1 ? 'var(--yellow)' :
            'var(--green)'
          }
          hint="overdue / outstanding"
        />
        <KpiBig
          label="Должников"
          value={String(summary.customers.filter(c => c.outstanding_kzt > 0).length)}
          color="var(--tp)"
          hint={`из ${summary.customers.length} клиентов с историей`}
        />
      </div>

      {/* Aging buckets visualization */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 18,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
        }}>
          Распределение по срокам
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {aging.aging.map(b => {
            const pct = totalOutstanding > 0 ? (b.amount_kzt / totalOutstanding * 100) : 0;
            return (
              <div key={b.bucket} style={{
                background: BUCKET_BG[b.bucket],
                border: '1px solid ' + BUCKET_COLOR[b.bucket],
                borderRadius: 8, padding: '14px 12px',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: BUCKET_COLOR[b.bucket],
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
                  fontWeight: 600,
                }}>{BUCKET_LABEL[b.bucket]}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 700,
                  color: 'var(--tp)', marginBottom: 6,
                }}>₸{fmt(b.amount_kzt)}</div>
                <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                  {b.count} счёт{b.count === 1 ? '' : b.count < 5 ? 'а' : 'ов'}
                  {pct > 0 && <> · {pct.toFixed(0)}%</>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Customer */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          Дебиторка по клиентам
        </div>
        {summary.customers.filter(c => c.outstanding_kzt > 0).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--green)', fontSize: 13 }}>
            ✓ Нет должников — все счета оплачены
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '2.5fr 90px 130px 130px 130px',
              gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
              fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Клиент</span>
              <span style={{ textAlign: 'right' }}>Открытых</span>
              <span style={{ textAlign: 'right' }}>Сумма ₸</span>
              <span style={{ textAlign: 'right' }}>Долг ₸</span>
              <span style={{ textAlign: 'right' }}>Просрочка ₸</span>
            </div>
            {summary.customers
              .filter(c => c.outstanding_kzt > 0)
              .map(c => (
                <div key={c.customer_id} style={{
                  display: 'grid', gridTemplateColumns: '2.5fr 90px 130px 130px 130px',
                  gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{c.customer_name}</span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                    {c.open_invoices}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                    {fmt(c.total_kzt)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                    color: c.outstanding_kzt > 0 ? 'var(--gold)' : 'var(--tm)',
                  }}>
                    {fmt(c.outstanding_kzt)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 700,
                    color: c.overdue_kzt > 0 ? 'var(--red)' : 'var(--tm)',
                  }}>
                    {c.overdue_kzt > 0 ? fmt(c.overdue_kzt) : '—'}
                  </span>
                </div>
            ))}
          </>
        )}
      </div>

      {/* Detailed invoices list */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          Открытые счета · {aging.rows.length}
        </div>
        {aging.rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--green)', fontSize: 13 }}>
            ✓ Открытых счетов нет
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1.6fr 100px 100px 80px 110px 110px 130px',
              gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
              fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>№ Счёта</span>
              <span>Клиент</span>
              <span>Выпуск</span>
              <span>Срок</span>
              <span style={{ textAlign: 'right' }}>Дней</span>
              <span style={{ textAlign: 'right' }}>Сумма ₸</span>
              <span style={{ textAlign: 'right' }}>К оплате ₸</span>
              <span>Корзина</span>
            </div>
            {aging.rows.map(r => (
              <div
                key={r.invoice_id}
                onClick={() => openInvoice(r.invoice_id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1.6fr 100px 100px 80px 110px 110px 130px',
                  gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                  borderBottom: '1px solid var(--border)',
                  background: BUCKET_BG[r.bucket],
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                  {r.invoice_number}
                </span>
                <span style={{ color: 'var(--tp)' }}>{r.customer_name}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                  {r.issue_date}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                  {r.due_date}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                  color: r.days_overdue > 0 ? 'var(--red)' : r.days_until_due < 7 ? 'var(--yellow)' : 'var(--green)',
                }}>
                  {r.days_overdue > 0 ? `+${r.days_overdue}` : r.days_until_due > 0 ? `−${r.days_until_due}` : '0'}
                </span>
                <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                  {fmt(r.total_kzt)}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 700, color: 'var(--gold)',
                }}>
                  {fmt(r.outstanding_kzt)}
                </span>
                <span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    color: BUCKET_COLOR[r.bucket],
                    border: '1px solid ' + BUCKET_COLOR[r.bucket],
                  }}>{BUCKET_LABEL[r.bucket]}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Дней: «+N» — просрочка на N дней; «−N» — N дней до срока. Клик → детали счёта.
      </div>
    </div>
  );
}

function KpiBig({ label, value, color, hint }: {
  label: string; value: string; color: string; hint?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: hint ? 6 : 0 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>}
    </div>
  );
}
