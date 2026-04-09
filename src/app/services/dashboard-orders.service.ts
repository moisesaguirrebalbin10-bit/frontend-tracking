import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  DashboardOrderDetailResponse,
  DashboardOrderRow,
  DashboardOrdersMetricsResponse,
  DashboardOrdersQuery,
  DashboardOrdersResponse,
  DashboardOrderSource
} from '../models/dashboard-order.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardOrdersService {
  private readonly apiUrl = `${environment.apiUrl}/dashboard/orders`;

  constructor(private readonly http: HttpClient) {}

  fetchDashboardOrders(params: DashboardOrdersQuery): Observable<DashboardOrdersResponse> {
    return this.http.get<DashboardOrdersResponse>(this.apiUrl, {
      params: this.buildParams(params)
    });
  }

  fetchAllDashboardOrders(
    params: Omit<DashboardOrdersQuery, 'page' | 'per_page'>,
    perPage: number = 100
  ): Observable<DashboardOrderRow[]> {
    return this.fetchDashboardOrders({ ...params, page: 1, per_page: perPage }).pipe(
      expand((response) => {
        if (response.current_page >= response.last_page) {
          return EMPTY;
        }

        return this.fetchDashboardOrders({
          ...params,
          page: response.current_page + 1,
          per_page: perPage
        });
      }),
      reduce((rows, response) => rows.concat(response.data || []), [] as DashboardOrderRow[]),
      map((rows) => rows.filter((row) => !!row))
    );
  }

  fetchDashboardMetrics(params: Omit<DashboardOrdersQuery, 'page' | 'per_page'>): Observable<DashboardOrdersMetricsResponse> {
    return this.http.get<DashboardOrdersMetricsResponse>(`${this.apiUrl}/metrics`, {
      params: this.buildParams(params)
    });
  }

  fetchDashboardOrderDetail(source: Exclude<DashboardOrderSource, 'all'>, id: number): Observable<DashboardOrderDetailResponse> {
    return this.http.get<DashboardOrderDetailResponse>(`${this.apiUrl}/${source}/${id}`);
  }

  parseDetailEndpoint(detailEndpoint: string): { source: Exclude<DashboardOrderSource, 'all'>; id: number } | null {
    const normalized = String(detailEndpoint || '').trim();
    const match = normalized.match(/\/dashboard\/orders\/(woo|bsale)\/(\d+)$/i);
    if (!match) {
      return null;
    }

    return {
      source: match[1].toLowerCase() as Exclude<DashboardOrderSource, 'all'>,
      id: Number(match[2])
    };
  }

  private buildParams(params: Partial<DashboardOrdersQuery>): HttpParams {
    let httpParams = new HttpParams();

    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
    for (const [key, value] of entries) {
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }
}