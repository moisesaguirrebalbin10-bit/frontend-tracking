import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WooCommerceOrder {
  id: number;
  order_number: string;
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
  [key: string]: any;
}

export interface WooCommerceOrdersResponse {
  data: WooCommerceOrder[];
  meta: {
    total: number;
    total_pages: number;
    current_page: number;
    per_page: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class WooCommerceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get WooCommerce orders with pagination
   * @param page Page number
   * @param perPage Items per page
   * @param filters Additional filters (status, customer, search, orderby, order)
   */
  getOrders(
    page: number = 1,
    perPage: number = 20,
    filters?: {
      status?: string;
      customer?: string;
      search?: string;
      orderby?: string;
      order?: string;
    }
  ): Observable<WooCommerceOrdersResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (filters) {
      if (filters.status) {
        params = params.set('status', filters.status);
      }
      if (filters.customer) {
        params = params.set('customer', filters.customer);
      }
      if (filters.search) {
        params = params.set('search', filters.search);
      }
      if (filters.orderby) {
        params = params.set('orderby', filters.orderby);
      }
      if (filters.order) {
        params = params.set('order', filters.order);
      }
    }

    return this.http.get<WooCommerceOrdersResponse>(`${this.apiUrl}/woo/orders`, {
      params
    }).pipe(
      catchError(err => {
        console.error('[WooCommerceService] error al obtener órdenes', err);
        const empty: WooCommerceOrdersResponse = {
          data: [],
          meta: {
            total: 0,
            total_pages: 0,
            current_page: page,
            per_page: perPage
          }
        };
        return of(empty);
      })
    );
  }

  /**
   * Get all WooCommerce orders (all pages)
   */
  getAllOrders(filters?: {
    status?: string;
    customer?: string;
    search?: string;
  }): Observable<WooCommerceOrder[]> {
    let params = new HttpParams().set('per_page', '100');

    if (filters) {
      if (filters.status) {
        params = params.set('status', filters.status);
      }
      if (filters.customer) {
        params = params.set('customer', filters.customer);
      }
      if (filters.search) {
        params = params.set('search', filters.search);
      }
    }

    return this.http.get<WooCommerceOrder[]>(`${this.apiUrl}/woo/orders`, {
      params
    });
  }

  /**
   * Get a single WooCommerce order
   */
  getOrder(id: number | string): Observable<WooCommerceOrder> {
    return this.http.get<WooCommerceOrder>(`${this.apiUrl}/woo/orders/${id}`);
  }
}
