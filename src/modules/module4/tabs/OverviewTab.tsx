import { useEffect, useState } from 'react';
import { api, BatchStatus, ImportSummary } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtUsd = (n: number) => Math.round(n).toLocaleString('en-US');

const STATUS_LABEL: Record<BatchStatus, string> = {
  draft:      'Черновик',
  in_transit: 'В пути',
  arrived:    'Прибыл',
  completed:  'Завершён',
  cancelled:  'Отменён',
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  draft:      'var(--tm)',
  in_transit: 'var(--gold)',
  arrived:    'var(--green)',
  completed:  'var(--blue, #5fa8ff)',
  cancelled:  'var(--red)',
};

export default function OverviewTab() {
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getImportSummary();
        if (!cancelled) setSummary(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!summary) return null;

  const t = summary.totals_completed;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Kpi label="Всего партий" value={String(summary.total_batches)} hint="вообще в системе" />
        <Kpi label="В пути" value={String(summary.in_transit.length)}
             color={summary.in_transit.length > 0 ? 'var(--gold)' : undefined}
             hint="ожидают прибытия" />
        <Kpi label="Завезено (USD)"
             value={`$${fmtUsd(t.total_cost_usd)}`}
             color="var(--gold)" hint="по завершённым партиям" />
        <Kpi label="Завезено (KZT)"
             value={`₸${fmtKzt(t.total_cost_kzt)}`}
             color="var(--gold)" hint="общая себестоимость" />
        <Kpi label="Средний курс"
             value={t.avg_exchange_rate ? t.avg_exchange_rate.toFixed(2) : '—'}
             hint="USD → KZT (взвешенный)" />
      </div>

      {/* Cost breakdown */}
      <Section title="Структура себестоимости (по завершённым)" >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <CostCell label="FOB" value={`$${fmtUsd(t.fob_usd)}`} pct={
            t.total_cost_usd > 0 ? Math.round(t.fob_usd / t.total_cost_usd * 100) : 0
          } color="var(--green)" />
          <CostCell label="Пошлина" value={`$${fmtUsd(t.customs_duty_usd)}`} pct={
            t.total_cost_usd > 0 ? Math.round(t.customs_duty_usd / t.total_cost_usd * 100) : 0
          } color="var(--gold)" />
          <CostCell label="НДС импорт" value={`$${fmtUsd(t.vat_import_usd)}`} pct={
            t.total_cost_usd > 0 ? Math.round(t.vat_import_usd / t.total_cost_usd * 100) : 0
          } color="var(--yellow)" />
          <CostCell label="Прочее (доставка)"
            value={`$${fmtUsd(Math.max(0, t.total_cost_usd - t.fob_usd - t.customs_duty_usd - t.vat_import_usd))}`}
            pct={
              t.total_cost_usd > 0
                ? Math.max(0, Math.round((t.total_cost_usd - t.fob_usd - t.customs_duty_usd - t.vat_import_usd) / t.total_cost_usd * 100))
                : 0
            }
            color="var(--tm)" />
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* By status */}
        <Section title="По статусам">
          {summary.by_status.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--tm)', fontSize: 13 }}>Партий пока нет</div>
          ) : summary.by_status.map(s => (
            <div key={s.status} style={{
              display: 'grid', gridTemplateColumns: '120px 60px 1fr 130px',
              gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)',
              alignItems: 'center', fontSize: 12.5,
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                color: STATUS_COLOR[s.status],
              }}>{STATUS_LABEL[s.status]}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', textAlign: 'right' }}>
                {s.count} шт.
              </span>
              <span></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--gold)', textAlign: 'right' }}>
                ₸{fmtKzt(s.total_cost_kzt)}
              </span>
            </div>
          ))}
        </Section>

        {/* Top suppliers */}
        <Section title="Топ-5 поставщиков">
          {summary.top_suppliers.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--tm)', fontSize: 13 }}>Поставщиков пока нет</div>
          ) : summary.top_suppliers.map(s => (
            <div key={s.supplier} style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 130px',
              gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)',
              alignItems: 'center', fontSize: 12.5,
            }}>
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{s.supplier}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', textAlign: 'right' }}>
                {s.count} шт.
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--gold)', textAlign: 'right' }}>
                ₸{fmtKzt(s.total_cost_kzt)}
              </span>
            </div>
          ))}
        </Section>
      </div>

      {/* In transit */}
      <Section title={`Сейчас в пути · ${summary.in_transit.length}`}>
        {summary.in_transit.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Партий в пути нет
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {summary.in_transit.map(b => {
              const eta = b.eta_date ? new Date(b.eta_date) : null;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const daysLeft = eta ? Math.round((eta.getTime() - today.getTime()) / 86400000) : null;
              return (
                <div key={b.id} style={{
                  display: 'grid', gridTemplateColumns: '120px 1.6fr 110px 100px 100px 110px',
                  gap: 8, padding: '10px 14px', alignItems: 'center', fontSize: 12.5,
                  background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 6,
                }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                    {b.batch_number}
                  </span>
                  <span style={{ color: 'var(--tp)' }}>
                    {b.supplier_name || '—'}
                    {b.tracking_number && (
                      <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                        · {b.tracking_number}
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                    ETA {b.eta_date || '—'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                    color: daysLeft === null ? 'var(--tm)' : daysLeft < 0 ? 'var(--red)' : daysLeft < 7 ? 'var(--yellow)' : 'var(--green)',
                  }}>
                    {daysLeft === null ? '—' : daysLeft < 0 ? `просрочка ${-daysLeft}д` : `через ${daysLeft}д`}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)', textAlign: 'right' }}>
                    {b.items_count} поз.
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                    color: 'var(--gold)', textAlign: 'right',
                  }}>${fmtUsd(b.total_cost_usd)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
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

function CostCell({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 6 }}>{value}</div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: 4 }}>
        {pct}% от себестоимости
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px', background: 'var(--bg-el)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.15em',
      }}>{title}</div>
      <div style={{ padding: 8 }}>{children}</div>
    </div>
  );
}
