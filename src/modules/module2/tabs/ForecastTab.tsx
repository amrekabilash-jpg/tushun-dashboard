import { useEffect, useState } from 'react';
import { api, ForecastRow } from '../../../utils/api';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const URGENCY_LABEL: Record<ForecastRow['urgency'], string> = {
  critical: 'Срочно',
  high:     'Высокая',
  medium:   'Средняя',
  low:      'Низкая',
  none:     '—',
};

const URGENCY_COLOR: Record<ForecastRow['urgency'], string> = {
  critical: 'var(--red)',
  high:     'var(--yellow)',
  medium:   'var(--gold)',
  low:      'var(--green)',
  none:     'var(--tm)',
};

const URGENCY_BG: Record<ForecastRow['urgency'], string> = {
  critical: 'rgba(248,113,113,.10)',
  high:     'rgba(251,191,36,.10)',
  medium:   'rgba(212,175,55,.08)',
  low:      'rgba(52,211,153,.08)',
  none:     'transparent',
};

const CATEGORY_LABELS: Record<string, string> = {
  oil_filter:    'Фильтр масляный',
  air_filter:    'Фильтр воздушный',
  fuel_filter:   'Фильтр топливный',
  cabin_filter:  'Фильтр салонный',
  rubber_hose:   'Патрубок резиновый',
  silicone_hose: 'Патрубок силиконовый',
};

export default function ForecastTab() {
  const [items, setItems] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookback, setLookback] = useState(30);
  const [target, setTarget] = useState(60);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.getStockForecast(lookback, target);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [lookback, target]);

  if (loading && items.length === 0)
    return <div style={{ padding: 24, color: 'var(--ts)' }}>Расчёт прогноза…</div>;
  if (error)
    return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;

  const critical = items.filter(i => i.urgency === 'critical').length;
  const high     = items.filter(i => i.urgency === 'high').length;
  const totalRecommendedQty = items.reduce((acc, i) => acc + i.recommended_qty, 0);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Settings */}
      <div style={{
        display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
        padding: '12px 16px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ts)' }}>
          Анализ за дней:
          <input
            type="number" min="7" max="180" step="1"
            value={lookback}
            onChange={e => setLookback(Math.max(7, parseInt(e.target.value) || 30))}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ts)' }}>
          Запас на дней:
          <input
            type="number" min="14" max="365" step="1"
            value={target}
            onChange={e => setTarget(Math.max(14, parseInt(e.target.value) || 60))}
            style={inputStyle}
          />
        </label>
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
        }}>
          Берём продажи за {lookback} дн. → запас на {target} дн.
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <SummaryCard label="Срочно к закупке" value={fmt(critical)} color="var(--red)" hint="< 7 дней до 0" />
        <SummaryCard label="Высокий приоритет" value={fmt(high)} color="var(--yellow)" hint="7–30 дней до 0" />
        <SummaryCard
          label="Рекомендация (всего ед.)"
          value={fmt(totalRecommendedQty)}
          color="var(--gold)"
          hint={`до запаса в ${target} дней`}
        />
        <SummaryCard label="Всего SKU в анализе" value={fmt(items.length)} color="var(--tp)" hint="наименований" />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Нет товаров для анализа
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 90px 90px 100px 100px 110px 100px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Товар</span>
            <span>Категория</span>
            <span style={{ textAlign: 'right' }}>Остаток</span>
            <span style={{ textAlign: 'right' }}>Продано</span>
            <span style={{ textAlign: 'right' }}>В день</span>
            <span style={{ textAlign: 'right' }}>Дней хватит</span>
            <span style={{ textAlign: 'right' }}>Закупить</span>
            <span style={{ textAlign: 'right' }}>Срочность</span>
          </div>
          {items.map(r => (
            <div
              key={r.product_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 90px 90px 100px 100px 110px 100px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
                background: URGENCY_BG[r.urgency],
              }}
            >
              <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{r.product_name}</span>
              <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                {CATEGORY_LABELS[r.category] || r.category}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: r.current_qty === 0 ? 'var(--red)' : 'var(--tp)',
                fontWeight: r.current_qty === 0 ? 700 : 500,
              }}>
                {fmt(r.current_qty)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                {fmt(r.sold_last_period)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
                {r.avg_daily_sales.toFixed(1)}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
                color: r.days_left === null
                  ? 'var(--tm)'
                  : r.days_left < 7 ? 'var(--red)'
                  : r.days_left < 30 ? 'var(--yellow)'
                  : 'var(--green)',
              }}>
                {r.days_left === null ? '∞' : r.days_left}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 700,
                color: r.recommended_qty > 0 ? 'var(--gold)' : 'var(--tm)',
              }}>
                {r.recommended_qty > 0 ? `+${fmt(r.recommended_qty)}` : '—'}
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-flex', padding: '2px 8px', borderRadius: 4,
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: URGENCY_COLOR[r.urgency],
                  background: URGENCY_BG[r.urgency],
                  border: '1px solid ' + URGENCY_COLOR[r.urgency],
                }}>
                  {URGENCY_LABEL[r.urgency]}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', lineHeight: 1.6,
      }}>
        Алгоритм: средний расход за {lookback} дней × {target} дней − текущий остаток = рекомендация к закупке.<br />
        Срочность: критическая (&lt;7 дн. до 0), высокая (7–30 дн.), средняя (30–60 дн.), низкая (&gt;60 дн.).
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '6px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'var(--mono)', width: 70,
};

function SummaryCard({ label, value, color, hint }: {
  label: string; value: string; color: string; hint: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>
    </div>
  );
}
