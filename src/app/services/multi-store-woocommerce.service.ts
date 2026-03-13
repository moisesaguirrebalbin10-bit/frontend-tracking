import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { WooCommerceOrdersResponse, WooCommerceService } from './woocommerce.service';
import { Order } from '../models/order.model';
import { OrderService } from './order.service';

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
  constructor(
    private wooCommerceService: WooCommerceService,
    private orderService: OrderService
  ) {}

  /**
   * Obtén órdenes de múltiples tiendas WooCommerce
   */
  getOrdersFromAllStores(page: number = 1, perPage: number = 20): Observable<MultiStoreOrdersResponse> {
    return this.wooCommerceService.getOrders(page, perPage).pipe(
      map((response) => this.mapMultiStoreResponse(response)),
      catchError((error) => {
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
   * Obtén estadísticas de órdenes por tienda
   */
  getStoreStatistics(): Observable<{
    [storeId: string]: {
      store_name: string;
      total_orders: number;
      total_revenue: number;
    };
  }> {
    return this.wooCommerceService.getAllOrders().pipe(
      map((orders) => {
        const statistics: {
          [storeId: string]: {
            store_name: string;
            total_orders: number;
            total_revenue: number;
          };
        } = {};

        orders.forEach((order) => {
          const storeId = order.store_slug ?? 'unknown';
          const storeName = order.store_label ?? storeId;

          if (!statistics[storeId]) {
            statistics[storeId] = {
              store_name: storeName,
              total_orders: 0,
              total_revenue: 0
            };
          }

          statistics[storeId].total_orders += 1;
          statistics[storeId].total_revenue += parseFloat(order.total) || 0;
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
    return this.wooCommerceService.getOrders(page, perPage, { stores: [storeId], status }).pipe(
      catchError(() => {
        return of({ data: [], meta: { total: 0, total_pages: 0, current_page: page, per_page: perPage }, by_store: {} });
      })
    );
  }

  private mapMultiStoreResponse(response: WooCommerceOrdersResponse): MultiStoreOrdersResponse {
    const byStore = Object.entries(response.by_store).reduce<MultiStoreOrdersResponse['by_store']>((accumulator, [storeId, group]) => {
      accumulator[storeId] = {
        store_name: group.label,
        count: group.meta.total,
        orders: group.data.map((order) => this.orderService.transformWooCommerceOrder(order, group.label))
      };

      return accumulator;
    }, {});

    return {
      total: response.meta.total,
      by_store: byStore,
      all_orders: response.data.map((order) => this.orderService.transformWooCommerceOrder(order, order.store_label))
    };
  }
}
