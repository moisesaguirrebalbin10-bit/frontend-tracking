import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Order, OrderStatus, OrderTimeline, OrderLog } from '../models/order.model';

export interface OrdersResponse {
  data: Order[];
  current_page: number;
  last_page: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getOrders(page: number = 1, perPage: number = 50): Observable<OrdersResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    return this.http.get<OrdersResponse>(`${this.apiUrl}/orders`, { params });
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  updateOrderStatus(id: number, status: OrderStatus, errorReason?: string, deliveryImage?: File): Observable<Order> {
    // Convert status to lowercase with underscores: EN_PROCESO → en_proceso
    const statusValue = status.toLowerCase();
    
    const body: any = { status: statusValue };
    if (errorReason) body.error_reason = errorReason;

    // Only use FormData if there's an image to upload
    if (deliveryImage) {
      const formData = new FormData();
      formData.append('status', statusValue);
      if (errorReason) formData.append('error_reason', errorReason);
      formData.append('delivery_image', deliveryImage);
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
}