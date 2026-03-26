import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ────────────────────────────────────────────────
// Interfaces del response de Bsale
// ────────────────────────────────────────────────

export interface BsaleCliente {
  nombre: string;
  dni_ruc: string;
  email: string;
  telefono: string;
}

export interface BsaleAtributos {
  fechaDespacho: string;
  marcaRedSocial: string;
  estadoPedido: string;
}

export interface BsalePago {
  metodos: string;
  montoTotal: string;
}

export interface BsalePrenda {
  nombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  descuentoAplicado: number;
  totalAPagar: number;
}

export interface BsaleOrder {
  boleta: string;
  fechaEmision: string;
  cliente: BsaleCliente;
  vendedor: string;
  atributos: BsaleAtributos;
  pago: BsalePago;
  prendas: BsalePrenda[];
}

export interface BsaleOrdersResponse {
  total_registros: number;
  items: BsaleOrder[];
}

export interface BsalePaginationState {
  totalRegistros: number;
  currentPage: number;         
  limit: number;
  currentOffset: number;       
}

// ────────────────────────────────────────────────
// Servicio
// ────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class BsaleService {
  private readonly apiUrl = environment.apiUrl;

  
  private cachedTotal = 0;
  readonly limit = 50;

  constructor(private http: HttpClient) {}

  /**
   * Calcula el offset inverso para traer los registros más nuevos primero.
   */
  private calcOffset(totalRegistros: number, page: number): number {
    return Math.max(0, totalRegistros - this.limit * page);
  }

  /**
   * Trae la primera página y guarda el total para paginación posterior.
   * Siempre usa page = 1 internamente para la primera carga.
   */
  getFirstPage(): Observable<{ response: BsaleOrdersResponse; pagination: BsalePaginationState }> {
    // Primero pedimos con offset=0 y limit=1 para conocer el total
    return this.getPage(1).pipe(
      map(result => {
        this.cachedTotal = result.response.total_registros;
        return result;
      })
    );
  }

  /**
   * Trae una página específica usando paginación inversa.
   * @param page  
   * @param total 
   */
  getPage(
    page: number,
    total?: number
  ): Observable<{ response: BsaleOrdersResponse; pagination: BsalePaginationState }> {
    const totalRegistros = total ?? this.cachedTotal;

    
    // backend nos devuelve `total_registros`. Luego calculamos el offset.
    if (totalRegistros === 0 && page === 1) {
      return this.fetchRaw(0, this.limit).pipe(
        map(response => {
          this.cachedTotal = response.total_registros;
          const offset = this.calcOffset(response.total_registros, 1);
          
          const pagination: BsalePaginationState = {
            totalRegistros: response.total_registros,
            currentPage: 1,
            limit: this.limit,
            currentOffset: 0
          };
          return { response, pagination };
        })
      );
    }

    
    const offsetParam = (page - 1) * this.limit;
    const estimatedRealOffset = this.calcOffset(totalRegistros, page);

    return this.fetchRaw(offsetParam, this.limit).pipe(
      map(response => {
        this.cachedTotal = response.total_registros;
        const pagination: BsalePaginationState = {
          totalRegistros: response.total_registros,
          currentPage: page,
          limit: this.limit,
          currentOffset: estimatedRealOffset
        };
        return { response, pagination };
      })
    );
  }

  /** Número total de páginas dado el total de registros */
  getTotalPages(totalRegistros: number): number {
    return Math.ceil(totalRegistros / this.limit);
  }

  private fetchRaw(offset: number, limit: number): Observable<BsaleOrdersResponse> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http
      .get<BsaleOrdersResponse>(`${this.apiUrl}/bsale/orders`, { 
        params,
        responseType: 'json'
      })
      .pipe(
        timeout(120000), // 2 minutos timeout
        catchError(err => {
          console.error('[BsaleService] Error al obtener órdenes Bsale', err);
          return of({ total_registros: 0, items: [] });
        })
      );
  }

  resetCache(): void {
    this.cachedTotal = 0;
  }
}