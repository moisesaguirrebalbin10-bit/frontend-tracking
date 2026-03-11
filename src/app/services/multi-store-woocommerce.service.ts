import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WooCommerceOrder, WooCommerceOrdersResponse } from './woocommerce.service';
import { Order } from '../models/order.model';
import { OrderService } from './order.service';
import { WOOCOMMERCE_STORES, getStoreById, getEnabledStores } from '../config/woocommerce-stores.config';

export interface MultiStoreOrdersResponse {
  total: number;
  by_store: {
    [storeId: string]: {
      store_name: string;
      count: number;
      orders: Order[];
    };
  };
  all_orders: Order[];
}

@Injectable({
  providedIn: 'root'
})
export class MultiStoreWooCommerceService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private orderService: OrderService
  ) {}

  /**
   * Obtén órdenes de múltiples tiendas WooCommerce
   */
  getOrdersFromAllStores(page: number = 1, perPage: number = 20): Observable<MultiStoreOrdersResponse> {
    const enabledStores = getEnabledStores();
    
    if (enabledStores.length === 0) {
      return of({
        total: 0,
        by_store: {},
        all_orders: []
      });
    }

    // Crear observables para cada tienda
    const storeRequests: { [key: string]: Observable<WooCommerceOrdersResponse> } = {};
    
    enabledStores.forEach(store => {
      storeRequests[store.id] = this.getOrdersFromStore(store.id, page, perPage);
    });

    // Ejecutar todas las solicitudes en paralelo
    return forkJoin(storeRequests).pipe(
      map(responses => {
        const result: MultiStoreOrdersResponse = {
          total: 0,
          by_store: {},
          all_orders: []
        };

        Object.entries(responses).forEach(([storeId, response]) => {
          const store = getStoreById(storeId);
          if (!store) return;

          const transformedOrders = (response.data || []).map(wooOrder =>
            this.orderService.transformWooCommerceOrder(wooOrder, store.name)
          );

          result.by_store[storeId] = {
            store_name: store.name,
            count: response.meta?.total || 0,
            orders: transformedOrders
          };

          result.total += response.meta?.total || 0;
          result.all_orders = [...result.all_orders, ...transformedOrders];
        });

        // Ordenar todas las órdenes por fecha descendente
        result.all_orders.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Aplicar paginación a los resultados combinados
        const start = (page - 1) * perPage;
        result.all_orders = result.all_orders.slice(start, start + perPage);

        return result;
      }),
      catchError(error => {
        console.error('Error fetching orders from multiple stores:', error);
        return of({
          total: 0,
          by_store: {},
          all_orders: []
        });
      })
    );
  }

  /**
   * Obtén órdenes de una tienda específica
   */
  private getOrdersFromStore(
    storeId: string,
    page: number = 1,
    perPage: number = 20
  ): Observable<WooCommerceOrdersResponse> {
    // Este endpoint necesitaría ser implementado en el backend
    // Actualmente usa el endpoint genérico
    let params = new HttpParams()
      .set('store_id', storeId)
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<WooCommerceOrdersResponse>(`${this.apiUrl}/woo/orders`, {
      params
    }).pipe(
      catchError(() => {
        console.warn(`Failed to fetch orders from store ${storeId}`);
        return of({ data: [], meta: { total: 0, total_pages: 0, current_page: page, per_page: perPage } });
      })
    );
  }

  /**
   * Obtén estadísticas de órdenes por tienda
   */
  getStoreStatistics(): Observable<{
    [storeId: string]: {
      store_name: string;
      total_orders: number;
      total_revenue: number;
    };
  }> {
    const enabledStores = getEnabledStores();
    
    if (enabledStores.length === 0) {
      return of({});
    }

    const storeRequests: { [key: string]: Observable<WooCommerceOrdersResponse> } = {};
    
    enabledStores.forEach(store => {
      storeRequests[store.id] = this.getOrdersFromStore(store.id, 1, 1000);
    });

    return forkJoin(storeRequests).pipe(
      map(responses => {
        const statistics: {
          [storeId: string]: {
            store_name: string;
            total_orders: number;
            total_revenue: number;
          };
        } = {};

        Object.entries(responses).forEach(([storeId, response]) => {
          const store = getStoreById(storeId);
          if (!store) return;

          const totalRevenue = (response.data || []).reduce((sum, order) => {
            return sum + (parseFloat(order.total) || 0);
          }, 0);

          statistics[storeId] = {
            store_name: store.name,
            total_orders: response.meta?.total || 0,
            total_revenue: totalRevenue
          };
        });

        return statistics;
      }),
      catchError(() => of({}))
    );
  }

  /**
   * Obtén órdenes filtradas por status de una tienda
   */
  getOrdersByStatus(
    storeId: string,
    status: string,
    page: number = 1,
    perPage: number = 20
  ): Observable<WooCommerceOrdersResponse> {
    const store = getStoreById(storeId);
    if (!store) {
      return of({ data: [], meta: { total: 0, total_pages: 0, current_page: page, per_page: perPage } });
    }

    let params = new HttpParams()
      .set('store_id', storeId)
      .set('status', status)
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<WooCommerceOrdersResponse>(`${this.apiUrl}/woo/orders`, {
      params
    }).pipe(
      catchError(() => {
        return of({ data: [], meta: { total: 0, total_pages: 0, current_page: page, per_page: perPage } });
      })
    );
  }
}
