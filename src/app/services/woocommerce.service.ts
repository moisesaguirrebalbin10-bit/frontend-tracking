import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WooCommerceStore {
  slug: string;
  label: string;
}

export interface WooCommerceOrder {
  id: number;
  order_number: string;
  number?: string;
  status: string;
  date_created: string;
  total: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    country: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    price: string;
    image?: {
      src: string;
    };
  }>;
  store_slug?: string;
  store_label?: string;
  [key: string]: any;
}

export interface WooCommerceOrdersFilters {
  stores?: string[] | string;
  status?: string;
  customer?: string;
  search?: string;
  orderby?: string;
  order?: string;
}

export interface WooCommerceOrdersMeta {
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
}

export interface WooCommerceOrdersByStore {
  label: string;
  data: WooCommerceOrder[];
  meta: WooCommerceOrdersMeta;
}

export interface WooCommerceOrdersResponse {
  data: WooCommerceOrder[];
  meta: WooCommerceOrdersMeta;
  by_store: Record<string, WooCommerceOrdersByStore>;
}

interface StoresResponse {
  data?: WooCommerceStore[];
}

interface RawStoreOrdersPayload {
  store?: string;
  data?: WooCommerceOrder[];
  orders?: WooCommerceOrder[];
  meta?: Partial<WooCommerceOrdersMeta> & { last_page?: number };
  total?: number;
  current_page?: number;
  total_pages?: number;
  last_page?: number;
  per_page?: number;
  label?: string;
  store_label?: string;
  store_name?: string;
}

type RawWooGroupedPayload = Record<string, RawStoreOrdersPayload | WooCommerceOrder[]>;

interface RawWooOrdersResponse {
  data?: RawWooGroupedPayload;
  meta?: Partial<WooCommerceOrdersMeta> & { last_page?: number };
}

function isGroupedPayload(value: unknown): value is RawWooGroupedPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({
  providedIn: 'root'
})
export class WooCommerceService {
  private apiUrl = environment.apiUrl;
  private storesCache: WooCommerceStore[] = [];

  constructor(private http: HttpClient) {}

  listStores(): Observable<WooCommerceStore[]> {
    return this.http.get<StoresResponse | WooCommerceStore[]>(`${this.apiUrl}/stores`).pipe(
      map((response) => Array.isArray(response) ? response : (response.data ?? [])),
      tap((stores) => {
        this.storesCache = stores;
      }),
      catchError((err) => {
        console.error('[WooCommerceService] error al obtener tiendas', err);
        return of(this.storesCache);
      })
    );
  }

  /**
   * Get WooCommerce orders with pagination
   * @param page Page number
   * @param perPage Items per page
   * @param filters Additional filters (status, customer, search, orderby, order)
   */
  getOrders(
    page: number = 1,
    perPage: number = 20,
    filters?: WooCommerceOrdersFilters
  ): Observable<WooCommerceOrdersResponse> {
    return this.resolveStores(filters?.stores).pipe(
      switchMap(({ slugs, labels }) => {
        const params = this.buildOrdersParams({ page, perPage, filters, stores: slugs });

        return this.http.get<RawWooOrdersResponse | RawWooGroupedPayload>(`${this.apiUrl}/woo/orders`, {
          params
        }).pipe(
          map((response) => this.normalizeOrdersResponse(response, labels, page, perPage)),
          catchError((err) => {
            console.error('[WooCommerceService] error al obtener órdenes', err);
            return of(this.createEmptyOrdersResponse(page, perPage));
          })
        );
      })
    );
  }

