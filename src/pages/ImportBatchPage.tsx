import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api, ApiError, BatchPreview, BatchSummary, Product,
} from '../utils/api';
import { useAuthStore } from '../store/auth';
import './ImportBatch.css';

interface DraftItem {
  uid: number;
  product_id: number | '';
  quantity: string;
  price_per_unit_usd: string;
}

let nextUid = 1;
const newDraftItem = (): DraftItem => ({
  uid: nextUid++, product_id: '', quantity: '', price_per_unit_usd: '',
});

interface Props {
  onBack: () => void;
}

const fmtKzt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtUsd = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

export default function ImportBatchPage({ onBack }: Props) {
  const user = useAuthStore(s => s.user);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [batchNumber, setBatchNumber] = useState('BATCH-2026-001');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('Tushun Co., Ltd');
  const [shippingUsd, setShippingUsd] = useState('4500');
  const [additionalKzt, setAdditionalKzt] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('450');
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);

  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<{ id: number; batch_number: string; total_cost_kzt: number } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoadError(null);
      const [ps, bs] = await Promise.all([api.listProducts(), api.listBatches()]);
      setProducts(ps);
      setBatches(bs);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    (products ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const validItems = useMemo(() => items.filter(i =>
    i.product_id !== '' && Number(i.quantity) > 0 && Number(i.price_per_unit_usd) > 0,
  ), [items]);

  // Live preview через серверный /api/imports/preview, дебаунс 350мс
  useEffect(() => {
    if (validItems.length === 0) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    const handle = setTimeout(async () => {
      try {
        const data = await api.previewImport({
          shipping_cost_usd: Number(shippingUsd) || 0,
          additional_costs_kzt: Number(additionalKzt) || 0,
          exchange_rate: Number(exchangeRate) || 450,
          items: validItems.map(i => ({
            product_id: Number(i.product_id),
            quantity: Number(i.quantity),
            price_per_unit_usd: Number(i.price_per_unit_usd),
          })),
        });
        setPreview(data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [validItems, shippingUsd, additionalKzt, exchangeRate]);

  const updateItem = (uid: number, field: keyof DraftItem, value: string) => {
    setItems(curr => curr.map(it => (it.uid === uid ? { ...it, [field]: field === 'product_id' && value === '' ? '' : (field === 'product_id' ? Number(value) : value) } : it)));
  };

  const addItem = () => setItems(c => [...c, newDraftItem()]);
  const removeItem = (uid: number) => setItems(c => c.length > 1 ? c.filter(i => i.uid !== uid) : c);

  const submit = async () => {
    setSubmitError(null);
    setSubmitOk(null);
    if (!batchNumber.trim()) {
      setSubmitError('Укажите номер партии');
      return;
    }
    if (validItems.length === 0) {
      setSubmitError('Добавьте минимум один товар с количеством и ценой');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createBatch({
        batch_number: batchNumber.trim(),
        invoice_number: invoiceNumber.trim() || undefined,
        supplier_name: supplierName.trim() || undefined,
        shipping_cost_usd: Number(shippingUsd) || 0,
        additional_costs_kzt: Number(additionalKzt) || 0,
        exchange_rate: Number(exchangeRate) || 450,
        items: validItems.map(i => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          price_per_unit_usd: Number(i.price_per_unit_usd),
        })),
      });
      setSubmitOk({ id: res.id, batch_number: res.batch_number, total_cost_kzt: res.total_cost_kzt });
      // Сброс формы + перезагрузка списка
      setItems([newDraftItem()]);
      const next = `BATCH-2026-${String(batches.length + 2).padStart(3, '0')}`;
      setBatchNumber(next);
      setInvoiceNumber('');
      loadAll();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Не удалось создать партию');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = preview?.totals;
  const previewByProductId = useMemo(() => {
    const map = new Map<string, BatchPreview['items'][number]>();
    preview?.items.forEach((it, idx) => map.set(`${it.product_id}-${idx}`, it));
    return map;
  }, [preview]);

  return (
    <div className="tax-page ib-page">
      <header className="tax-header">
        <div>
          <div className="tax-eyebrow">МОДУЛЬ · ИМПОРТ ПАРТИЯ</div>
          <h1 className="tax-title">Новая партия импорта</h1>
          <p className="tax-sub">
            Себестоимость, пошлина и НДС считаются на сервере по текущим ставкам товаров.
            Доставка и доп.расходы распределяются пропорционально FOB.
          </p>
        </div>
        <div className="tax-header-right">
          <button className="tax-btn tax-btn--ghost" onClick={onBack}>← К ставкам</button>
          <span className="tax-user">{user?.name} · {user?.role}</span>
        </div>
      </header>

      {loadError && <div className="tax-banner tax-banner--err">⚠ {loadError}</div>}
      {submitError && <div className="tax-banner tax-banner--err">⚠ {submitError}</div>}
      {submitOk && (
        <div className="tax-banner tax-banner--ok">
          ✅ Партия <strong>{submitOk.batch_number}</strong> (#{submitOk.id}) создана.
          Себестоимость: <strong>{fmtKzt(submitOk.total_cost_kzt)} KZT</strong>
        </div>
      )}

      <div className="ib-grid">
        {/* ЛЕВО: форма */}
        <div className="tax-card">
          <div className="tax-card-head">
            <span className="tax-card-title">Данные партии</span>
          </div>

          <div className="ib-row">
            <label className="ib-field">
              <span className="ib-label">Номер партии *</span>
              <input className="ib-input" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
            </label>
            <label className="ib-field">
              <span className="ib-label">Номер инвойса</span>
              <input className="ib-input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
            </label>
          </div>

          <label className="ib-field">
            <span className="ib-label">Поставщик</span>
            <input className="ib-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
          </label>

          <div className="ib-row">
            <label className="ib-field">
              <span className="ib-label">Доставка USD</span>
              <input className="ib-input ib-input--num" type="number" min="0" step="0.01" value={shippingUsd} onChange={e => setShippingUsd(e.target.value)} />
            </label>
            <label className="ib-field">
              <span className="ib-label">Доп. KZT (СВХ, брокер)</span>
              <input className="ib-input ib-input--num" type="number" min="0" step="1000" value={additionalKzt} onChange={e => setAdditionalKzt(e.target.value)} />
            </label>
            <label className="ib-field">
              <span className="ib-label">Курс USD/KZT</span>
              <input className="ib-input ib-input--num" type="number" min="0" step="0.1" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
            </label>
          </div>

          <div className="tax-card-head" style={{ marginTop: 18 }}>
            <span className="tax-card-title">Товары — {items.length}</span>
            <button className="tax-btn tax-btn--ghost" onClick={addItem}>+ Добавить товар</button>
          </div>

          <div className="ib-items">
            {items.map((it, idx) => {
              const product = it.product_id !== '' ? productById.get(Number(it.product_id)) : undefined;
              const calc = previewByProductId.get(`${it.product_id}-${idx}`);
              return (
                <div className="ib-item" key={it.uid}>
                  <div className="ib-item-row">
                    <select
                      className="ib-input ib-input--select"
                      value={it.product_id === '' ? '' : it.product_id}
                      onChange={e => updateItem(it.uid, 'product_id', e.target.value)}
                    >
                      <option value="">— выбрать товар —</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} · пошлина {(p.customs_duty_percent * 100).toFixed(1)}%
                        </option>
                      ))}
                    </select>
                    <input
                      className="ib-input ib-input--num"
                      type="number" min="1" placeholder="кол-во"
                      value={it.quantity}
                      onChange={e => updateItem(it.uid, 'quantity', e.target.value)}
                    />
                    <input
                      className="ib-input ib-input--num"
                      type="number" min="0" step="0.01" placeholder="цена USD"
                      value={it.price_per_unit_usd}
                      onChange={e => updateItem(it.uid, 'price_per_unit_usd', e.target.value)}
                    />
                    <button
                      className="tax-btn tax-btn--ghost ib-remove"
                      onClick={() => removeItem(it.uid)}
                      disabled={items.length === 1}
                      title="Удалить"
                    >×</button>
                  </div>
                  {product && calc && (
                    <div className="ib-item-meta">
                      <span>FOB: <strong>${fmtUsd(calc.fob_usd ?? 0)}</strong></span>
                      <span>Пошлина {(calc.customs_duty_percent! * 100).toFixed(1)}%: <strong>${fmtUsd(calc.customs_duty_usd ?? 0)}</strong></span>
                      <span>НДС {(calc.vat_import_percent! * 100).toFixed(1)}%: <strong>${fmtUsd(calc.vat_import_usd ?? 0)}</strong></span>
                      <span className="ib-item-cost">Себест. 1шт: <strong>{fmtKzt(calc.unit_cost_kzt ?? 0)} ₸</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ib-actions">
            <button className="tax-btn tax-btn--gold" disabled={submitting} onClick={submit}>
              {submitting ? 'Создание…' : '✅ Создать партию'}
            </button>
            <button className="tax-btn tax-btn--ghost" onClick={() => { setItems([newDraftItem()]); setSubmitOk(null); }}>
              Очистить
            </button>
          </div>
        </div>

        {/* ПРАВО: live preview */}
        <div className="tax-card ib-summary">
          <div className="tax-card-head">
            <span className="tax-card-title">Расчёт партии</span>
            <span className={`tax-health ${previewing ? '' : preview ? 'tax-health--ok' : ''}`}>
              {previewing ? 'считаю…' : preview ? 'актуально' : 'нет данных'}
            </span>
          </div>

          {!preview ? (
            <div className="tax-empty">
              Заполните хотя бы одну строку товара —<br />
              увидите себестоимость в реальном времени
            </div>
          ) : (
            <>
              <div className="ib-totals">
                <div className="ib-total-row"><span>FOB товаров</span><strong>${fmtUsd(totals!.fob_usd)}</strong></div>
                <div className="ib-total-row"><span>Доставка</span><strong>${fmtUsd(Number(shippingUsd) || 0)}</strong></div>
                <div className="ib-total-row"><span>Пошлина</span><strong>${fmtUsd(totals!.customs_usd)}</strong></div>
                <div className="ib-total-row"><span>НДС импорт</span><strong>${fmtUsd(totals!.vat_usd)}</strong></div>
                <div className="ib-total-row ib-total-row--alt"><span>Итого USD</span><strong>${fmtUsd(totals!.cost_usd)}</strong></div>
                <div className="ib-total-row ib-total-row--big">
                  <span>СЕБЕСТОИМОСТЬ KZT</span>
                  <strong>{fmtKzt(totals!.cost_kzt)} ₸</strong>
                </div>
                <div className="ib-total-hint">Курс: {preview.exchange_rate} ₸/$</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* СПИСОК ПАРТИЙ */}
      <div className="tax-card" style={{ marginTop: 18 }}>
        <div className="tax-card-head">
          <span className="tax-card-title">История партий — {batches.length}</span>
          <button className="tax-btn tax-btn--ghost" onClick={loadAll}>↻ Обновить</button>
        </div>
        <div className="tax-table-wrap">
          <div className="table-scroll"><table className="tax-table">
            <thead>
              <tr>
                <th>№ партии</th>
                <th>Поставщик</th>
                <th>Дата</th>
                <th className="td-right">Товаров</th>
                <th className="td-right">FOB USD</th>
                <th className="td-right">Себест. USD</th>
                <th className="td-right">Себест. KZT</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && (
                <tr><td colSpan={8} className="tax-empty">Пока нет ни одной партии</td></tr>
              )}
              {batches.map(b => (
                <tr key={b.id}>
                  <td className="tax-td-name">{b.batch_number}</td>
                  <td>{b.supplier_name ?? '—'}</td>
                  <td className="tax-mono tax-muted">{b.import_date ?? '—'}</td>
                  <td className="td-right tax-mono">{b.items_count}</td>
                  <td className="td-right tax-mono">${fmtUsd(b.total_fob_usd)}</td>
                  <td className="td-right tax-mono">${fmtUsd(b.total_cost_usd)}</td>
                  <td className="td-right tax-mono"><strong>{fmtKzt(b.total_cost_kzt)} ₸</strong></td>
                  <td><span className={`ib-status ib-status--${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
