import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, Product } from '../utils/api';

interface Props {
  products: Product[];
  defaultInvoiceNumber: string;
  onClose: () => void;
  onCreated: () => void;
}

interface CostSource {
  batch_id: number;
  batch_number: string;
  import_date: string | null;
}

const fmt = (n: number, dp = 0) => new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: dp, maximumFractionDigits: dp,
}).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type Preview = Awaited<ReturnType<typeof api.previewSale>>;

export default function SaleFormDialog({ products, defaultInvoiceNumber, onClose, onCreated }: Props) {
  const [productId, setProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unitPriceKzt, setUnitPriceKzt] = useState('');
  const [unitCostKzt, setUnitCostKzt] = useState('');
  const [costSource, setCostSource] = useState<CostSource | null>(null);
  const [costNoData, setCostNoData] = useState(false);
  const [customer, setCustomer] = useState('');
  const [invoice, setInvoice] = useState(defaultInvoiceNumber);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = useMemo(
    () => (productId === '' ? null : products.find(p => p.id === productId) ?? null),
    [productId, products],
  );

  // При смене товара тянем себестоимость из последней партии
  const pullLastCost = useCallback(async (pid: number) => {
    setCostSource(null);
    setCostNoData(false);
    try {
      const res = await api.getProductLastCost(pid);
      if (res.unit_cost_kzt !== null) {
        setUnitCostKzt(res.unit_cost_kzt.toString());
        setCostSource(res.source);
      } else {
        setCostNoData(true);
      }
    } catch {
      // молча — пользователь введёт руками
    }
  }, []);

  useEffect(() => {
    if (productId !== '') pullLastCost(productId);
    else { setUnitCostKzt(''); setCostSource(null); setCostNoData(false); }
  }, [productId, pullLastCost]);

  // Live-превью
  const canPreview = product && Number(quantity) > 0 && Number(unitPriceKzt) > 0 && Number(unitCostKzt) > 0;
  useEffect(() => {
    if (!canPreview) { setPreview(null); return; }
    setPreviewing(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.previewSale({
          product_id: product!.id,
          quantity: Number(quantity),
          unit_price_kzt: Number(unitPriceKzt),
          unit_cost_kzt: Number(unitCostKzt),
        });
        setPreview(res);
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [canPreview, product, quantity, unitPriceKzt, unitCostKzt]);

  const submit = async () => {
    setError(null);
    if (!product) return setError('Выберите товар');
    if (!(Number(quantity) > 0)) return setError('Укажите количество');
    if (!(Number(unitPriceKzt) > 0)) return setError('Укажите цену продажи');
    if (!(Number(unitCostKzt) > 0)) return setError('Укажите себестоимость');
    setSubmitting(true);
    try {
      await api.createSale({
        product_id: product.id,
        quantity: Number(quantity),
        unit_price_kzt: Number(unitPriceKzt),
        unit_cost_kzt: Number(unitCostKzt),
        customer_name: customer.trim() || undefined,
        invoice_number: invoice.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка создания продажи');
    } finally {
      setSubmitting(false);
    }
  };

  const lossWarning = preview && preview.gross_margin_kzt < 0;

  return (
    <div className="tax-modal" onClick={onClose}>
      <div className="tax-modal-box sf-box" onClick={e => e.stopPropagation()}>
        <header className="tax-modal-head">
          <div>
            <div className="tax-eyebrow">НОВАЯ ПРОДАЖА</div>
            <h2 className="tax-modal-title">Регистрация сделки</h2>
          </div>
          <button className="tax-btn tax-btn--ghost" onClick={onClose}>Закрыть</button>
        </header>

        <div className="sf-grid">
          {/* ЛЕВО — поля */}
          <div className="sf-form">
            <label className="ib-field">
              <span className="ib-label">Товар *</span>
              <select
                className="ib-input ib-input--select"
                value={productId === '' ? '' : productId}
                onChange={e => setProductId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— выбрать товар —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} · НДС продажа {(p.vat_sale_percent * 100).toFixed(0)}% · КПН {(p.kpn_percent * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            </label>

            <div className="ib-row">
              <label className="ib-field">
                <span className="ib-label">Кол-во *</span>
                <input
                  className="ib-input ib-input--num" type="number" min="1"
                  value={quantity} onChange={e => setQuantity(e.target.value)}
                />
              </label>
              <label className="ib-field">
                <span className="ib-label">Цена продажи 1шт ₸ *</span>
                <input
                  className="ib-input ib-input--num" type="number" min="0" step="0.01"
                  value={unitPriceKzt} onChange={e => setUnitPriceKzt(e.target.value)}
                />
              </label>
            </div>

            <label className="ib-field">
              <span className="ib-label">Себестоимость 1шт ₸ *</span>
              <input
                className="ib-input ib-input--num" type="number" min="0" step="0.01"
                value={unitCostKzt} onChange={e => setUnitCostKzt(e.target.value)}
              />
              {costSource && (
                <span className="sf-cost-source">
                  ← из партии <strong>{costSource.batch_number}</strong>
                  {costSource.import_date && ` (${costSource.import_date})`}
                </span>
              )}
              {costNoData && (
                <span className="sf-cost-source sf-cost-source--warn">
                  ⚠ нет партии для этого товара — введите себестоимость вручную
                </span>
              )}
            </label>

            <div className="ib-row">
              <label className="ib-field">
                <span className="ib-label">Клиент</span>
                <input
                  className="ib-input" type="text"
                  placeholder="ТОО АвтоАлмат"
                  value={customer} onChange={e => setCustomer(e.target.value)}
                />
              </label>
              <label className="ib-field">
                <span className="ib-label">№ счёта-фактуры</span>
                <input
                  className="ib-input" type="text"
                  value={invoice} onChange={e => setInvoice(e.target.value)}
                />
              </label>
            </div>

            {error && <div className="tax-banner tax-banner--err">⚠ {error}</div>}

            <div className="ib-actions">
              <button className="tax-btn tax-btn--gold" disabled={submitting} onClick={submit}>
                {submitting ? 'Сохранение…' : '✅ Создать продажу'}
              </button>
              <button className="tax-btn tax-btn--ghost" onClick={onClose}>Отмена</button>
            </div>
          </div>

          {/* ПРАВО — превью */}
          <div className="sf-preview">
            <div className="tax-card-head">
              <span className="tax-card-title">Расчёт сделки</span>
              <span className={`tax-health ${previewing ? '' : preview ? 'tax-health--ok' : ''}`}>
                {previewing ? 'считаю…' : preview ? 'актуально' : 'нет данных'}
              </span>
            </div>

            {!preview ? (
              <div className="tax-empty" style={{ padding: '40px 0' }}>
                Заполните товар, кол-во, цену и себестоимость —<br />
                покажу маржу и налоги
              </div>
            ) : (
              <div className="ib-totals">
                <div className="ib-total-row">
                  <span>Выручка</span>
                  <strong>{fmt(preview.total_revenue_kzt)} ₸</strong>
                </div>
                <div className="ib-total-row">
                  <span>Себестоимость</span>
                  <strong>{fmt(preview.total_cost_kzt)} ₸</strong>
                </div>
                <div className="ib-total-row" style={{ color: preview.gross_margin_kzt >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  <span>Валовая маржа</span>
                  <strong style={{ color: 'inherit' }}>
                    {preview.gross_margin_kzt >= 0 ? '+' : ''}{fmt(preview.gross_margin_kzt)} ₸ · {fmtPct(preview.gross_margin_percent)}
                  </strong>
                </div>
                <div className="ib-total-row">
                  <span>НДС к уплате</span>
                  <strong>{fmt(preview.vat_to_pay_kzt)} ₸</strong>
                </div>
                <div className="ib-total-row">
                  <span>КПН</span>
                  <strong>{fmt(preview.kpn_tax_kzt)} ₸</strong>
                </div>
                <div className="ib-total-row ib-total-row--big" style={{ background: lossWarning ? 'rgba(248,113,113,.10)' : undefined, borderColor: lossWarning ? 'rgba(248,113,113,.32)' : undefined }}>
                  <span>{lossWarning ? '⚠ Убыток' : 'Чистая прибыль'}</span>
                  <strong>{fmt(preview.net_profit_kzt)} ₸</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
