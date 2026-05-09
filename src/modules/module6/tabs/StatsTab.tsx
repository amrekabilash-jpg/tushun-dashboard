import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  api, ClaimsSummary, WarrantyByProductRow, WarrantyTimelineEvent,
} from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const TYPE_LABEL: Record<string, string> = {
  defect: 'Брак', damage: 'Повреждение',
  wrong_item: 'Не тот товар', other: 'Другое',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Открыты', in_review: 'На рассмотрении',
  resolved: 'Решены', rejected: 'Отклонены',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'var(--red)', in_review: 'var(--yellow)',
  resolved: 'var(--green)', rejected: 'var(--tm)',
};

const EVENT_COLOR: Record<string, string> = {
  claim_opened:    'var(--gold)',
  claim_resolved:  'var(--green)',
  claim_rejected:  'var(--red)',
  claim_in_review: 'var(--yellow)',
  return:          'var(--blue, #5fa8ff)',
};

const EVENT_LABEL: Record<string, string> = {
  claim_opened:    '📂 Открыта',
  claim_resolved:  '✓ Решена',
  claim_rejected:  '✕ Отклонена',
  claim_in_review: '⏳ На рассмотрении',
  return:          '💸 Возврат',
};

export default function StatsTab() {
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [byProduct, setByProduct] = useState<WarrantyByProductRow[]>([]);
  const [timeline, setTimeline] = useState<WarrantyTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, bp, tl] = await Promise.all([
          api.getClaimsSummary(),
          api.getWarrantyByProduct(),
          api.getWarrantyTimeline(20),
        ]);
        if (cancelled) return;
        setSummary(s);
        setByProduct(bp);
        setTimeline(tl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка статистики…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!summary) return null;

  const chartData = byProduct
    .filter(p => p.claims_count > 0)
    .map(p => ({
      name: p.product_name.replace('Фильтр ', 'Фильтр ').slice(0, 18),
      defect: p.defect_rate_percent,
      claims: p.claims_count,
    }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Всего рекламаций" value={String(summary.total_claims)} hint="за всё время" />
        <Kpi label="Открытых"
          value={String(summary.by_status.open + summary.by_status.in_review)}
          color={summary.by_status.open + summary.by_status.in_review > 0 ? 'var(--red)' : 'var(--green)'}
          hint={`open: ${summary.by_status.open} · in_review: ${summary.by_status.in_review}`}
        />
        <Kpi label="Решённых" value={String(summary.by_status.resolved)} color="var(--green)" hint="закрыты успешно" />
        <Kpi label="Просрочено > 14 дн." value={String(summary.overdue_open_count)}
          color={summary.overdue_open_count > 0 ? 'var(--red)' : 'var(--green)'}
          hint="не разрешены вовремя" />
        <Kpi label="Среднее время разрешения"
          value={summary.avg_resolution_days !== null ? `${summary.avg_resolution_days} дн.` : '—'}
          color="var(--gold)" hint="от создания до закрытия" />
        <Kpi label="% возвратов от продаж" value={`${summary.return_rate_percent}%`}
          color={summary.return_rate_percent > 5 ? 'var(--red)' :
                 summary.return_rate_percent > 2 ? 'var(--yellow)' : 'var(--green)'}
          hint="claim_qty / sold_qty" />
        <Kpi label="Всего возвратов" value={String(summary.returns_count)} hint="зарегистрировано" />
        <Kpi label="Сумма возмещений"
          value={`₸${fmtKzt(summary.refund_total_kzt)}`}
          color="var(--gold)" hint="всего выплачено клиентам" />
      </div>

      {/* By status / by type */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Section title="По статусам">
          {(['open', 'in_review', 'resolved', 'rejected'] as const).map(s => {
            const count = summary.by_status[s];
            const total = summary.total_claims || 1;
            const pct = Math.round(count / total * 100);
            return (
              <div key={s} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 4,
                  fontSize: 12, color: 'var(--ts)',
                }}>
                  <span style={{ color: STATUS_COLOR[s], fontWeight: 600 }}>
                    {STATUS_LABEL[s]}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
                    {count} ({pct}%)
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[s] }} />
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="По типам">
          {(['defect', 'damage', 'wrong_item', 'other'] as const).map(t => {
            const count = summary.by_type[t];
            const total = summary.total_claims || 1;
            const pct = Math.round(count / total * 100);
            return (
              <div key={t} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 4,
                  fontSize: 12, color: 'var(--ts)',
                }}>
                  <span style={{ color: 'var(--tp)', fontWeight: 600 }}>
                    {TYPE_LABEL[t]}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
                    {count} ({pct}%)
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
                </div>
              </div>
            );
          })}
        </Section>
      </div>

      {/* Defect rate by product chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 16,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
        }}>
          Процент дефектов по товарам
        </div>
        {chartData.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Нет данных для графика
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="var(--tm)"
                tick={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
              <YAxis stroke="var(--tm)" tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
                label={{ value: '%', position: 'insideLeft', style: { fill: 'var(--tm)', fontSize: 10 } }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 6 }}
                labelStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}
                itemStyle={{ fontFamily: 'var(--mono)', fontSize: 11 }}
              />
              <Bar dataKey="defect" name="% дефектов" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i}
                    fill={d.defect > 5 ? '#ef4444' : d.defect > 2 ? '#fbbf24' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By product table */}
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
          Детально по товарам
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 90px 90px 110px 110px 90px 110px 110px',
          gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
          fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Товар</span>
          <span style={{ textAlign: 'right' }}>Рекл.</span>
          <span style={{ textAlign: 'right' }}>Кол-во</span>
          <span style={{ textAlign: 'right' }}>Продано</span>
          <span style={{ textAlign: 'right' }}>% дефектов</span>
          <span style={{ textAlign: 'right' }}>Открытых</span>
          <span style={{ textAlign: 'right' }}>Avg дни</span>
          <span style={{ textAlign: 'right' }}>Возвраты ₸</span>
        </div>
        {byProduct.map(p => (
          <div key={p.product_id} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 90px 90px 110px 110px 90px 110px 110px',
            gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
            background: p.defect_rate_percent > 5 ? 'rgba(248,113,113,.06)' :
                        p.defect_rate_percent > 2 ? 'rgba(251,191,36,.05)' : 'transparent',
          }}>
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{p.product_name}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {p.claims_count}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {p.claim_qty}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {p.sold_qty}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 700,
              color: p.defect_rate_percent > 5 ? 'var(--red)' :
                     p.defect_rate_percent > 2 ? 'var(--yellow)' : 'var(--green)',
            }}>
              {p.defect_rate_percent}%
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
              color: p.open_claims > 0 ? 'var(--red)' : 'var(--tm)',
            }}>
              {p.open_claims > 0 ? p.open_claims : '—'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {p.avg_resolution_days !== null ? `${p.avg_resolution_days} д.` : '—'}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right',
              color: p.refund_total_kzt > 0 ? 'var(--gold)' : 'var(--tm)', fontWeight: 600,
            }}>
              {p.refund_total_kzt > 0 ? fmtKzt(p.refund_total_kzt) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline */}
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
          Хронология событий · {timeline.length}
        </div>
        {timeline.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Событий не найдено
          </div>
        ) : (
          <div>
            {timeline.map((ev, i) => (
              <div key={`${ev.event_type}-${ev.claim_id}-${i}`} style={{
                display: 'grid', gridTemplateColumns: '110px 130px 110px 1.2fr 1.5fr',
                gap: 8, padding: '10px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>{ev.date}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: EVENT_COLOR[ev.event_type] || 'var(--tp)',
                }}>{EVENT_LABEL[ev.event_type] || ev.event_type}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600 }}>
                  {ev.claim_number || '—'}
                </span>
                <span style={{ color: 'var(--tp)' }}>
                  {ev.product_name} <span style={{ color: 'var(--tm)' }}>· {ev.customer_name}</span>
                </span>
                <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                  {ev.description}
                  {ev.amount_kzt !== undefined && (
                    <span style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', marginLeft: 6 }}>
                      ₸{fmtKzt(ev.amount_kzt)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--tp)', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
      }}>{title}</div>
      {children}
    </div>
  );
}
