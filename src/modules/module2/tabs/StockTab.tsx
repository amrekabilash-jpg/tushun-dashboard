import { useEffect, useMemo, useState } from 'react';
import { api, StockRow, Warehouse } from '../../../utils/api';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const STATUS_LABEL = { ok: 'В наличии', low: 'Мало', zero: 'Нет' };
const STATUS_CLASS = { ok: 'stock-ok', low: 'stock-low', zero: 'stock-zero' };

const CATEGORY_LABELS: Record<string, string> = {
  oil_filter:    'Фильтр масляный',
  air_filter:    'Фильтр воздушный',
  fuel_filter:   'Фильтр топливный',
  cabin_filter:  'Фильтр салонный',
  rubber_hose:   'Патрубок резиновый',
  silicone_hose: 'Патрубок силиконовый',
};

export default function StockTab() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'zero'>('all');
  const [search, setSearch] = useState('');
  const [lowThreshold, setLowThreshold] = useState(10);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([
        api.listStockCurrent({
          warehouse_id: warehouseFilter === 'all' ? undefined : warehouseFilter,
          low_threshold: lowThreshold,
        }),
        api.listWarehouses(),
      ]);
      setRows(s);
      setWarehouses(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [warehouseFilter, lowThreshold]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== 'all') out = out.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r =>
        r.product_name.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[r.category] || r.category).toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, statusFilter, search]);

  // Группировка по товару (для удобного просмотра)
  const grouped = useMemo(() => {
    const map = new Map<number, { product: StockRow; cells: Record<number, StockRow> }>();
    for (const r of filtered) {
      const slot = map.get(r.product_id);
      if (slot) {
        slot.cells[r.warehouse_id] = r;
      } else {
        map.set(r.product_id, { product: r, cells: { [r.warehouse_id]: r } });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  if (loading && rows.length === 0) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка остатков…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;

  const counts = {
    ok:   rows.filter(r => r.status === 'ok').length,
    low:  rows.filter(r => r.status === 'low').length,
    zero: rows.filter(r => r.status === 'zero').length,
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <input
          type="text"
          placeholder="Поиск по названию…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--bg-el)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
            fontSize: 12.5, width: 220,
          }}
        />
        <select
          value={warehouseFilter}
          onChange={e => setWarehouseFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={selectStyle}
        >
          <option value="all">Все склады</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          style={selectStyle}
        >
          <option value="all">Все статусы</option>
          <option value="ok">В наличии ({counts.ok})</option>
          <option value="low">Мало ({counts.low})</option>
          <option value="zero">Нет ({counts.zero})</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ts)' }}>
          Порог «мало»:
          <input
            type="number" min="1" max="500"
            value={lowThreshold}
            onChange={e => setLowThreshold(Math.max(1, parseInt(e.target.value) || 10))}
            style={{ ...selectStyle, width: 70 }}
          />
        </label>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Показано: {filtered.length}
        </span>
      </div>

      {/* Pivoted table: product × warehouses */}
      {warehouseFilter === 'all' ? (
        <PivotedTable grouped={grouped} warehouses={warehouses} />
      ) : (
        <FlatTable rows={filtered} />
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'inherit',
};

function PivotedTable({ grouped, warehouses }: {
  grouped: { product: StockRow; cells: Record<number, StockRow> }[];
  warehouses: Warehouse[];
}) {
  if (grouped.length === 0) {
    return <EmptyHint />;
  }
  const cols = `2.5fr 1fr ${warehouses.map(() => '1fr').join(' ')} 1fr`;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 8,
        padding: '12px 16px', background: 'var(--bg-el)',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        borderBottom: '1px solid var(--border)',
      }}>
        <span>Товар</span>
        <span>Категория</span>
        {warehouses.map(w => (
          <span key={w.id} style={{ textAlign: 'right' }}>[{w.code}] {w.name.replace('Склад ', '')}</span>
        ))}
        <span style={{ textAlign: 'right' }}>Всего</span>
      </div>
      {grouped.map(({ product, cells }) => {
        const total = Object.values(cells).reduce((acc, c) => acc + c.qty, 0);
        return (
          <div
            key={product.product_id}
            style={{
              display: 'grid', gridTemplateColumns: cols, gap: 8,
              padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{product.product_name}</span>
            <span style={{ color: 'var(--ts)', fontSize: 11.5 }}>
              {CATEGORY_LABELS[product.category] || product.category}
            </span>
            {warehouses.map(w => {
              const cell = cells[w.id];
              const qty = cell?.qty ?? 0;
              const status = cell?.status ?? 'zero';
              return (
                <span key={w.id} style={{
                  textAlign: 'right',
                  display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
                    {qty > 0 ? qty.toLocaleString('ru-RU') : '—'}
                  </span>
                  {qty > 0 && (
                    <span className={`stock-badge ${STATUS_CLASS[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </span>
              );
            })}
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
              textAlign: 'right',
              color: total === 0 ? 'var(--red)' : total < 20 ? 'var(--yellow)' : 'var(--gold)',
            }}>
              {total.toLocaleString('ru-RU')}
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function FlatTable({ rows }: { rows: StockRow[] }) {
  if (rows.length === 0) return <EmptyHint />;
  return (
    <>
      {/* Mobile cards */}
      <div className="mobile-cards">
        {rows.map(r => (
          <div key={`${r.product_id}-${r.warehouse_id}`} className="m-card">
            <div className="m-card-top">
              <span className="m-card-title">{r.product_name}</span>
              <span className={`stock-badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="m-card-row">
              <span className="m-card-label">Категория</span>
              <span className="m-card-val">{CATEGORY_LABELS[r.category] || r.category}</span>
            </div>
            <div className="m-card-row">
              <span className="m-card-label">Склад</span>
              <span className="m-card-val">{r.warehouse_name}</span>
            </div>
            <div className="m-card-row">
              <span className="m-card-label">Кол-во</span>
              <span className="m-card-val">{fmt(r.qty)} {r.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop grid */}
      <div className="desktop-only" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 100px 100px',
          gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Товар</span>
          <span>Категория</span>
          <span>Склад</span>
          <span style={{ textAlign: 'right' }}>Кол-во</span>
          <span style={{ textAlign: 'right' }}>Статус</span>
        </div>
        {rows.map(r => (
          <div
            key={`${r.product_id}-${r.warehouse_id}`}
            style={{
              display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 100px 100px',
              gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{r.product_name}</span>
            <span style={{ color: 'var(--ts)' }}>{CATEGORY_LABELS[r.category] || r.category}</span>
            <span style={{ color: 'var(--ts)' }}>{r.warehouse_name}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)', fontWeight: 600 }}>
              {fmt(r.qty)} {r.unit}
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className={`stock-badge ${STATUS_CLASS[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </span>
          </div>
        ))}
        </div>
      </div>
    </>
  );
}

function EmptyHint() {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 28, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
    }}>
      По заданным фильтрам ничего не найдено
    </div>
  );
}