  /**
   * Get all WooCommerce orders (all pages)
   */
  getAllOrders(filters?: WooCommerceOrdersFilters): Observable<WooCommerceOrder[]> {
    return this.resolveStores(filters?.stores).pipe(
      switchMap(({ slugs, labels }) => {
        const params = this.buildOrdersParams({ filters, stores: slugs });

        return this.http.get<RawWooOrdersResponse | RawWooGroupedPayload>(`${this.apiUrl}/woo/orders/all`, {
          params
        }).pipe(
          map((response) => this.normalizeOrdersResponse(response, labels, 1, 1000).data),
          catchError((err) => {
            console.error('[WooCommerceService] error al obtener todas las órdenes', err);
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Get a single WooCommerce order
   */
  getOrder(id: number | string, store: string): Observable<WooCommerceOrder> {
    const params = new HttpParams().set('stores', store);

    return this.http.get<WooCommerceOrder>(`${this.apiUrl}/woo/${id}`, { params }).pipe(
      map((order) => ({
        ...order,
        store_slug: order.store_slug ?? store,
        store_label: order.store_label ?? this.getCachedStoreLabel(store) ?? store
      }))
    );
  }

  private resolveStores(stores?: string[] | string): Observable<{ slugs: string[]; labels: Map<string, string> }> {
    const normalizedStores = this.normalizeStores(stores);
    if (normalizedStores.length > 0) {
      return of({
        slugs: normalizedStores,
        labels: new Map(this.storesCache.map((store) => [store.slug, store.label]))
      });
    }

    return this.listStores().pipe(
      map((availableStores) => ({
        slugs: availableStores.map((store) => store.slug),
        labels: new Map(availableStores.map((store) => [store.slug, store.label]))
      }))
    );
  }

  private buildOrdersParams(options: {
    page?: number;
    perPage?: number;
    filters?: WooCommerceOrdersFilters;
    stores: string[];
  }): HttpParams {
    let params = new HttpParams();

    if (options.page) {
      params = params.set('page', options.page.toString());
    }

    if (options.perPage) {
      params = params.set('per_page', options.perPage.toString());
    }

    if (options.stores.length > 0) {
      params = params.set('stores', options.stores.join(','));
    }

    if (options.filters?.status) {
      params = params.set('status', options.filters.status);
    }

    if (options.filters?.customer) {
      params = params.set('customer', options.filters.customer);
    }

    if (options.filters?.search) {
      params = params.set('search', options.filters.search);
    }

    if (options.filters?.orderby) {
      params = params.set('orderby', options.filters.orderby);
    }

    if (options.filters?.order) {
      params = params.set('order', options.filters.order);
    }

    return params;
  }

  private normalizeOrdersResponse(
    response: RawWooOrdersResponse | RawWooGroupedPayload,
    labels: Map<string, string>,
    fallbackPage: number,
    fallbackPerPage: number
  ): WooCommerceOrdersResponse {
    const groupedPayload = this.extractGroupedPayload(response);
    const byStore: Record<string, WooCommerceOrdersByStore> = {};
    const orders: WooCommerceOrder[] = [];
    let totalOrders = 0;
    let totalPages = 1;
    let currentPage = fallbackPage;
    let perPage = fallbackPerPage;

    Object.entries(groupedPayload).forEach(([storeSlug, payload]) => {
      const normalizedStoreSlug = this.extractStoreSlug(storeSlug, payload);
      const storeOrders = this.extractOrders(payload).map((order) => ({
        ...order,
        store_slug: order.store_slug ?? normalizedStoreSlug,
        store_label: order.store_label ?? labels.get(normalizedStoreSlug) ?? this.extractStoreLabel(payload, normalizedStoreSlug)
      }));

      const meta = this.extractMeta(payload, storeOrders.length, fallbackPage, fallbackPerPage);
      const label = labels.get(normalizedStoreSlug) ?? this.extractStoreLabel(payload, normalizedStoreSlug);

      byStore[normalizedStoreSlug] = {
        label,
        data: storeOrders,
        meta
      };

      orders.push(...storeOrders);
      totalOrders += meta.total;
      totalPages = Math.max(totalPages, meta.total_pages);
      currentPage = meta.current_page || currentPage;
      perPage = Math.max(perPage, meta.per_page || fallbackPerPage);
    });

    if (orders.length > 0 && totalOrders === 0) {
      totalOrders = orders.length;
    }

    if (orders.length > 0 && totalPages === 1) {
      totalPages = Math.max(1, Math.ceil(totalOrders / Math.max(perPage, 1)));
    }

    orders.sort((left, right) => new Date(right.date_created).getTime() - new Date(left.date_created).getTime());

    return {
      data: orders,
      meta: {
        total: totalOrders,
        total_pages: totalPages,
        current_page: currentPage,
        per_page: perPage
      },
      by_store: byStore
    };
  }

  private extractGroupedPayload(response: RawWooOrdersResponse | RawWooGroupedPayload): RawWooGroupedPayload {
    if ('data' in response && isGroupedPayload(response.data)) {
      return response.data;
    }

    return isGroupedPayload(response) ? response : {};
  }

  private extractOrders(payload: RawStoreOrdersPayload | WooCommerceOrder[]): WooCommerceOrder[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    if (Array.isArray(payload.orders)) {
      return payload.orders;
    }

    return [];
  }

  private extractMeta(
    payload: RawStoreOrdersPayload | WooCommerceOrder[],
    orderCount: number,
    fallbackPage: number,
    fallbackPerPage: number
  ): WooCommerceOrdersMeta {
    if (Array.isArray(payload)) {
      return {
        total: orderCount,
        total_pages: orderCount > 0 ? 1 : 0,
        current_page: fallbackPage,
        per_page: fallbackPerPage
      };
    }

    const perPage = this.toPositiveInt(payload.meta?.per_page, payload.per_page, fallbackPerPage);
    const total = this.toPositiveInt(payload.meta?.total, payload.total, orderCount);
    const totalPages = this.toPositiveInt(
      payload.meta?.total_pages,
      payload.meta?.last_page,
      payload.total_pages,
      payload.last_page,
      total > 0 ? Math.ceil(total / Math.max(perPage, 1)) : 0
    );

    return {
      total,
      total_pages: totalPages,
      current_page: this.toPositiveInt(payload.meta?.current_page, payload.current_page, fallbackPage),
      per_page: perPage
    };
  }

  private extractStoreLabel(payload: RawStoreOrdersPayload | WooCommerceOrder[], fallback: string): string {
    if (Array.isArray(payload)) {
      return fallback;
    }

    return payload.store_label ?? payload.label ?? payload.store_name ?? payload.store ?? fallback;
  }

  private extractStoreSlug(fallbackSlug: string, payload: RawStoreOrdersPayload | WooCommerceOrder[]): string {
    if (Array.isArray(payload)) {
      return fallbackSlug;
    }

    return payload.store ?? fallbackSlug;
  }

  private normalizeStores(stores?: string[] | string): string[] {
    if (Array.isArray(stores)) {
      return stores.map((store) => store.trim()).filter(Boolean);
    }

    if (typeof stores === 'string') {
      return stores.split(',').map((store) => store.trim()).filter(Boolean);
    }

    return [];
  }

  private getCachedStoreLabel(storeSlug: string): string | undefined {
    return this.storesCache.find((store) => store.slug === storeSlug)?.label;
  }

  private createEmptyOrdersResponse(page: number, perPage: number): WooCommerceOrdersResponse {
    return {
      data: [],
      meta: {
        total: 0,
        total_pages: 0,
        current_page: page,
        per_page: perPage
      },
      by_store: {}
    };
  }

  private toPositiveInt(...values: Array<number | string | undefined>): number {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return 0;
  }
}
