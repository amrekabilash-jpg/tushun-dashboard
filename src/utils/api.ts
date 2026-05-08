/**
 * API-клиент.
 *
 * URL берём из VITE_API_URL (Vite env var). Если переменная не задана —
 * fallback на 127.0.0.1:5000 (локальный dev).
 *
 * .env / .env.production задают эти значения для разных билдов.
 * VITE_API_URL должна включать схему и хост, БЕЗ trailing slash.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000').replace(/\/$/, '');
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('[api] BASE_URL =', BASE_URL);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (body && (body as { error?: string }).error) || `HTTP ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}

export interface Product {
  id: number;
  name: string;
  tn_ved_code: string | null;
  category: string;
  unit: string;
  customs_duty_percent: number;
  vat_import_percent: number;
  vat_sale_percent: number;
  kpn_percent: number;
  updated_at: string | null;
}

export interface TaxHistoryRow {
  id: number;
  field: string;
  old: number | null;
  new: number;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

export interface TaxUpdatePayload {
  customs_duty_percent?: number;
  vat_import_percent?: number;
  vat_sale_percent?: number;
  kpn_percent?: number;
  changed_by?: string;
  reason?: string;
}

export type BatchStatus = 'draft' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';

export interface BatchSummary {
  id: number;
  batch_number: string;
  invoice_number: string | null;
  supplier_name: string | null;
  shipping_cost_usd: number;
  additional_costs_kzt: number;
  total_fob_usd: number;
  total_customs_duty_usd: number;
  total_vat_import_usd: number;
  total_cost_usd: number;
  total_cost_kzt: number;
  exchange_rate: number;
  status: BatchStatus;
  import_date: string | null;
  // Module 4 tracking
  tracking_number: string | null;
  eta_date: string | null;
  arrival_date: string | null;
  destination_warehouse_id: number | null;
  destination_warehouse_name: string | null;
  stock_in_created: boolean;
  items_count: number;
  created_at: string | null;
}

export interface BatchDetail extends BatchSummary {
  items: {
    id: number;
    product_id: number;
    product_name: string;
    category: string;
    quantity: number;
    price_per_unit_usd: number;
    customs_duty_percent: number;
    vat_import_percent: number;
    fob_usd: number;
    customs_duty_usd: number;
    vat_import_usd: number;
    unit_cost_usd: number;
    unit_cost_kzt: number;
    total_cost_kzt: number;
  }[];
}

export interface ImportSummary {
  total_batches: number;
  by_status: { status: BatchStatus; count: number; total_cost_kzt: number; total_cost_usd: number }[];
  top_suppliers: { supplier: string; count: number; total_cost_kzt: number }[];
  totals_completed: {
    fob_usd: number; customs_duty_usd: number; vat_import_usd: number;
    total_cost_usd: number; total_cost_kzt: number; avg_exchange_rate: number;
  };
  in_transit: BatchSummary[];
}

export interface CostByProductRow {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  batches_count: number;
  total_quantity: number;
  avg_unit_cost_kzt: number;
  last_unit_cost_kzt: number | null;
  total_cost_kzt: number;
  total_fob_usd: number;
  total_customs_usd: number;
  total_vat_usd: number;
  history: {
    batch_id: number;
    batch_number: string;
    import_date: string | null;
    status: BatchStatus;
    quantity: number;
    unit_cost_kzt: number;
    unit_cost_usd: number;
    fob_usd: number;
    customs_duty_usd: number;
    vat_import_usd: number;
  }[];
}

export interface BatchItemRow {
  product_id: number;
  product_name?: string;
  quantity: number;
  price_per_unit_usd: number;
  customs_duty_percent?: number;
  vat_import_percent?: number;
  fob_usd?: number;
  customs_duty_usd?: number;
  vat_import_usd?: number;
  unit_cost_usd?: number;
  unit_cost_kzt?: number;
  total_cost_kzt?: number;
  total_cost_usd?: number;
  share_percent?: number;
}

export interface BatchPreview {
  exchange_rate: number;
  totals: { fob_usd: number; customs_usd: number; vat_usd: number; cost_usd: number; cost_kzt: number };
  items: BatchItemRow[];
}

export interface CreateBatchPayload {
  batch_number: string;
  invoice_number?: string;
  supplier_name?: string;
  shipping_cost_usd?: number;
  additional_costs_kzt?: number;
  exchange_rate?: number;
  items: { product_id: number; quantity: number; price_per_unit_usd: number }[];
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string | null;
  is_active: boolean;
}

export interface StockRow {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  warehouse_id: number;
  warehouse_name: string;
  warehouse_code: string;
  qty: number;
  status: 'ok' | 'low' | 'zero';
}

export interface StockSummary {
  total_products: number;
  total_warehouses: number;
  stock_by_warehouse: {
    warehouse_id: number; warehouse_name: string; warehouse_code: string;
    total_qty: number; sku_count: number;
  }[];
  low_stock_count: number;
  zero_stock_count: number;
  recent_movements_count: number;
}

export type MovementType = 'in' | 'out' | 'transfer_in' | 'transfer_out' | 'adjustment';

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  movement_type: MovementType;
  quantity: number;
  document_ref: string | null;
  counterparty: string | null;
  note: string | null;
  movement_date: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface ForecastRow {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  current_qty: number;
  sold_last_period: number;
  avg_daily_sales: number;
  days_left: number | null;
  recommended_qty: number;
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

// ─── Module 3 types ───

export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type CustomerType = 'b2b' | 'b2c';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  customer_type: CustomerType;
  status: CustomerStatus;
  discount_percent: number;
  credit_limit_kzt: number;
  notes: string | null;
  created_at: string | null;
  // optional aggregates (when listing)
  invoice_count?: number;
  total_revenue_kzt?: number;
  outstanding_kzt?: number;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'bank' | 'cash' | 'kaspi' | 'card' | 'other';

export interface InvoiceSummary {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  total_kzt: number;
  paid_kzt: number;
  outstanding_kzt: number;
  notes: string | null;
  items_count: number;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number | null;
  customer_id: number | null;
  product_id: number;
  product_name: string | null;
  customer_name: string | null;
  quantity: number;
  unit_price_kzt: number;
  unit_cost_kzt: number;
  total_revenue_kzt: number;
  total_cost_kzt: number;
  vat_to_pay_kzt: number;
  gross_margin_kzt: number;
  gross_margin_percent: number;
  net_profit_kzt: number;
  sale_date: string | null;
  due_date: string | null;
  payment_status: string | null;
  paid_kzt: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  invoice_number: string | null;
  amount_kzt: number;
  payment_date: string | null;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceItem[];
  payments: Payment[];
}

export interface AgingRow {
  invoice_id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string | null;
  issue_date: string | null;
  due_date: string | null;
  days_overdue: number;
  days_until_due: number;
  total_kzt: number;
  paid_kzt: number;
  outstanding_kzt: number;
  bucket: 'current' | '0-30' | '31-60' | '61-90' | '90+';
  status: InvoiceStatus;
}

export interface AgingResponse {
  rows: AgingRow[];
  aging: { bucket: string; amount_kzt: number; count: number }[];
  total_outstanding_kzt: number;
  total_overdue_kzt: number;
  overdue_count: number;
}

export interface ARSummaryRow {
  customer_id: number;
  customer_name: string;
  customer_status: CustomerStatus;
  open_invoices: number;
  total_kzt: number;
  paid_kzt: number;
  outstanding_kzt: number;
  overdue_kzt: number;
}

// ─── Module 5: Финансовые инструменты ───

export type Currency = 'USD' | 'EUR' | 'CNY' | 'RUB' | 'KZT';
export type RateSource = 'manual' | 'nbk' | 'xe' | 'api';
export type PremiumType = 'fixed' | 'percent';
export type PremiumPeriod = 'monthly' | 'quarterly' | 'yearly' | 'one-time';
export type PremiumRole = 'sales' | 'warehouse' | 'management' | 'all';
export type CommissionType = 'sales' | 'service' | 'returns' | 'logistics';

export interface ExchangeRate {
  id: number;
  base_currency: Currency;
  target_currency: Currency;
  rate: number;
  rate_date: string | null;
  source: RateSource;
  note: string | null;
  // optional aggregates from /api/rates/
  week_change?: number | null;
  week_change_percent?: number | null;
}

export interface ConvertResult {
  amount: number;
  from: Currency;
  to: Currency;
  rate: number;
  result: number;
  rate_date?: string;
  path: Currency[];
  inverted_from?: { base: Currency; target: Currency; rate: number };
  leg_1?: { pair: string; rate: number; date: string };
  leg_2?: { pair: string; rate: number; date: string };
}

export interface Premium {
  id: number;
  name: string;
  premium_type: PremiumType;
  amount: number;
  description: string | null;
  period: PremiumPeriod | null;
  target_role: PremiumRole | null;
  is_active: boolean;
}

export interface Commission {
  id: number;
  name: string;
  commission_type: CommissionType;
  percent: number;
  min_amount_kzt: number;
  max_amount_kzt: number | null;
  description: string | null;
  is_active: boolean;
}

// ─── Module 6: Гарантии ───

export type ClaimType = 'defect' | 'damage' | 'wrong_item' | 'other';
export type ClaimStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
export type ReturnStatus = 'pending' | 'approved' | 'refunded' | 'rejected';
export type RefundMethod = 'cash' | 'bank' | 'exchange' | 'credit';

export interface WarrantyPlan {
  id: number;
  product_id: number;
  product_name: string | null;
  category: string | null;
  name: string;
  months: number;
  coverage_percent: number;
  price_kzt: number;
  description: string | null;
  is_active: boolean;
}

export interface WarrantyClaim {
  id: number;
  claim_number: string;
  invoice_id: number | null;
  invoice_number: string | null;
  product_id: number;
  product_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  quantity: number;
  claim_type: ClaimType;
  description: string | null;
  status: ClaimStatus;
  resolution: string | null;
  claim_date: string | null;
  resolved_date: string | null;
  resolution_days: number | null;
  returns_count: number;
}

export interface WarrantyClaimDetail extends WarrantyClaim {
  returns: WarrantyReturn[];
}

export interface WarrantyReturn {
  id: number;
  claim_id: number;
  claim_number: string | null;
  product_name: string | null;
  customer_name: string | null;
  quantity: number;
  reason: string | null;
  refund_amount_kzt: number;
  refund_method: RefundMethod;
  return_date: string | null;
  status: ReturnStatus;
  note: string | null;
  created_at: string | null;
}

export interface ClaimsSummary {
  total_claims: number;
  by_status: Record<ClaimStatus, number>;
  by_type: Record<ClaimType, number>;
  avg_resolution_days: number | null;
  returns_count: number;
  refund_total_kzt: number;
  overdue_open_count: number;
  return_rate_percent: number;
}

export interface WarrantyByProductRow {
  product_id: number;
  product_name: string;
  category: string;
  claims_count: number;
  claim_qty: number;
  sold_qty: number;
  defect_rate_percent: number;
  avg_resolution_days: number | null;
  returns_count: number;
  refund_total_kzt: number;
  open_claims: number;
}

export interface WarrantyTimelineEvent {
  event_type: string;
  date: string | null;
  claim_id: number;
  claim_number: string | null;
  product_name: string | null;
  customer_name: string | null;
  description: string;
  status: string;
  amount_kzt?: number;
}

// ─── Module 7: Расходы ───

export interface ExpenseCategory {
  id: number;
  code: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  monthly_limit_kzt: number;
  alert_percent: number;
  is_active: boolean;
  sort_order: number;
  // Optional fields when fetched via /categories (current month aggregate)
  current_month_fact_kzt?: number;
  current_month_count?: number;
  current_month_budget_kzt?: number;
  current_month_used_percent?: number;
  current_month_remaining_kzt?: number;
  is_over_budget?: boolean;
  is_alert?: boolean;
}

export interface ExpenseBudget {
  id: number;
  category_id: number;
  category_name: string | null;
  category_color: string | null;
  year: number;
  month: number;
  limit_amount_kzt: number;
  alert_percent: number;
  note: string | null;
}

export interface BudgetRow {
  category_id: number;
  category_code: string;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  budget_id: number | null;
  limit_amount_kzt: number;
  fact_amount_kzt: number;
  fact_count: number;
  diff_kzt: number;
  used_percent: number;
  is_over: boolean;
  alert_percent: number;
  is_alert: boolean;
}

export interface BudgetMonth {
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  rows: BudgetRow[];
  totals: {
    limit_kzt: number;
    fact_kzt: number;
    diff_kzt: number;
    used_percent: number;
  };
}

export interface Expense {
  id: number;
  account_id: number;
  amount_kzt: number;
  description: string | null;
  counterparty: string | null;
  transaction_date: string | null;
  category_legacy: string | null;
  expense_category_id: number | null;
  expense_category_name: string | null;
  expense_category_color: string | null;
  expense_category_icon: string | null;
  created_at: string | null;
}

export interface ExpenseSummary {
  period_days: number;
  period_start: string;
  period_end: string;
  total_kzt: number;
  total_count: number;
  avg_per_day_kzt: number;
  month_to_date_kzt: number;
  revenue_kzt: number;
  expense_to_revenue_percent: number;
  by_category: {
    category_id: number;
    category_name: string;
    color: string;
    icon: string | null;
    amount_kzt: number;
    count: number;
    percent_of_total: number;
  }[];
  daily: { date: string | null; amount_kzt: number }[];
}

export interface ExpenseForecast {
  month_to_date_kzt: number;
  days_passed: number;
  days_left: number;
  days_in_month: number;
  avg_per_day_kzt: number;
  forecast_total_kzt: number;
  previous_month_kzt: number;
  trend_percent_vs_prev: number;
  by_category: {
    category_id: number;
    category_name: string;
    icon: string | null;
    color: string;
    mtd_kzt: number;
    avg_per_day_kzt: number;
    forecast_total_kzt: number;
    budget_kzt: number;
    will_exceed: boolean;
    over_by_kzt: number;
  }[];
}

export interface ExpenseAlert {
  category_id: number;
  category_name: string;
  icon: string | null;
  color: string;
  fact_kzt: number;
  limit_kzt: number;
  used_percent: number;
  alert_threshold: number;
  severity: 'critical' | 'warning' | 'info';
  over_by_kzt: number;
}

export interface ExpenseAlerts {
  period_year: number;
  period_month: number;
  alerts: ExpenseAlert[];
  critical_count: number;
  warning_count: number;
  info_count: number;
}

// ─── Module 8: Telegram Bot ───

export type TelegramRole = 'admin' | 'manager' | 'viewer';
export type TelegramSubscription = 'alerts' | 'sales' | 'expenses' | 'daily';

export interface TelegramUser {
  id: number;
  tg_user_id: number;
  chat_id: number;
  username: string | null;
  full_name: string | null;
  role: TelegramRole;
  notifications_enabled: boolean;
  subscriptions: TelegramSubscription[];
  language: string;
  is_active: boolean;
  last_command: string | null;
  last_seen: string | null;
  created_at: string | null;
}

export interface TelegramLinkInfo {
  bot_username: string;
  deep_link: string;
  qr_url: string;
  has_token: boolean;
  webhook_url: string;
}

export interface TelegramStatus {
  has_token: boolean;
  bot_username: string;
  users_count: number;
  active_users_count: number;
  by_role: Record<TelegramRole, number>;
  by_subscription: Record<TelegramSubscription, number>;
  users: TelegramUser[];
  recent_notifications: {
    chat_id: number;
    text: string;
    sent_at: string;
    real: boolean;
  }[];
}

export interface BroadcastResult {
  targets_count: number;
  sent_real: number;
  dry_run: number;
  has_token: boolean;
  note: string | null;
  recent_log: {
    chat_id: number;
    text: string;
    sent_at: string;
    real: boolean;
  }[];
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  listProducts: () => request<Product[]>('/api/products/'),

  createProduct: (payload: {
    name: string; category: string; tn_ved_code?: string; unit?: string;
    customs_duty_percent?: number; vat_import_percent?: number;
    vat_sale_percent?: number; kpn_percent?: number;
  }) => request<Product>('/api/products/', { method: 'POST', body: JSON.stringify(payload) }),

  getProductLastCost: (productId: number) =>
    request<{
      unit_cost_kzt: number | null;
      source: { batch_id: number; batch_number: string; import_date: string | null } | null;
    }>(`/api/products/${productId}/last-cost`),

  listTaxSettings: () => request<Product[]>('/api/tax-settings/'),

  updateTaxSettings: (productId: number, payload: TaxUpdatePayload) =>
    request<{ message: string; product: Product; changes?: { field: string; old: number; new: number }[] }>(
      `/api/tax-settings/${productId}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    ),

  getTaxHistory: (productId: number) =>
    request<TaxHistoryRow[]>(`/api/tax-settings/history/${productId}`),

  previewImport: (payload: {
    shipping_cost_usd?: number;
    additional_costs_kzt?: number;
    exchange_rate?: number;
    items: { product_id: number; quantity: number; price_per_unit_usd: number }[];
  }) =>
    request<BatchPreview>('/api/imports/preview', { method: 'POST', body: JSON.stringify(payload) }),

  listBatches: (params?: {
    status?: BatchStatus; supplier?: string;
    date_from?: string; date_to?: string; search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.supplier) qs.set('supplier', params.supplier);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<BatchSummary[]>(`/api/imports/${q ? '?' + q : ''}`);
  },

  getBatch: (id: number) => request<BatchDetail>(`/api/imports/${id}`),

  createBatch: (payload: CreateBatchPayload & {
    tracking_number?: string;
    eta_date?: string;
    destination_warehouse_id?: number;
    status?: BatchStatus;
  }) =>
    request<{
      id: number;
      batch_number: string;
      total_fob_usd: number;
      total_cost_usd: number;
      total_cost_kzt: number;
      items: { product_id: number; quantity: number; unit_cost_kzt: number }[];
    }>('/api/imports/', { method: 'POST', body: JSON.stringify(payload) }),

  updateBatchStatus: (id: number, payload: {
    status: BatchStatus;
    arrival_date?: string;
    eta_date?: string;
    tracking_number?: string;
    destination_warehouse_id?: number;
  }) => request<{
    batch: BatchSummary;
    previous_status: BatchStatus;
    stock_movements_created: number;
  }>(`/api/imports/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) }),

  updateBatch: (id: number, payload: {
    tracking_number?: string;
    invoice_number?: string;
    supplier_name?: string;
    eta_date?: string;
    arrival_date?: string;
    destination_warehouse_id?: number | null;
  }) => request<BatchSummary>(`/api/imports/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getImportSummary: () => request<ImportSummary>('/api/imports/summary'),

  getCostByProduct: () => request<CostByProductRow[]>('/api/imports/by-product'),

  listAccounts: () =>
    request<{
      id: number; account_number: string; bank_name: string;
      currency: string; balance: number;
    }[]>('/api/finance/accounts'),

  listCashTransactions: (days = 30) =>
    request<{
      period_days: number;
      rows: {
        id: number;
        account_id: number;
        bank_name: string | null;
        account_number: string;
        currency: string;
        type: 'income' | 'expense' | 'transfer';
        category: string | null;
        amount_kzt: number;
        description: string | null;
        counterparty: string | null;
        transaction_date: string | null;
      }[];
    }>(`/api/finance/cash-transactions/?days=${days}`),

  listReceivables: () =>
    request<{
      id: number;
      invoice_number: string | null;
      customer_name: string | null;
      product_name: string | null;
      sale_date: string | null;
      due_date: string | null;
      days_overdue: number;
      days_until_due: number;
      total_kzt: number;
      paid_kzt: number;
      outstanding_kzt: number;
      payment_status: string;
      aging_bucket: 'current' | '0-30' | '31-60' | '61-90' | '90+' | null;
    }[]>('/api/finance/receivables/'),

  getReceivablesSummary: () =>
    request<{
      total_outstanding_kzt: number;
      total_overdue_kzt: number;
      overdue_count: number;
      pending_count: number;
      aging: { bucket: string; amount_kzt: number; count: number }[];
    }>('/api/finance/receivables/summary'),

  markPaid: (saleId: number, amountKzt?: number) =>
    request<{
      id: number; payment_status: string; paid_kzt: number; outstanding_kzt: number;
    }>(`/api/finance/receivables/${saleId}/pay`, {
      method: 'POST',
      body: JSON.stringify(amountKzt !== undefined ? { amount_kzt: amountKzt } : {}),
    }),

  getPlanVsFact: (year: number, month: number) =>
    request<{
      year: number;
      month: number;
      period_start: string;
      period_end: string;
      main_rows: {
        metric: string; label: string;
        plan_kzt: number; fact_kzt: number; diff_kzt: number; achievement_percent: number;
      }[];
      expense_rows: {
        metric: string; label: string;
        plan_kzt: number; fact_kzt: number; diff_kzt: number; achievement_percent: number;
      }[];
    }>(`/api/finance/budget/plan-vs-fact?year=${year}&month=${month}`),

  getCashSummary: (days = 30) =>
    request<{
      period_days: number;
      income_kzt: number;
      expense_kzt: number;
      net_kzt: number;
      by_category: {
        category: string;
        total_kzt: number;
        count: number;
        percent_of_expenses: number;
      }[];
    }>(`/api/finance/cash-transactions/summary?days=${days}`),

  getProfitLoss: (days = 30) =>
    request<{
      period_days: number; period_start: string; period_end: string;
      revenue_kzt: number; cost_kzt: number;
      gross_margin_kzt: number; gross_margin_percent: number;
      vat_to_pay_kzt: number; kpn_tax_kzt: number;
      net_profit_kzt: number; sales_count: number;
    }>(`/api/finance/pl?days=${days}`),

  getMarginByProduct: (days = 30) =>
    request<{
      period_days: number;
      rows: {
        product_id: number; product_name: string;
        revenue_kzt: number; cost_kzt: number;
        margin_kzt: number; margin_percent: number;
        net_profit_kzt: number; sales_count: number;
      }[];
    }>(`/api/finance/margin-by-product?days=${days}`),

  listSales: () =>
    request<{
      id: number; invoice_number: string | null;
      product_id: number; product_name: string | null;
      customer_name: string | null;
      quantity: number; unit_price_kzt: number; unit_cost_kzt: number;
      total_revenue_kzt: number;
      gross_margin_kzt: number; gross_margin_percent: number;
      vat_to_pay_kzt: number; kpn_tax_kzt: number; net_profit_kzt: number;
      sale_date: string | null; status: string;
      payment_status: string | null; due_date: string | null; paid_kzt: number;
    }[]>('/api/sales/'),

  createSale: (payload: {
    product_id: number; quantity: number;
    unit_price_kzt: number; unit_cost_kzt: number;
    invoice_number?: string; customer_name?: string;
  }) =>
    request<{ id: number } & Record<string, number>>('/api/sales/', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  previewSale: (payload: {
    product_id: number; quantity: number;
    unit_price_kzt: number; unit_cost_kzt: number;
  }) =>
    request<{
      total_revenue_kzt: number; total_cost_kzt: number;
      gross_margin_kzt: number; gross_margin_percent: number;
      vat_to_pay_kzt: number; kpn_tax_kzt: number; net_profit_kzt: number;
    }>('/api/sales/preview', { method: 'POST', body: JSON.stringify(payload) }),

  // -------- Module 2: Warehouses & Stock --------

  listWarehouses: () => request<Warehouse[]>('/api/warehouses/'),

  createWarehouse: (payload: { code: string; name: string; city: string; address?: string }) =>
    request<Warehouse>('/api/warehouses/', { method: 'POST', body: JSON.stringify(payload) }),

  updateWarehouse: (id: number, payload: Partial<Pick<Warehouse, 'name' | 'city' | 'address' | 'is_active'>>) =>
    request<Warehouse>(`/api/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getStockSummary: () => request<StockSummary>('/api/stock/summary'),

  listStockCurrent: (params?: { warehouse_id?: number; product_id?: number; category?: string; low_threshold?: number }) => {
    const qs = new URLSearchParams();
    if (params?.warehouse_id) qs.set('warehouse_id', String(params.warehouse_id));
    if (params?.product_id) qs.set('product_id', String(params.product_id));
    if (params?.category) qs.set('category', params.category);
    if (params?.low_threshold !== undefined) qs.set('low_threshold', String(params.low_threshold));
    const q = qs.toString();
    return request<StockRow[]>(`/api/stock/current${q ? '?' + q : ''}`);
  },

  listStockMovements: (params?: {
    warehouse_id?: number; product_id?: number; movement_type?: MovementType;
    date_from?: string; date_to?: string; limit?: number; offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.warehouse_id) qs.set('warehouse_id', String(params.warehouse_id));
    if (params?.product_id) qs.set('product_id', String(params.product_id));
    if (params?.movement_type) qs.set('movement_type', params.movement_type);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request<{ total: number; items: StockMovement[] }>(`/api/stock/movements${q ? '?' + q : ''}`);
  },

  createStockMovement: (payload: {
    product_id: number; warehouse_id: number;
    movement_type: 'in' | 'out' | 'adjustment';
    quantity: number;
    document_ref?: string; counterparty?: string;
    note?: string; movement_date?: string;
    signed_quantity?: number;  // только для adjustment, может быть отрицательным
  }) =>
    request<StockMovement>('/api/stock/movements', { method: 'POST', body: JSON.stringify(payload) }),

  transferStock: (payload: {
    product_id: number; from_warehouse_id: number; to_warehouse_id: number;
    quantity: number; note?: string; document_ref?: string; movement_date?: string;
  }) =>
    request<{ out: StockMovement; in: StockMovement }>('/api/stock/transfer', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  getStockForecast: (lookbackDays = 30, targetDays = 60) =>
    request<{ lookback_days: number; target_days: number; items: ForecastRow[] }>(
      `/api/stock/forecast?lookback_days=${lookbackDays}&target_days=${targetDays}`,
    ),

  // -------- Module 3: Customers, Invoices, Payments, AR --------

  listCustomers: (params?: { status?: string; type?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Customer[]>(`/api/customers/${q ? '?' + q : ''}`);
  },

  getCustomer: (id: number) => request<Customer>(`/api/customers/${id}`),

  createCustomer: (payload: Partial<Customer> & { name: string }) =>
    request<Customer>('/api/customers/', { method: 'POST', body: JSON.stringify(payload) }),

  updateCustomer: (id: number, payload: Partial<Customer>) =>
    request<Customer>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  listInvoices: (params?: {
    status?: InvoiceStatus; customer_id?: number;
    date_from?: string; date_to?: string; search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.customer_id) qs.set('customer_id', String(params.customer_id));
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<InvoiceSummary[]>(`/api/invoices/${q ? '?' + q : ''}`);
  },

  getInvoice: (id: number) => request<InvoiceDetail>(`/api/invoices/${id}`),

  createInvoice: (payload: {
    customer_id: number; invoice_number?: string;
    issue_date?: string; due_date?: string; notes?: string;
    items: { product_id: number; quantity: number; unit_price_kzt: number; unit_cost_kzt?: number }[];
  }) => request<InvoiceDetail>('/api/invoices/', { method: 'POST', body: JSON.stringify(payload) }),

  updateInvoiceStatus: (id: number, status: InvoiceStatus) =>
    request<InvoiceSummary>(`/api/invoices/${id}/status`, {
      method: 'PUT', body: JSON.stringify({ status }),
    }),

  cancelInvoice: (id: number) =>
    request<InvoiceSummary>(`/api/invoices/${id}`, { method: 'DELETE' }),

  listPayments: (params?: {
    invoice_id?: number; customer_id?: number;
    method?: PaymentMethod; date_from?: string; date_to?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.invoice_id) qs.set('invoice_id', String(params.invoice_id));
    if (params?.customer_id) qs.set('customer_id', String(params.customer_id));
    if (params?.method) qs.set('method', params.method);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<Payment[]>(`/api/payments/${q ? '?' + q : ''}`);
  },

  createPayment: (payload: {
    invoice_id: number; amount_kzt: number;
    method?: PaymentMethod; reference?: string; notes?: string;
    payment_date?: string;
  }) => request<{ payment: Payment; invoice: InvoiceSummary }>('/api/payments/', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  deletePayment: (id: number) =>
    request<{ deleted: boolean; invoice: InvoiceSummary }>(`/api/payments/${id}`, { method: 'DELETE' }),

  getArAging: () => request<AgingResponse>('/api/ar/aging'),

  getArSummary: () => request<{
    customers: ARSummaryRow[];
    total_outstanding_kzt: number;
    total_overdue_kzt: number;
  }>('/api/ar/summary'),

  // -------- Module 5: Finance Tools --------

  listExchangeRates: (params?: { target?: Currency; source?: RateSource }) => {
    const qs = new URLSearchParams();
    if (params?.target) qs.set('target', params.target);
    if (params?.source) qs.set('source', params.source);
    const q = qs.toString();
    return request<ExchangeRate[]>(`/api/rates/${q ? '?' + q : ''}`);
  },

  getRateHistory: (params?: {
    base?: Currency; target?: Currency;
    date_from?: string; date_to?: string; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.base) qs.set('base', params.base);
    if (params?.target) qs.set('target', params.target);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ExchangeRate[]>(`/api/rates/history${q ? '?' + q : ''}`);
  },

  createExchangeRate: (payload: {
    base_currency: Currency; target_currency: Currency;
    rate: number; rate_date?: string; source?: RateSource; note?: string;
  }) => request<ExchangeRate>('/api/rates/', { method: 'POST', body: JSON.stringify(payload) }),

  deleteExchangeRate: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/rates/${id}`, { method: 'DELETE' }),

  convertCurrency: (params: {
    amount: number; from: Currency; to: Currency; date?: string;
  }) => {
    const qs = new URLSearchParams();
    qs.set('amount', String(params.amount));
    qs.set('from', params.from);
    qs.set('to', params.to);
    if (params.date) qs.set('date', params.date);
    return request<ConvertResult>(`/api/convert?${qs.toString()}`);
  },

  listPremiums: (params?: { active?: boolean; period?: PremiumPeriod; target_role?: PremiumRole }) => {
    const qs = new URLSearchParams();
    if (params?.active !== undefined) qs.set('active', String(params.active));
    if (params?.period) qs.set('period', params.period);
    if (params?.target_role) qs.set('target_role', params.target_role);
    const q = qs.toString();
    return request<Premium[]>(`/api/premiums/${q ? '?' + q : ''}`);
  },

  createPremium: (payload: Omit<Premium, 'id'>) =>
    request<Premium>('/api/premiums/', { method: 'POST', body: JSON.stringify(payload) }),

  updatePremium: (id: number, payload: Partial<Omit<Premium, 'id'>>) =>
    request<Premium>(`/api/premiums/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deletePremium: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/premiums/${id}`, { method: 'DELETE' }),

  listCommissions: (params?: { active?: boolean; type?: CommissionType }) => {
    const qs = new URLSearchParams();
    if (params?.active !== undefined) qs.set('active', String(params.active));
    if (params?.type) qs.set('type', params.type);
    const q = qs.toString();
    return request<Commission[]>(`/api/commissions/${q ? '?' + q : ''}`);
  },

  createCommission: (payload: Omit<Commission, 'id'>) =>
    request<Commission>('/api/commissions/', { method: 'POST', body: JSON.stringify(payload) }),

  updateCommission: (id: number, payload: Partial<Omit<Commission, 'id'>>) =>
    request<Commission>(`/api/commissions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteCommission: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/commissions/${id}`, { method: 'DELETE' }),

  // -------- Module 6: Warranty --------

  listWarrantyPlans: (params?: { active?: boolean; product_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.active !== undefined) qs.set('active', String(params.active));
    if (params?.product_id) qs.set('product_id', String(params.product_id));
    const q = qs.toString();
    return request<WarrantyPlan[]>(`/api/warranties/${q ? '?' + q : ''}`);
  },

  createWarrantyPlan: (payload: {
    product_id: number; name: string; months: number;
    coverage_percent?: number; price_kzt?: number;
    description?: string; is_active?: boolean;
  }) => request<WarrantyPlan>('/api/warranties/', { method: 'POST', body: JSON.stringify(payload) }),

  updateWarrantyPlan: (id: number, payload: Partial<Omit<WarrantyPlan, 'id' | 'product_name' | 'category'>>) =>
    request<WarrantyPlan>(`/api/warranties/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteWarrantyPlan: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/warranties/${id}`, { method: 'DELETE' }),

  listClaims: (params?: {
    status?: ClaimStatus; claim_type?: ClaimType;
    product_id?: number; customer_id?: number;
    date_from?: string; date_to?: string; search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.claim_type) qs.set('claim_type', params.claim_type);
    if (params?.product_id) qs.set('product_id', String(params.product_id));
    if (params?.customer_id) qs.set('customer_id', String(params.customer_id));
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<WarrantyClaim[]>(`/api/claims/${q ? '?' + q : ''}`);
  },

  getClaim: (id: number) => request<WarrantyClaimDetail>(`/api/claims/${id}`),

  createClaim: (payload: {
    product_id: number;
    invoice_id?: number; customer_id?: number; customer_name?: string;
    quantity?: number; claim_type?: ClaimType; status?: ClaimStatus;
    description?: string; claim_date?: string;
  }) => request<WarrantyClaim>('/api/claims/', { method: 'POST', body: JSON.stringify(payload) }),

  updateClaim: (id: number, payload: {
    description?: string; resolution?: string; customer_name?: string;
    claim_type?: ClaimType; quantity?: number; claim_date?: string;
  }) => request<WarrantyClaim>(`/api/claims/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  updateClaimStatus: (id: number, payload: {
    status: ClaimStatus; resolution?: string; resolved_date?: string;
  }) => request<WarrantyClaim>(`/api/claims/${id}/status`, {
    method: 'PUT', body: JSON.stringify(payload),
  }),

  getClaimsSummary: () => request<ClaimsSummary>('/api/claims/summary'),

  listReturns: (params?: {
    claim_id?: number; status?: ReturnStatus; refund_method?: RefundMethod;
    date_from?: string; date_to?: string; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.claim_id) qs.set('claim_id', String(params.claim_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.refund_method) qs.set('refund_method', params.refund_method);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<WarrantyReturn[]>(`/api/returns/${q ? '?' + q : ''}`);
  },

  createReturn: (payload: {
    claim_id: number; quantity?: number; reason?: string;
    refund_amount_kzt?: number; refund_method?: RefundMethod;
    return_date?: string; status?: ReturnStatus; note?: string;
  }) => request<WarrantyReturn>('/api/returns/', { method: 'POST', body: JSON.stringify(payload) }),

  updateReturn: (id: number, payload: Partial<Omit<WarrantyReturn, 'id' | 'claim_id' | 'claim_number' | 'product_name' | 'customer_name' | 'created_at'>>) =>
    request<WarrantyReturn>(`/api/returns/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getWarrantyByProduct: () => request<WarrantyByProductRow[]>('/api/warranty/by-product'),

  getWarrantyTimeline: (limit = 50) =>
    request<WarrantyTimelineEvent[]>(`/api/warranty/timeline?limit=${limit}`),

  // -------- Module 7: Expenses --------

  listExpenseCategories: (active = true) =>
    request<ExpenseCategory[]>(`/api/expenses/categories?active=${active}`),

  createExpenseCategory: (payload: {
    code: string; name: string; color?: string; icon?: string;
    description?: string; monthly_limit_kzt?: number;
    alert_percent?: number; is_active?: boolean; sort_order?: number;
  }) => request<ExpenseCategory>('/api/expenses/categories', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  updateExpenseCategory: (id: number, payload: Partial<{
    name: string; color: string; icon: string; description: string;
    monthly_limit_kzt: number; alert_percent: number;
    is_active: boolean; sort_order: number;
  }>) => request<ExpenseCategory>(`/api/expenses/categories/${id}`, {
    method: 'PUT', body: JSON.stringify(payload),
  }),

  deleteExpenseCategory: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/expenses/categories/${id}`, { method: 'DELETE' }),

  getBudgets: (year?: number, month?: number) => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));
    const q = qs.toString();
    return request<BudgetMonth>(`/api/expenses/budgets${q ? '?' + q : ''}`);
  },

  upsertBudget: (payload: {
    category_id: number; year: number; month: number;
    limit_amount_kzt: number; alert_percent?: number; note?: string;
  }) => request<ExpenseBudget>('/api/expenses/budgets', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  deleteBudget: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/expenses/budgets/${id}`, { method: 'DELETE' }),

  listExpenses: (params?: {
    category_id?: number; date_from?: string; date_to?: string;
    search?: string; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.category_id) qs.set('category_id', String(params.category_id));
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.search) qs.set('search', params.search);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<Expense[]>(`/api/expenses/${q ? '?' + q : ''}`);
  },

  createExpense: (payload: {
    account_id: number; amount_kzt: number;
    expense_category_id?: number; category?: string;
    description?: string; counterparty?: string;
    transaction_date?: string;
  }) => request<Expense>('/api/expenses/', { method: 'POST', body: JSON.stringify(payload) }),

  updateExpense: (id: number, payload: Partial<{
    amount_kzt: number; description: string; counterparty: string;
    expense_category_id: number | null; transaction_date: string;
    account_id: number;
  }>) => request<Expense>(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteExpense: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/expenses/${id}`, { method: 'DELETE' }),

  getExpenseSummary: (days = 30) =>
    request<ExpenseSummary>(`/api/expenses/summary?days=${days}`),

  getExpenseForecast: () => request<ExpenseForecast>('/api/expenses/forecast'),

  getExpenseAlerts: () => request<ExpenseAlerts>('/api/expenses/alerts'),

  // -------- Module 8: Telegram Bot --------

  getTelegramLink: () => request<TelegramLinkInfo>('/api/telegram/link'),

  getTelegramStatus: () => request<TelegramStatus>('/api/telegram/status'),

  subscribeTelegram: (payload: {
    tg_user_id: number;
    subscriptions?: TelegramSubscription[];
    notifications_enabled?: boolean;
    role?: TelegramRole;
    is_active?: boolean;
  }) => request<TelegramUser>('/api/telegram/subscribe', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  broadcastTelegram: (payload: {
    text: string;
    filter_role?: TelegramRole;
    filter_subscription?: TelegramSubscription;
  }) => request<BroadcastResult>('/api/telegram/broadcast', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  deleteTelegramUser: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/telegram/users/${id}`, { method: 'DELETE' }),

  // Симуляция /команды локально (для тестирования) — отправляет webhook
  simulateTelegramCommand: (payload: {
    tg_user_id: number; chat_id?: number;
    username?: string; first_name?: string; text: string;
  }) => request<{
    ok: boolean; user_id: number;
    response_text: string; sent_to_telegram: boolean;
  }>('/api/telegram/webhook', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        from: {
          id: payload.tg_user_id,
          username: payload.username,
          first_name: payload.first_name,
        },
        chat: { id: payload.chat_id ?? payload.tg_user_id },
        text: payload.text,
      },
    }),
  }),
};
