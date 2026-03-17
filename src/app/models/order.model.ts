export interface Order {
  id: number;
  external_id: string;
  status: OrderStatus;
  total: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  // 'source' is not provided by API; we'll infer it client-side
  source?: 'web' | 'redes' | 'woocommerce';
  delivery_location?: string;
  delivery_coordinates?: {
    lat: number;
    lng: number;
  };
  delivery_date?: string;
  estimated_delivery_date?: string; // Fecha estimada de entrega (de WooCommerce metadata)
  error_reason?: string;
  delivery_image_path?: string;
  meta: any; // JSON from WooCommerce
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
  timelines?: OrderTimeline[];
  logs?: OrderLog[];
  user_id?: number;
  user?: {
    id: number;
    name: string;
    role: string;
  };
  // WooCommerce specific fields
  store_slug?: string;
  woo_source?: string; // Store name/url
  woo_status?: string; // WooCommerce status (pending, processing, on-hold, completed, cancelled, refunded)
  woo_status_label?: string; // Etiqueta legible enviada por el backend (ej: "Pendiente de Pago")
  woo_order_number?: string;
  woo_order_id?: number;

  // Frontend helper fields for Woo/internal reconciliation.
  internal_order_id?: number;
  can_update_status?: boolean;
  update_status_message?: string;
}

export interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

export enum OrderStatus {
  EN_PROCESO = 'EN_PROCESO',
  EMPAQUETADO = 'EMPAQUETADO',
  DESPACHADO = 'DESPACHADO',
  EN_CAMINO = 'EN_CAMINO',
  ENTREGADO = 'ENTREGADO',
  ERROR = 'ERROR',
  CANCELADO = 'CANCELADO'
}

export interface OrderTimeline {
  id: number;
  order_id: number;
  status: OrderStatus;
  message: string;
  source: string;
  occurred_at: string;
}

export interface OrderLog {
  id: number;
  order_id: number;
  user_id?: number;
  action: string;
  old_status?: OrderStatus;
  new_status?: OrderStatus;
  description: string;
  changes: any; // JSON
  ip_address: string;
  created_at: string;
}