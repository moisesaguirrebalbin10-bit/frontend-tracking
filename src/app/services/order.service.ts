import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Order, OrderStatus, OrderTimeline, OrderLog } from '../models/order.model';
import { WooCommerceService, WooCommerceOrder, WooCommerceOrdersFilters, WooCommerceOrdersResponse } from './woocommerce.service';
import { BsaleService, BsaleOrder, BsaleOrdersResponse, BsalePaginationState } from './bsale.service';

export interface OrdersResponse {
  data: Order[];
  current_page: number;
  last_page: number;
  total: number;
}
//bsale orderpage response
export interface BsaleOrdersPageResult {
  orders: Order[];
  pagination: BsalePaginationState;
}


@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private wooCommerceService: WooCommerceService,
    private bsaleService: BsaleService
  ) {}

  getOrders(page: number = 1, perPage: number = 50): Observable<OrdersResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    return this.http.get<OrdersResponse>(`${this.apiUrl}/orders`, { params });
  }

  getOrdersWithFilters(filters: {
    page?: number;
    perPage?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    store?: string;
  }): Observable<OrdersResponse> {
    let params = new HttpParams()
      .set('page', (filters.page ?? 1).toString())
      .set('per_page', (filters.perPage ?? 50).toString());
    if (filters.status)   params = params.set('status',    filters.status);
    if (filters.search)   params = params.set('search',    filters.search);
    if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
    if (filters.dateTo)   params = params.set('date_to',   filters.dateTo);
    if (filters.store)    params = params.set('store',     filters.store);
    return this.http.get<OrdersResponse>(`${this.apiUrl}/orders`, { params });
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  findInternalOrderIdByExternalId(
    externalId: string | number,
    perPage: number = 50,
    maxPages: number = 25
  ): Observable<number | null> {
    const target = String(externalId ?? '').trim();
    if (!target) {
      return of(null);
    }

    return this.findInternalOrderIdByExternalIdPage(target, 1, perPage, maxPages);
  }

  updateOrderStatus(
    id: number,
    status: OrderStatus,
    options?: { errorReason?: string; evidenceImage?: File }
  ): Observable<Order> {
    // Convert status to lowercase with underscores: EN_PROCESO → en_proceso
    const statusValue = status.toLowerCase();
    const errorReason = options?.errorReason;
    const evidenceImage = options?.evidenceImage;

    const body: any = { status: statusValue };
    if (errorReason) body.error_reason = errorReason;

    // Only use FormData if there's an image to upload
    if (evidenceImage) {
      const formData = new FormData();
      formData.append('status', statusValue);
      if (errorReason) formData.append('error_reason', errorReason);

      // Keep compatibility with backend aliases for evidence uploads.
      if (status === OrderStatus.ENTREGADO) {
        formData.append('delivery_image', evidenceImage);
      } else {
        formData.append('evidence_image', evidenceImage);
      }

      return this.http.put<Order>(`${this.apiUrl}/orders/${id}/status`, formData);
    }

    // For JSON requests (no image), send plain object
    return this.http.put<Order>(`${this.apiUrl}/orders/${id}/status`, body);
  }

  getOrderHistory(id: number): Observable<OrderTimeline[]> {
    return this.http.get<OrderTimeline[]>(`${this.apiUrl}/orders/${id}/history`);
  }

  getOrderLogs(id: number, page: number = 1): Observable<{ data: OrderLog[]; current_page: number; last_page: number; total: number }> {
    const params = new HttpParams().set('page', page.toString());
    return this.http.get<{ data: OrderLog[]; current_page: number; last_page: number; total: number }>(`${this.apiUrl}/orders/${id}/logs`, { params });
  }

  getAvailableTransitions(id: number): Observable<OrderStatus[]> {
    return this.http.get<OrderStatus[]>(`${this.apiUrl}/orders/${id}/available-transitions`);
  }

  syncOrders(): Observable<any> {
    return this.http.post(`${this.apiUrl}/orders/sync`, {});
  }

  lookupPublicOrder(boleta: string, dni: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/orders/public/lookup`, {
      boleta,
      dni
    });
  }

  /**
   * Get WooCommerce orders
   */
  getWooCommerceOrders(
    page: number = 1,
    perPage: number = 20,
    filters?: WooCommerceOrdersFilters
  ): Observable<WooCommerceOrdersResponse> {
    return this.wooCommerceService.getOrders(page, perPage, filters);
  }

  getAllWooCommerceOrders(filters?: WooCommerceOrdersFilters): Observable<Order[]> {
    return this.wooCommerceService.getAllOrders(filters).pipe(
      map((orders) => orders.map((order) => this.transformWooCommerceOrder(order, order.store_label)))
    );
  }

  /**
   * Get a single WooCommerce order
   */
  getWooCommerceOrder(id: number | string, storeSlug: string): Observable<Order> {
    return this.wooCommerceService.getOrder(id, storeSlug).pipe(
      map((order) => this.transformWooCommerceOrder(order, order.store_label))
    );
  }

  /**
   * Transform WooCommerce order to internal Order format
   */
  transformWooCommerceOrder(wooOrder: WooCommerceOrder, storeName: string = wooOrder.store_label ?? wooOrder.store_slug ?? 'WooCommerce'): Order {
    const customerName = `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim();
    
    return {
      id: wooOrder.id,
      external_id: wooOrder.order_number || wooOrder.number || String(wooOrder.id),
      status: this.mapWooCommerceStatus(wooOrder.status),
      total: parseFloat(wooOrder.total) || 0,
      customer_name: customerName || 'Sin nombre',
      customer_email: wooOrder.billing?.email,
      customer_phone: wooOrder.billing?.phone,
      source: 'woocommerce',
      delivery_location: (() => {
        
        const shipping = `${wooOrder.shipping?.address_1 || ''} ${wooOrder.shipping?.city || ''}`.trim();
        if (shipping) return shipping;
        const billing = `${wooOrder.billing?.address_1 || ''} ${wooOrder.billing?.city || ''}`.trim();
        return billing || '-';
      })(),
      
      delivery_coordinates: (() => {
        // lat/lng puede aparecer bajo varias claves de meta_data (shipping o custom billing)
        const meta = wooOrder['meta_data'];
        if (Array.isArray(meta)) {
          const latMeta = meta.find(m =>
            m.key === '_shipping_latitude' ||
            m.key === 'shipping_latitude' ||
            m.key === '_billing_cordenada_latitud'
          );
          const lngMeta = meta.find(m =>
            m.key === '_shipping_longitude' ||
            m.key === 'shipping_longitude' ||
            m.key === '_billing_cordenada_longitud'
          );
          const lat = latMeta?.value;
          const lng = lngMeta?.value;
          if (lat && lng) {
            return { lat: parseFloat(lat), lng: parseFloat(lng) };
          }
        }
        return null;
      })(),
      delivery_date: (() => {
        // Solo mostrar fecha de entrega si el estado es ENTREGADO
        const status = this.mapWooCommerceStatus(wooOrder.status);
        if (status === OrderStatus.ENTREGADO && wooOrder['date_completed']) {
          return wooOrder['date_completed'];
        }
        return null;
      })(),
      estimated_delivery_date: (() => {
        // extraer fecha estimada de entrega; puede venir como campo genérico o dos fechas billing
        const meta = wooOrder['meta_data'];
        if (Array.isArray(meta)) {
          // buscar campo genérico primero
          const deliveryMeta = meta.find(m =>
            m.key === '_delivery_date' ||
            m.key === 'delivery_date' ||
            m.key === 'estimated_delivery_date' ||
            m.key === '_estimated_delivery_date' ||
            m.key === '_billing_fecha_entrega'
          );
          if (deliveryMeta?.value) {
            return deliveryMeta.value;
          }
          // fall back a los campos billing fecha1/fecha2
          const f1 = meta.find(m => m.key === '_billing_fecha_entrega_1')?.value;
          const f2 = meta.find(m => m.key === '_billing_fecha_entrega_2')?.value;
          if (f1 && f2) return `${f1} y ${f2}`;
          if (f1) return f1;
        }
        return null;
      })(),
      created_at: wooOrder.date_created,
      updated_at: wooOrder['date_modified'] || wooOrder.date_created,
      meta: wooOrder,
      items: (wooOrder.line_items || []).map(item => ({
        id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0,
        image_url: item.image?.src
      })),
      store_slug: wooOrder.store_slug,
      woo_source: storeName,
      woo_status: wooOrder.status,
      woo_order_number: wooOrder.order_number || wooOrder.number,
      woo_order_id: wooOrder.id
    };
  }

  /**
   * Map WooCommerce status to internal OrderStatus
   */
  private mapWooCommerceStatus(wooStatus: string): OrderStatus {
    const statusMap: { [key: string]: OrderStatus } = {
      'pending': OrderStatus.EN_PROCESO,
      'processing': OrderStatus.EN_PROCESO,
      'on-hold': OrderStatus.EN_PROCESO,
      'completed': OrderStatus.ENTREGADO,
      'cancelled': OrderStatus.CANCELADO,
      'refunded': OrderStatus.CANCELADO,
      'failed': OrderStatus.ERROR
    };

    return statusMap[wooStatus] || OrderStatus.EN_PROCESO;
  }

  /**
   * ---------INICIO BSALE ---------
   * Trae la primera página de Bsale (más recientes).
   */
  getBsaleOrdersFirstPage(): Observable<BsaleOrdersPageResult> {
    return this.bsaleService.getFirstPage().pipe(
      map(({ response, pagination }) => ({
        orders: this.transformBsaleResponse(response),
        pagination
      }))
    );
  }
  /**
   * Trae una página específica de Bsale usando paginación inversa.
   * @param page 
   * @param total
   */
  getBsaleOrdersPage(page: number, total: number): Observable<BsaleOrdersPageResult> {
    return this.bsaleService.getPage(page, total).pipe(
      map(({ response, pagination }) => ({
        orders: this.transformBsaleResponse(response),
        pagination
      }))
    );
  }
  /**
   * Transforma el array de items Bsale al modelo interno Order[].
   */
  private transformBsaleResponse(response: BsaleOrdersResponse): Order[] {
    return response.items.map(item => this.transformBsaleOrder(item));
  }

  transformBsaleOrder(bsaleOrder: BsaleOrder): Order {
    // Parsear el monto total ("S/ 100.00" → 100)
    const montoRaw = bsaleOrder.pago?.montoTotal ?? '';
    const totalNumeric = parseFloat(montoRaw.replace(/[^0-9.]/g, '')) || 0;
 
    // Parsear fechaEmision a ISO para que el pipe date funcione
    // Formato original: "24/03/2026, 12:00 AM"
    const parsedDate = this.parseBsaleDate(bsaleOrder.fechaEmision);
 
    return {
      id: 0, // Bsale no tiene ID numérico interno en este endpoint
      external_id: bsaleOrder.boleta,
      status: OrderStatus.EN_PROCESO, // Solo lectura por ahora
      total: totalNumeric,
      customer_name: bsaleOrder.cliente?.nombre || 'Sin nombre',
      customer_email: bsaleOrder.cliente?.email || undefined,
      customer_phone: bsaleOrder.cliente?.telefono || undefined,
      source: 'bsale',
      delivery_location: undefined,
      created_at: parsedDate,
      updated_at: parsedDate,
      meta: bsaleOrder, 
 
      items: (bsaleOrder.prendas || []).map((prenda, index) => ({
        id: index,
        product_name: `${prenda.nombre} (SKU: ${prenda.sku})`,
        quantity: prenda.cantidad,
        price: prenda.totalAPagar
      })),
 
      // Campos exclusivos de Bsale
      bsale_boleta: bsaleOrder.boleta,
      bsale_vendedor: bsaleOrder.vendedor,
      bsale_fecha_despacho: bsaleOrder.atributos?.fechaDespacho,
      bsale_marca_red_social: bsaleOrder.atributos?.marcaRedSocial,
      bsale_estado_pedido: bsaleOrder.atributos?.estadoPedido,
      bsale_pago_metodos: bsaleOrder.pago?.metodos,
      bsale_pago_monto: bsaleOrder.pago?.montoTotal,
      bsale_raw: bsaleOrder,
 
      // No tiene tracking interno
      can_update_status: false,
      update_status_message: 'Los pedidos de Bsale solo lectura.'
    };
  }
  /**
   *  date pipe.
   */
  private parseBsaleDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    try {
      const [datePart, timePart] = dateStr.split(', ');
      const [day, month, year] = datePart.split('/');
      
      // Parsear la hora del formato "01:16 PM"
      let hours = 0, minutes = 0;
      if (timePart) {
        const [time, period] = timePart.split(' ');
        const [hourStr, minuteStr] = time.split(':');
        hours = parseInt(hourStr);
        minutes = parseInt(minuteStr);
        
        // Convertir a formato 24 horas
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
      }
      
      const isoString = `${year}-${month}-${day}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      return new Date(isoString).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
 /**
   * ---------------FIN BSALE ------------------
   */

  private findInternalOrderIdByExternalIdPage(
    targetExternalId: string,
    page: number,
    perPage: number,
    maxPages: number
  ): Observable<number | null> {
    return this.getOrders(page, perPage).pipe(
      map((response) => {
        const targetNumeric = Number(targetExternalId);
        const match = (response.data || []).find((order) => {
          if (String(order.external_id ?? '').trim() === targetExternalId) {
            return true;
          }
          if (!Number.isNaN(targetNumeric) && order.woo_order_id === targetNumeric) {
            return true;
          }
          return false;
        });

        return {
          matchId: match?.id ?? null,
          lastPage: response.last_page || page
        };
      }),
      switchMap(({ matchId, lastPage }) => {
        if (matchId) {
          return of(matchId);
        }

        const hasNext = page < lastPage && page < maxPages;
        if (!hasNext) {
          return of(null);
        }

        return this.findInternalOrderIdByExternalIdPage(targetExternalId, page + 1, perPage, maxPages);
      })
    );
  }
}