import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Egreso } from './egreso.model';
import { EgresoLog } from './egreso-log.model';

interface EgresosListResponse {
  data?: Egreso[];
  egresos?: Egreso[];
}

@Injectable({ providedIn: 'root' })
export class EgresosService {
  private apiUrl = `${environment.apiUrl}/egresos`;

  constructor(private http: HttpClient) {}

  getEgresos(params?: any): Observable<Egreso[]> {
    return this.http.get<Egreso[] | EgresosListResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }

        if (Array.isArray(response?.data)) {
          return response.data;
        }

        if (Array.isArray(response?.egresos)) {
          return response.egresos;
        }

        return [];
      })
    );
  }

  getEgreso(id: number): Observable<Egreso> {
    return this.http.get<Egreso>(`${this.apiUrl}/${id}`);
  }

  createEgreso(data: Partial<Egreso>): Observable<Egreso> {
    return this.http.post<Egreso>(this.apiUrl, data);
  }

  updateEgreso(id: number, data: Partial<Egreso>): Observable<Egreso> {
    return this.http.put<Egreso>(`${this.apiUrl}/${id}`, data);
  }

  deleteEgreso(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getEgresoLogs(id: number): Observable<EgresoLog[]> {
    return this.http.get<EgresoLog[]>(`${this.apiUrl}/${id}/logs`);
  }
}
