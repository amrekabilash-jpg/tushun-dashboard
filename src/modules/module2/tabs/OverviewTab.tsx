import { useEffect, useState } from 'react';
import { api, StockSummary, StockMovement } from '../../../utils/api';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const MTYPE_LABEL: Record<string, string> = {
  in:            'Приход',
  out:           'Расход',
  transfer_in:   'Перемещение ←',
  transfer_out:  'Перемещение →',
  adjustment:    'Корректировка',
};

const MTYPE_COLOR: Record<string, string> = {
  in:           'var(--green)',
  out:          'var(--red)',
  transfer_in:  'var(--gold)',
  transfer_out: 'var(--gold)',
  adjustment:   'var(--tm)',
};

export default function OverviewTab() {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [recent, setRecent] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, m] = await Promise.all([
          api.getStockSummary(),
          api.listStockMovements({ limit: 10 }),
        ]);
        if (cancelled) return;
        setSummary(s);
        setRecent(m.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!summary) return null;

  const totalQty = summary.stock_by_warehouse.reduce((acc, w) => acc + w.total_qty, 0);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <KpiCard label="Всего SKU" value={fmt(summary.total_products)} hint="наименований в справочнике" />
        <KpiCard label="Складов активно" value={fmt(summary.total_warehouses)} hint="точек хранения" />
        <KpiCard label="Общий остаток" value={fmt(totalQty)} hint="ед. на всех складах" accent />
        <KpiCard
          label="Низкий остаток"
          value={fmt(summary.low_stock_count)}
          hint="позиций требуют внимания"
          color={summary.low_stock_count > 0 ? 'var(--yellow)' : undefined}
        />
        <KpiCard
          label="Нет в наличии"
          value={fmt(summary.zero_stock_count)}
          hint="позиций со складом 0"
          color={summary.zero_stock_count > 0 ? 'var(--red)' : undefined}
        />
        <KpiCard label="Движений за 7 дней" value={fmt(summary.recent_movements_count)} hint="приход / расход / перемещение" />
      </div>

      {/* Склады */}
      <Section title="Остатки по складам">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {summary.stock_by_warehouse.map(w => (
            <div key={w.warehouse_id} style={{
              background: 'var(--bg-el)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', letterSpacing: '0.1em' }}>
                  [{w.warehouse_code}]
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tp)' }}>
                  {w.warehouse_name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Всего ед.
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
                    {fmt(w.total_qty)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 4 }}>
                    SKU
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tp)' }}>
                    {fmt(w.sku_count)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Последние движения */}
      <Section title="Последние движения" subtitle={`показано: ${recent.length}`}>
        {recent.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Пока нет движений по складу
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(m => (
              <div key={m.id} style={{
                display: 'grid', gridTemplateColumns: '90px 130px 1fr 120px 80px',
                gap: 12, alignItems: 'center', padding: '10px 14px',
                background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 6,
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
                  {m.movement_date}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: MTYPE_COLOR[m.movement_type] || 'var(--tp)' }}>
                  {MTYPE_LABEL[m.movement_type] || m.movement_type}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--tp)' }}>{m.product_name}</span>
                <span style={{ fontSize: 11, color: 'var(--ts)' }}>{m.warehouse_name}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, textAlign: 'right',
                  color: m.quantity > 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function KpiCard({ label, value, hint, accent, color }: {
  label: string; value: string; hint: string; accent?: boolean; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: color || (accent ? 'var(--gold)' : 'var(--tp)'),
        lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}
