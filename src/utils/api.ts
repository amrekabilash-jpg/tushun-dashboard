/**
 * Минимальный API-клиент для Flask backend на 127.0.0.1:5000.
 * Не использует токены пока — добавится когда auth перейдёт на сервер.
 */
const BASE_URL = 'http://127.0.0.1:5000';

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

export interface BatchSummary {
  id: number;
  batch_number: string;
  invoice_number: string | null;
  supplier_name: string | null;
  total_fob_usd: number;
  total_cost_usd: number;
  total_cost_kzt: number;
  exchange_rate: number;
  status: string;
  import_date: string | null;
  items_count: number;
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

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  listProducts: () => request<Product[]>('/api/products/'),

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

  listBatches: () => request<BatchSummary[]>('/api/imports/'),

  createBatch: (payload: CreateBatchPayload) =>
    request<{
      id: number;
      batch_number: string;
      total_fob_usd: number;
      total_cost_usd: number;
      total_cost_kzt: number;
      items: { product_id: number; quantity: number; unit_cost_kzt: number }[];
    }>('/api/imports/', { method: 'POST', body: JSON.stringify(payload) }),

  listAccounts: () =>
    request<{
      id: number; account_number: string; bank_name: string;
      currency: string; balance: number;
    }[]>('/api/finance/accounts'),

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
};
