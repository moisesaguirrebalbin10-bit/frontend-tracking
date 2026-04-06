export type DashboardOrderSource = 'all' | 'woo' | 'bsale';

export type DashboardOrdersScope = 'all' | 'my_queue';

export type DashboardOrderPeriod = 'day' | 'week' | 'month' | 'range';

export type DashboardOrderStatusValue =
  | 'en_proceso'
  | 'empaquetado'
  | 'despachado'
  | 'en_camino'
  | 'entregado'
  | 'error_en_pedido'
  | 'cancelado';

export interface DashboardOrderStatus {
  value: string;
  label: string;
  raw: string | null;
}

export interface DashboardOrderAllowedTransition {
  value: DashboardOrderStatusValue;
  label: string;
  requires_delivery_user_id?: boolean;
}

export interface DashboardOrderRow {
  source: Exclude<DashboardOrderSource, 'all'>;
  source_record_id: number;
  readonly: boolean;
  order_number: string | null;
  bsale_receipt: string | null;
  customer_name: string | null;
  ordered_at: string | null;
  delivery_date: string | null;
  delivered_at: string | null;
  location: string | null;
  total: number;
  status: DashboardOrderStatus;
  vendor_name: string | null;
  store_slug: string | null;
  dispatch_date?: string | null;
  customer?: DashboardOrderParty | null;
  seller?: DashboardOrderParty | null;
  payment?: DashboardOrderPayment | null;
  products?: DashboardOrderProduct[] | null;
  assigned_delivery_user_id?: number | null;
  assigned_delivery_name?: string | null;
  detail_endpoint: string;
}

export interface DashboardOrdersFilters {
  source: DashboardOrderSource;
  scope?: DashboardOrdersScope;
  period: DashboardOrderPeriod;
  date_from?: string;
  date_to?: string;
  search?: string;
  status?: DashboardOrderStatusValue;
}

export interface DashboardOrdersQuery extends DashboardOrdersFilters {
  page?: number;
  per_page?: number;
}

export interface DashboardOrdersResponse {
  current_page: number;
  data: DashboardOrderRow[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface DashboardOrdersMetrics {
  total_orders: number;
  delivered_orders: number;
  in_process_orders: number;
  error_orders: number;
  cancelled_orders: number;
  total_amount: number;
}

export interface DashboardOrdersMetricsResponse {
  filters: Record<string, unknown>;
  metrics: DashboardOrdersMetrics;
}

export interface DashboardOrderParty {
  name?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  issue_date?: string | null;
  receipt?: string | null;
}

export interface DashboardOrderPayment {
  methods?: string[] | string | Record<string, unknown> | Array<Record<string, unknown>> | null;
  total?: number | string | null;
}

export interface DashboardOrderProduct {
  name?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  discount?: number | string | null;
  total?: number | string | null;
}

export interface DashboardOrderDetail {
  source: Exclude<DashboardOrderSource, 'all'>;
  readonly: boolean;
  id: number;
  external_id?: string | number | null;
  order_number?: string | null;
  bsale_receipt?: string | null;
  status?: DashboardOrderStatus | string | null;
  dispatch_date?: string | null;
  location?: string | null;
  customer?: DashboardOrderParty | null;
  seller?: DashboardOrderParty | null;
  assigned_delivery_user_id?: number | null;
  assigned_delivery_name?: string | null;
  assigned_delivery?: DashboardOrderParty | null;
  allowed_transitions?: DashboardOrderAllowedTransition[] | null;
  payment?: DashboardOrderPayment | null;
  products?: DashboardOrderProduct[] | null;
  meta?: Record<string, unknown> | null;
}

export interface DashboardOrderDetailResponse {
  order: DashboardOrderDetail;
}