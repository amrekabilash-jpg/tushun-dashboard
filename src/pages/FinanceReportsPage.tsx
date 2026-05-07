import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, Product } from '../utils/api';
import { useAuthStore } from '../store/auth';
import SaleFormDialog from './SaleFormDialog';
import './FinanceReports.css';
import './ImportBatch.css';

type PL = Awaited<ReturnType<typeof api.getProfitLoss>>;
type MarginRow = Awaited<ReturnType<typeof api.getMarginByProduct>>['rows'][number];
type Account = Awaited<ReturnType<typeof api.listAccounts>>[number];
type Sale = Awaited<ReturnType<typeof api.listSales>>[number];

interface Props {
  onBack: () => void;
}

const PERIODS: { days: number; label: string }[] = [
  { days: 7,   label: '7 дней'   },
  { days: 30,  label: '30 дней'  },
  { days: 90,  label: '90 дней'  },
  { days: 365, label: 'Год'      },
];

const fmt = (n: number, dp = 0) => new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: dp, maximumFractionDigits: dp,
}).format(Math.round(n * 10 ** dp) / 10 ** dp);

const fmtPct = (n: number) => `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;

export default function FinanceReportsPage({ onBack }: Props) {
  const user = useAuthStore(s => s.user);
  const [days, setDays] = useState(30);

  const [pl, setPl] = useState<PL | null>(null);
  const [margin, setMargin] = useState<MarginRow[] | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [createdToast, setCreatedToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plRes, marginRes, accRes, salesRes, productsRes] = await Promise.all([
        api.getProfitLoss(days),
        api.getMarginByProduct(days),
        api.listAccounts(),
        api.listSales(),
        api.listProducts(),
      ]);
      setPl(plRes);
      setMargin(marginRes.rows);
      setAccounts(accRes);
      setSales(salesRes);
      setProducts(productsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const nextInvoiceNumber = useMemo(() => {
    if (!sales || sales.length === 0) return 'СФ-2026-001';
    const max = sales.reduce((m, s) => {
      const match = s.invoice_number?.match(/(\d+)$/);
      const n = match ? Number(match[1]) : 0;
      return Math.max(m, n);
    }, 0);
    return `СФ-2026-${String(max + 1).padStart(3, '0')}`;
  }, [sales]);

  const onSaleCreated = () => {
    setShowSaleForm(false);
    setCreatedToast(`✅ Продажа создана. Отчёты пересчитаны.`);
    reload();
    setTimeout(() => setCreatedToast(null), 4000);
  };

  useEffect(() => { reload(); }, [reload]);

  const totalKzt = useMemo(
    () => (accounts ?? []).reduce((sum, a) => sum + (a.currency === 'USD' ? a.balance * 450 : a.balance), 0),
    [accounts],
  );

  const taxesTotal = pl ? pl.vat_to_pay_kzt + pl.kpn_tax_kzt : 0;
  const marginColors = ['#34D399', '#60A5FA', '#a78bfa', '#fbbf24', '#F87171', '#6EE7B7'];
  const maxMargin = useMemo(
    () => (margin ?? []).reduce((m, r) => Math.max(m, r.revenue_kzt), 0),
    [margin],
  );

  return (
    <div className="tax-page fr-page">
      <header className="tax-header">
        <div>
          <div className="tax-eyebrow">МОДУЛЬ · ФИНАНСОВЫЕ ОТЧЁТЫ</div>
          <h1 className="tax-title">P&L и маржинальный анализ</h1>
          <p className="tax-sub">
            Все цифры считаются на сервере по продажам в выбранном периоде.
            НДС с цены-с-налогом, КПН — только на положительной марже.
          </p>
        </div>
        <div className="tax-header-right">
          <button className="tax-btn tax-btn--ghost" onClick={onBack}>← К ставкам</button>
          <button className="tax-btn tax-btn--ghost" onClick={reload} disabled={loading}>
            {loading ? '…' : '↻ Обновить'}
          </button>
          <button className="tax-btn tax-btn--gold" onClick={() => setShowSaleForm(true)}>
            + Новая продажа
          </button>
          <span className="tax-user">{user?.name} · {user?.role}</span>
        </div>
      </header>

      {error && <div className="tax-banner tax-banner--err">⚠ {error}</div>}
      {createdToast && <div className="tax-banner tax-banner--ok">{createdToast}</div>}

      <div className="fr-period">
        {PERIODS.map(p => (
          <button
            key={p.days}
            className={`fr-period-btn ${days === p.days ? 'is-active' : ''}`}
            onClick={() => setDays(p.days)}
          >{p.label}</button>
        ))}
        {pl && (
          <span className="fr-period-range">
            {pl.period_start} — {pl.period_end} · продаж: {pl.sales_count}
          </span>
        )}
      </div>

      {/* KPI */}
      <div className="fr-kpi-grid">
        <div className="fr-kpi">
          <div className="fr-kpi-label">Выручка</div>
          <div className="fr-kpi-val">{pl ? fmt(pl.revenue_kzt) : '—'} <span className="fr-cur">₸</span></div>
          <div className="fr-kpi-sub">себестоимость: {pl ? fmt(pl.cost_kzt) : '—'} ₸</div>
        </div>
        <div className="fr-kpi fr-kpi--accent">
          <div className="fr-kpi-label">Валовая маржа</div>
          <div className="fr-kpi-val">{pl ? fmt(pl.gross_margin_kzt) : '—'} <span className="fr-cur">₸</span></div>
          <div className="fr-kpi-sub fr-pos">
            {pl ? fmtPct(pl.gross_margin_percent) : '—'} от выручки
          </div>
        </div>
        <div className="fr-kpi">
          <div className="fr-kpi-label">Налоги к уплате</div>
          <div className="fr-kpi-val fr-neg">{pl ? fmt(taxesTotal) : '—'} <span className="fr-cur">₸</span></div>
          <div className="fr-kpi-sub">
            НДС: {pl ? fmt(pl.vat_to_pay_kzt) : '—'} · КПН: {pl ? fmt(pl.kpn_tax_kzt) : '—'}
          </div>
        </div>
        <div className="fr-kpi fr-kpi--gold">
          <div className="fr-kpi-label">Чистая прибыль</div>
          <div className="fr-kpi-val">{pl ? fmt(pl.net_profit_kzt) : '—'} <span className="fr-cur">₸</span></div>
          <div className="fr-kpi-sub">
            {pl && pl.revenue_kzt > 0 ? `${(pl.net_profit_kzt / pl.revenue_kzt * 100).toFixed(1)}% net margin` : '—'}
          </div>
        </div>
      </div>

      <div className="fr-grid">
        {/* МАРЖА ПО ТОВАРАМ */}
        <div className="tax-card">
          <div className="tax-card-head">
            <span className="tax-card-title">Маржа по товарам</span>
            <span className="tax-mono tax-muted">{margin?.length ?? 0} позиций</span>
          </div>
          <div className="tax-table-wrap">
            <table className="tax-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th className="td-right">Продаж</th>
                  <th className="td-right">Выручка ₸</th>
                  <th className="td-right">Маржа ₸</th>
                  <th className="td-right">% маржа</th>
                  <th>Доля</th>
                </tr>
              </thead>
              <tbody>
                {!margin && <tr><td colSpan={6} className="tax-empty">Загрузка…</td></tr>}
                {margin && margin.length === 0 && (
                  <tr><td colSpan={6} className="tax-empty">Нет продаж за период</td></tr>
                )}
                {margin?.map((r, i) => {
                  const share = maxMargin > 0 ? (r.revenue_kzt / maxMargin * 100) : 0;
                  const color = marginColors[i % marginColors.length];
                  return (
                    <tr key={r.product_id}>
                      <td className="tax-td-name">{r.product_name}</td>
                      <td className="td-right tax-mono">{r.sales_count}</td>
                      <td className="td-right tax-mono"><strong>{fmt(r.revenue_kzt)}</strong></td>
                      <td className="td-right tax-mono fr-pos">+{fmt(r.margin_kzt)}</td>
                      <td className="td-right tax-mono">{fmtPct(r.margin_percent)}</td>
                      <td className="fr-bar-cell">
                        <div className="fr-bar"><div className="fr-bar-fill" style={{ width: `${share}%`, background: color }} /></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* СЧЕТА */}
        <div className="tax-card">
          <div className="tax-card-head">
            <span className="tax-card-title">Банковские счета</span>
            <span className="tax-mono tax-muted">≈ {fmt(totalKzt)} ₸</span>
          </div>
          <div className="fr-accounts">
            {!accounts && <div className="tax-empty">Загрузка…</div>}
            {accounts?.map(a => {
              const kzt = a.currency === 'USD' ? a.balance * 450 : a.balance;
              return (
                <div className="fr-account" key={a.id}>
                  <div className="fr-account-top">
                    <span className="fr-account-bank">{a.bank_name}</span>
                    <span className={`fr-cur-badge fr-cur-${a.currency.toLowerCase()}`}>{a.currency}</span>
                  </div>
                  <div className="fr-account-num tax-mono tax-muted">{a.account_number}</div>
                  <div className="fr-account-bal">
                    {fmt(a.balance)} <span className="fr-account-cur">{a.currency}</span>
                  </div>
                  {a.currency !== 'KZT' && (
                    <div className="fr-account-eq tax-muted">≈ {fmt(kzt)} ₸</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSaleForm && (
        <SaleFormDialog
          products={products}
          defaultInvoiceNumber={nextInvoiceNumber}
          onClose={() => setShowSaleForm(false)}
          onCreated={onSaleCreated}
        />
      )}

      {/* ПОСЛЕДНИЕ ПРОДАЖИ */}
      <div className="tax-card" style={{ marginTop: 18 }}>
        <div className="tax-card-head">
          <span className="tax-card-title">Последние продажи — {sales?.length ?? 0}</span>
        </div>
        <div className="tax-table-wrap">
          <table className="tax-table">
            <thead>
              <tr>
                <th>Счёт</th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Товар</th>
                <th className="td-right">Кол-во</th>
                <th className="td-right">Цена ₸</th>
                <th className="td-right">Выручка ₸</th>
                <th className="td-right">Маржа ₸</th>
                <th className="td-right">%</th>
                <th className="td-right">Чистая ₸</th>
              </tr>
            </thead>
            <tbody>
              {!sales && <tr><td colSpan={10} className="tax-empty">Загрузка…</td></tr>}
              {sales && sales.length === 0 && (
                <tr><td colSpan={10} className="tax-empty">Нет продаж</td></tr>
              )}
              {sales?.map(s => (
                <tr key={s.id}>
                  <td className="tax-mono">{s.invoice_number ?? `#${s.id}`}</td>
                  <td className="tax-mono tax-muted">{s.sale_date ?? '—'}</td>
                  <td>{s.customer_name ?? '—'}</td>
                  <td className="tax-td-name">{s.product_name ?? `#${s.product_id}`}</td>
                  <td className="td-right tax-mono">{fmt(s.quantity)}</td>
                  <td className="td-right tax-mono">{fmt(s.unit_price_kzt)}</td>
                  <td className="td-right tax-mono"><strong>{fmt(s.total_revenue_kzt)}</strong></td>
                  <td className="td-right tax-mono fr-pos">+{fmt(s.gross_margin_kzt)}</td>
                  <td className="td-right tax-mono">{fmtPct(s.gross_margin_percent)}</td>
                  <td className="td-right tax-mono"><strong>{fmt(s.net_profit_kzt)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
