import { DashboardOrderDetail, DashboardOrderProduct, DashboardOrderRow, DashboardOrderStatusValue } from '../models/dashboard-order.model';

const STATUS_CLASS_MAP: Record<string, string> = {
  en_proceso: 'bg-warning text-dark',
  empaquetado: 'bg-info',
  despachado: 'bg-primary',
  en_camino: 'bg-info text-dark',
  entregado: 'bg-success',
  error_en_pedido: 'bg-danger',
  cancelado: 'bg-secondary'
};

const STATUS_LABEL_MAP: Record<DashboardOrderStatusValue, string> = {
  en_proceso: 'En Proceso',
  empaquetado: 'Empaquetado',
  despachado: 'Despachado',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  error_en_pedido: 'Error en Pedido',
  cancelado: 'Cancelado'
};

export function getDashboardStatusOptions(): Array<{ value: DashboardOrderStatusValue; label: string }> {
  return Object.entries(STATUS_LABEL_MAP).map(([value, label]) => ({
    value: value as DashboardOrderStatusValue,
    label
  }));
}

export function getDashboardStatusClass(status: string | null | undefined): string {
  return STATUS_CLASS_MAP[String(status || '').trim().toLowerCase()] || 'bg-secondary';
}

export function getDashboardStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase() as DashboardOrderStatusValue;
  return STATUS_LABEL_MAP[normalized] || fallbackText(status, '-');
}

export function getDashboardSourceBadgeClass(row: Pick<DashboardOrderRow, 'readonly' | 'source'>): string {
  if (row.readonly || row.source === 'bsale') {
    return 'bg-info text-dark';
  }

  return 'bg-warning text-dark';
}

export function getDashboardSourceLabel(row: Pick<DashboardOrderRow, 'readonly' | 'source' | 'vendor_name' | 'store_slug'>): string {
  if (row.readonly || row.source === 'bsale') {
    return fallbackText(row.vendor_name || row.store_slug, 'Bsale');
  }

  return fallbackText(row.vendor_name || row.store_slug, 'WooCommerce');
}

export function fallbackText(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : fallback;
}

export function formatDashboardDate(value: string | null | undefined, fallback: string = 'Sin fecha', includeTime: boolean = true): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat('es-PE', includeTime ? {
    dateStyle: 'short',
    timeStyle: 'short'
  } : {
    dateStyle: 'short'
  }).format(date);
}

export function formatDashboardCurrency(value: number | string | null | undefined, currencySymbol: string = 'S/'): string {
  const amount = Number(value ?? 0);
  return `${currencySymbol} ${Number.isFinite(amount) ? amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
}

export function getDashboardOrderTitle(rowOrDetail: Pick<DashboardOrderRow, 'order_number'> | Pick<DashboardOrderDetail, 'order_number' | 'id'>): string {
  const orderNumber = 'order_number' in rowOrDetail ? rowOrDetail.order_number : null;
  const fallbackId = 'id' in rowOrDetail ? rowOrDetail.id : null;
  return fallbackText(orderNumber || fallbackId, '-');
}

export function normalizeDashboardPaymentMethods(value: unknown): string[] {
  const methods = collectPaymentMethodLabels(value)
    .map((item) => fallbackText(item, ''))
    .filter(Boolean);

  return Array.from(new Set(methods));
}

export function normalizeDashboardProducts(products: DashboardOrderProduct[] | null | undefined): DashboardOrderProduct[] {
  return Array.isArray(products) ? products : [];
}

export function getAssignedDeliveryName(detail: Pick<DashboardOrderDetail, 'assigned_delivery_name' | 'assigned_delivery'>): string {
  return String(detail.assigned_delivery_name || detail.assigned_delivery?.name || '').trim();
}

export function isReadonlyDashboardOrder(detail: DashboardOrderDetail | DashboardOrderRow | null | undefined): boolean {
  return !!detail?.readonly;
}

export function resolveDashboardDetailStatus(detail: DashboardOrderDetail | null | undefined): { value: string; label: string; raw: string | null } {
  const status = detail?.status;
  if (status && typeof status === 'object') {
    return {
      value: fallbackText(status.value, ''),
      label: fallbackText(status.label, fallbackText(status.raw, '-')),
      raw: status.raw ?? null
    };
  }

  const value = String(status || '').trim().toLowerCase();
  return {
    value,
    label: getDashboardStatusLabel(value),
    raw: value || null
  };
}

function collectPaymentMethodLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPaymentMethodLabels(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = [record['label'], record['name'], record['method'], record['title']]
      .map((item) => fallbackText(item, ''))
      .filter(Boolean);

    if (preferred.length > 0) {
      return preferred;
    }

    return Object.values(record).flatMap((item) => collectPaymentMethodLabels(item));
  }

  const normalized = fallbackText(value, '');
  if (!normalized) {
    return [];
  }

  return normalized.split(',').map((item) => item.trim()).filter(Boolean);
}