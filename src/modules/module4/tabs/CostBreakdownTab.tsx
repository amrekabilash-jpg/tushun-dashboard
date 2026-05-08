import { useEffect, useState } from 'react';
import { api, BatchStatus, CostByProductRow } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtUsd = (n: number) => Math.round(n).toLocaleString('en-US');

const CATEGORY_LABELS: Record<string, string> = {
  oil_filter:    'Фильтр масляный',
  air_filter:    'Фильтр воздушный',
  fuel_filter:   'Фильтр топливный',
  cabin_filter:  'Фильтр салонный',
  rubber_hose:   'Патрубок резиновый',
  silicone_hose: 'Патрубок силиконовый',
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'draft', in_transit: 'in_transit', arrived: 'arrived',
  completed: 'completed', cancelled: 'cancelled',
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  draft: 'var(--tm)', in_transit: 'var(--gold)', arrived: 'var(--green)',
  completed: 'var(--blue, #5fa8ff)', cancelled: 'var(--red)',
};

export default function CostBreakdownTab() {
  const [rows, setRows] = useState<CostByProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getCostByProduct();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: number) => {
    setExpanded(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;

  const withBatches = rows.filter(r => r.batches_count > 0);
  const grandTotal = rows.reduce((acc, r) => acc + r.total_cost_kzt, 0);
  const totalQty = rows.reduce((acc, r) => acc + r.total_quantity, 0);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Card label="SKU с историей" value={`${withBatches.length} / ${rows.length}`} hint="завозились хотя бы раз" />
        <Card label="Всего ввезено ед." value={fmtKzt(totalQty)} color="var(--gold)" hint="по всем партиям" />
        <Card label="Сумма закупок" value={`₸${fmtKzt(grandTotal)}`} color="var(--gold)" hint="общая себестоимость в KZT" />
      </div>

      {/* Table */}
      {withBatches.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Партий ещё не было. Создай партию во вкладке «Партии», смени статус на «Прибыл», и здесь появится разбивка.
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 2fr 1.2fr 90px 90px 110px 110px 110px 110px 110px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span></span>
            <span>Товар</span>
            <span>Категория</span>
            <span style={{ textAlign: 'right' }}>Партий</span>
            <span style={{ textAlign: 'right' }}>Кол-во</span>
            <span style={{ textAlign: 'right' }}>Avg ₸/шт</span>
            <span style={{ textAlign: 'right' }}>Last ₸/шт</span>
            <span style={{ textAlign: 'right' }}>FOB $</span>
            <span style={{ textAlign: 'right' }}>Пошлина $</span>
            <span style={{ textAlign: 'right' }}>Итого ₸</span>
          </div>
          {withBatches.map(r => {
            const isOpen = expanded.has(r.product_id);
            const trend =
              r.history.length >= 2
                ? r.history[0].unit_cost_kzt - r.history[1].unit_cost_kzt
                : 0;
            return (
              <div key={r.product_id}>
                <div
                  onClick={() => toggle(r.product_id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 2fr 1.2fr 90px 90px 110px 110px 110px 110px 110px',
                    gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: isOpen ? 'rgba(212,175,55,.04)' : 'transparent',
                  }}
                >
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--tm)', fontSize: 14 }}>
                    {isOpen ? '−' : '+'}
                  </span>
                  <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{r.product_name}</span>
                  <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                    {CATEGORY_LABELS[r.category] || r.category}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                    {r.batches_count}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
                    {fmtKzt(r.total_quantity)}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)', fontWeight: 600 }}>
                    {fmtKzt(r.avg_unit_cost_kzt)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                    color: trend > 0 ? 'var(--red)' : trend < 0 ? 'var(--green)' : 'var(--tp)',
                  }}>
                    {r.last_unit_cost_kzt !== null ? fmtKzt(r.last_unit_cost_kzt) : '—'}
                    {trend !== 0 && (
                      <span style={{ fontSize: 10, marginLeft: 4 }}>
                        {trend > 0 ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                    {fmtUsd(r.total_fob_usd)}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                    {fmtUsd(r.total_customs_usd)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 700, color: 'var(--gold)',
                  }}>
                    {fmtKzt(r.total_cost_kzt)}
                  </span>
                </div>

                {/* History */}
                {isOpen && (
                  <div style={{
                    background: 'var(--bg-deep)',
                    padding: '8px 16px 16px 56px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
                      textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: 8, marginTop: 4,
                    }}>
                      История партий ({r.history.length})
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 110px 90px 90px 110px 110px 100px 100px 100px',
                        gap: 8, padding: '6px 12px',
                        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
                        textTransform: 'uppercase',
                      }}>
                        <span>№ Партии</span>
                        <span>Дата</span>
                        <span>Статус</span>
                        <span style={{ textAlign: 'right' }}>Кол-во</span>
                        <span style={{ textAlign: 'right' }}>$/шт</span>
                        <span style={{ textAlign: 'right' }}>₸/шт</span>
                        <span style={{ textAlign: 'right' }}>FOB $</span>
                        <span style={{ textAlign: 'right' }}>Пошлина</span>
                        <span style={{ textAlign: 'right' }}>НДС</span>
                      </div>
                      {r.history.map(h => (
                        <div key={h.batch_id} style={{
                          display: 'grid',
                          gridTemplateColumns: '120px 110px 90px 90px 110px 110px 100px 100px 100px',
                          gap: 8, padding: '5px 12px',
                          background: 'var(--bg-el)', borderRadius: 4,
                          fontSize: 11.5, alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600 }}>
                            {h.batch_number}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>
                            {h.import_date || '—'}
                          </span>
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                            color: STATUS_COLOR[h.status],
                          }}>{STATUS_LABEL[h.status]}</span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
                            {h.quantity}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                            {h.unit_cost_usd.toFixed(2)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)', fontWeight: 600 }}>
                            {fmtKzt(h.unit_cost_kzt)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
                            {fmtUsd(h.fob_usd)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
                            {fmtUsd(h.customs_duty_usd)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
                            {fmtUsd(h.vat_import_usd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Without batches */}
      {rows.filter(r => r.batches_count === 0).length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--tm)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 6,
          }}>
            Без истории партий ({rows.filter(r => r.batches_count === 0).length})
          </div>
          <div style={{ fontSize: 12, color: 'var(--ts)' }}>
            {rows.filter(r => r.batches_count === 0).map(r => r.product_name).join(', ')}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
        Клик по строке → разворачивается история партий с разбивкой FOB / пошлина / НДС / себестоимость по каждой.
        Стрелки ↑/↓ показывают тренд цены: вверх — дороже, вниз — дешевле.
      </div>
    </div>
  );
}

function Card({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
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
