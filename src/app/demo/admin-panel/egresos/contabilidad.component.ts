import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EgresosTableComponent } from './components/egresos-table.component';
import { EgresoFormComponent } from './components/egreso-form.component';
import { IngresosTableComponent, IngresoPedido } from './components/ingresos-table.component';
import { Egreso } from './egreso.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EgresosService } from './egresos.service';
import { OrderService } from 'src/app/services/order.service';
import { Order } from 'src/app/models/order.model';
import { BsaleOrdersFilters } from 'src/app/services/bsale.service';
import { catchError, concatMap, from, map, of } from 'rxjs';

@Component({
  selector: 'app-contabilidad',
  templateUrl: './contabilidad.component.html',
  styleUrls: ['./contabilidad.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EgresosTableComponent, EgresoFormComponent, IngresosTableComponent, FormsModule, CommonModule]
})
export class ContabilidadComponent implements OnInit {
  egresos: Egreso[] = [];
  ingresos: IngresoPedido[] = [];
  ingresoTotal = 0;
  egresoTotal = 0;
  ingresoNeto = 0;
  cargandoIngresos = false;
  cargandoEgresos = false;
  showForm = false;
  egresoEdit: Egreso | null = null;

  filtro: 'dia' | 'semana' | 'mes' | 'rango' = 'dia';
  fechaInicio: string = '';
  fechaFin: string = '';

  private egresosService = inject(EgresosService);
  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  private ingresosInternos: IngresoPedido[] = [];
  private ingresosBsale: IngresoPedido[] = [];
  private ingresosRequestVersion = 0;
  private cargandoIngresosInternos = false;
  private cargandoIngresosBsale = false;
  private readonly bsalePageSize = 50;
  private readonly bsaleRetryDelayMs = 1200;
  private readonly bsaleMaxRetries = 1;

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargarEgresos();
    this.cargarIngresos();
  }

  cargarEgresos() {
    this.cargandoEgresos = true;
    const rango = this.obtenerRangoActual();
    let params: any = {};
    if (this.filtro === 'dia') {
      params.fecha = this.formatearFechaLocal(rango.inicio);
    } else if (rango.inicio && rango.fin) {
      params.fecha_inicio = this.formatearFechaLocal(rango.inicio);
      params.fecha_fin = this.formatearFechaLocal(rango.fin);
    }
    this.egresosService.getEgresos(params).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          console.warn('El endpoint de egresos no esta disponible:', error.url);
          return of([] as Egreso[]);
        }

        throw error;
      })
    ).subscribe(data => {
      this.egresos = (Array.isArray(data) ? data : [])
        .filter((egreso) => this.coincideConFiltroActual(egreso.fecha))
        .sort((a, b) => this.obtenerTimestamp(b.fecha) - this.obtenerTimestamp(a.fecha));
      this.cargandoEgresos = false;
      this.recalcularTotales();
      this.cdr.detectChanges();
    });
  }

  cargarIngresos() {
    const requestVersion = ++this.ingresosRequestVersion;
    const rango = this.obtenerRangoActual();
    const dateFrom = rango.inicio ? this.formatearFechaLocal(rango.inicio) : '';
    const dateTo = rango.fin ? this.formatearFechaLocal(rango.fin) : '';

    this.cargandoIngresosInternos = true;
    this.cargandoIngresosBsale = true;
    this.actualizarEstadoCargaIngresos();
    this.ingresosInternos = [];
    this.ingresosBsale = [];
    this.reconstruirIngresos(requestVersion);

    this.cargarPedidosInternos(dateFrom, dateTo, requestVersion);
    this.cargarPedidosBsale(requestVersion, this.construirBsaleFilters());
  }

  onAdd() {
    this.egresoEdit = null;
    this.showForm = true;
  }

  onEdit(egreso: Egreso) {
    this.egresoEdit = egreso;
    this.showForm = true;
  }

  onSave(egreso: Partial<Egreso>) {
    if (this.egresoEdit) {
      // Editar
      this.egresosService.updateEgreso(this.egresoEdit.id, egreso).subscribe(() => {
        this.cargarEgresos();
        this.showForm = false;
      });
    } else {
      // Crear
      this.egresosService.createEgreso(egreso).subscribe(() => {
        this.cargarEgresos();
        this.showForm = false;
      });
    }
  }

  onCancel() {
    this.showForm = false;
  }

  setFiltro(f: 'dia' | 'semana' | 'mes' | 'rango') {
    this.filtro = f;
    this.cargarDatos();
  }

  private recalcularTotales() {
    this.ingresoTotal = this.ingresos.reduce((acc, i) => acc + i.precio, 0);
    this.egresoTotal = this.egresos.reduce((acc, e) => acc + e.precio, 0);
    this.ingresoNeto = this.ingresoTotal - this.egresoTotal;
  }

  private reconstruirIngresos(requestVersion: number) {
    if (requestVersion !== this.ingresosRequestVersion) {
      return;
    }

    this.ingresos = [...this.ingresosInternos, ...this.ingresosBsale]
      .filter((ingreso) => this.coincideConFiltroActual(ingreso.fecha))
      .sort((a, b) => this.obtenerTimestamp(b.fecha) - this.obtenerTimestamp(a.fecha));

    this.recalcularTotales();
    this.cdr.detectChanges();
  }

  private actualizarEstadoCargaIngresos() {
    this.cargandoIngresos = this.cargandoIngresosInternos || this.cargandoIngresosBsale;
  }

  private finalizarCargaIngresosInternos(requestVersion: number) {
    if (requestVersion !== this.ingresosRequestVersion) {
      return;
    }

    this.cargandoIngresosInternos = false;
    this.actualizarEstadoCargaIngresos();
    this.cdr.detectChanges();
  }

  private finalizarCargaIngresosBsale(requestVersion: number) {
    if (requestVersion !== this.ingresosRequestVersion) {
      return;
    }

    this.cargandoIngresosBsale = false;
    this.actualizarEstadoCargaIngresos();
    this.cdr.detectChanges();
  }

  private cargarPedidosInternos(dateFrom: string, dateTo: string, requestVersion: number) {
    const perPage = 1000;

    this.orderService.getOrdersWithFilters({ dateFrom, dateTo, perPage }).pipe(
      catchError(() => of({ data: [], current_page: 1, last_page: 1, total: 0 }))
    ).subscribe((firstPage) => {
      if (requestVersion !== this.ingresosRequestVersion) {
        return;
      }

      this.ingresosInternos = (firstPage.data || []).map((order: Order) => this.mapearIngreso(order));
      this.reconstruirIngresos(requestVersion);

      const lastPage = firstPage.last_page || 1;
      if (lastPage <= 1) {
        this.finalizarCargaIngresosInternos(requestVersion);
        return;
      }

      const remainingPages = Array.from({ length: lastPage - 1 }, (_, index) => index + 2);

      from(remainingPages).pipe(
        concatMap((page) =>
          this.orderService.getOrdersWithFilters({
            page,
            perPage,
            dateFrom,
            dateTo
          }).pipe(
            map((response) => response.data || []),
            catchError(() => of([] as Order[]))
          )
        )
      ).subscribe({
        next: (pageOrders) => {
          if (requestVersion !== this.ingresosRequestVersion) {
            return;
          }

          this.ingresosInternos = [
            ...this.ingresosInternos,
            ...pageOrders.map((order: Order) => this.mapearIngreso(order))
          ];
          this.reconstruirIngresos(requestVersion);
        },
        complete: () => this.finalizarCargaIngresosInternos(requestVersion)
      });
    });
  }

  private cargarPedidosBsale(
    requestVersion: number,
    filters: BsaleOrdersFilters,
    retryCount: number = 0
  ) {
    this.orderService.getBsaleOrdersFirstPage(this.bsalePageSize, filters).subscribe({
      next: (result) => {
        if (requestVersion !== this.ingresosRequestVersion) {
          return;
        }

        const { orders: firstOrders, pagination } = result;
        this.ingresosBsale = firstOrders.map((order: Order) => this.mapearIngreso(order));
        this.reconstruirIngresos(requestVersion);

        const total = pagination?.totalRegistros ?? firstOrders.length;
        const limit = pagination?.limit ?? this.bsalePageSize;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        if (totalPages <= 1 || firstOrders.length < limit) {
          this.finalizarCargaIngresosBsale(requestVersion);
          return;
        }

        this.cargarPaginaBsaleSecuencial(2, total, totalPages, filters, requestVersion);
      },
      error: () => {
        if (requestVersion !== this.ingresosRequestVersion) {
          return;
        }

        if (retryCount < this.bsaleMaxRetries) {
          setTimeout(() => {
            this.cargarPedidosBsale(requestVersion, filters, retryCount + 1);
          }, this.bsaleRetryDelayMs);
          return;
        }

        this.finalizarCargaIngresosBsale(requestVersion);
      }
    });
  }

  private cargarPaginaBsaleSecuencial(
    page: number,
    total: number,
    totalPages: number,
    filters: BsaleOrdersFilters,
    requestVersion: number,
    retryCount: number = 0
  ) {
    if (page > totalPages || requestVersion !== this.ingresosRequestVersion) {
      this.finalizarCargaIngresosBsale(requestVersion);
      return;
    }

    this.orderService.getBsaleOrdersPage(page, total, this.bsalePageSize, filters).pipe(
      map((pageResult) => ({
        orders: pageResult.orders || [],
        limit: pageResult.pagination?.limit ?? this.bsalePageSize
      }))
    ).subscribe({
      next: ({ orders: pageOrders, limit }) => {
        if (requestVersion !== this.ingresosRequestVersion) {
          return;
        }

        if (pageOrders.length > 0) {
          this.ingresosBsale = [
            ...this.ingresosBsale,
            ...pageOrders.map((order: Order) => this.mapearIngreso(order))
          ];
          this.reconstruirIngresos(requestVersion);
        }

        if (pageOrders.length < limit) {
          this.finalizarCargaIngresosBsale(requestVersion);
          return;
        }

        this.cargarPaginaBsaleSecuencial(page + 1, total, totalPages, filters, requestVersion);
      },
      error: () => {
        if (requestVersion !== this.ingresosRequestVersion) {
          return;
        }

        if (retryCount < this.bsaleMaxRetries) {
          setTimeout(() => {
            this.cargarPaginaBsaleSecuencial(page, total, totalPages, filters, requestVersion, retryCount + 1);
          }, this.bsaleRetryDelayMs);
          return;
        }
        this.finalizarCargaIngresosBsale(requestVersion);
      }
    });
  }

  private mapearIngreso(order: Order): IngresoPedido {
    const meta = this.normalizarMeta(order.meta);
    const bsale = order.bsale || meta['bsale'];
    const bsaleRaw = order.bsale_raw || meta;
    const fechaWoo = typeof meta['date_created'] === 'string' ? meta['date_created'] : '';
    const boletaBsale = String(
      order.bsale_boleta ||
      bsaleRaw?.boleta ||
      bsale?.serie ||
      bsale?.numero ||
      order.woo_order_number ||
      '-'
    );
    const fechaIngreso = this.obtenerFechaPedido(order);
    const precioIngreso = this.normalizarMonto(order.total || bsaleRaw?.pago?.montoTotal);
    const vendedorBsale = String(order.bsale_vendedor || bsaleRaw?.vendedor || order.user?.name || '').trim();
    const tiendaBsale = String(order.store_slug || bsaleRaw?.atributos?.marcaRedSocial || vendedorBsale || '-').trim();

    return {
      id: `${order.source || 'internal'}-${order.id || order.external_id || order.created_at}`,
      boleta: boletaBsale,
      fecha: fechaIngreso,
      precio: precioIngreso,
      tienda: tiendaBsale,
      vendedor: vendedorBsale
    };
  }

  private normalizarMonto(valor: unknown): number {
    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : 0;
    }

    const normalized = String(valor ?? '')
      .trim()
      .replace(/[^0-9,.-]/g, '')
      .replace(/,(?=\d{1,2}$)/, '.')
      .replace(/,/g, '');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizarMeta(meta: unknown): Record<string, any> {
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return meta as Record<string, any>;
    }

    if (typeof meta === 'string') {
      try {
        const parsed = JSON.parse(meta);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } catch {
        return {};
      }
    }

    return {};
  }

  private obtenerFechaPedido(order: Order): string {
    const meta = this.normalizarMeta(order.meta);
    const fechaWoo = typeof meta['date_created'] === 'string' ? meta['date_created'] : '';
    const fechaBsale = typeof order.bsale_raw?.fechaEmision === 'string' ? order.bsale_raw.fechaEmision : '';
    return String(fechaWoo || order.created_at || fechaBsale || '');
  }

  private construirBsaleFilters(): BsaleOrdersFilters {
    if (this.filtro === 'dia') {
      return { period: 'day' };
    }

    if (this.filtro === 'semana') {
      return { period: 'week' };
    }

    if (this.filtro === 'mes') {
      return { period: 'month' };
    }

    if (this.filtro === 'rango' && this.fechaInicio && this.fechaFin) {
      return {
        dateFrom: this.fechaInicio,
        dateTo: this.fechaFin
      };
    }

    return { period: 'day' };
  }

  private obtenerRangoActual(): { inicio: Date | null; fin: Date | null } {
    const hoy = new Date();

    if (this.filtro === 'dia') {
      const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      return { inicio: dia, fin: dia };
    }

    if (this.filtro === 'semana') {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      inicio.setDate(inicio.getDate() - 6);
      return { inicio, fin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) };
    }

    if (this.filtro === 'mes') {
      return {
        inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
        fin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      };
    }

    if (this.filtro === 'rango' && this.fechaInicio && this.fechaFin) {
      return {
        inicio: this.crearFechaLocalDesdeTexto(this.fechaInicio),
        fin: this.crearFechaLocalDesdeTexto(this.fechaFin)
      };
    }

    return { inicio: null, fin: null };
  }

  private coincideConFiltroActual(fecha: string): boolean {
    const fechaItem = this.crearFechaDesdeValor(fecha);
    const rango = this.obtenerRangoActual();

    if (!fechaItem || !rango.inicio || !rango.fin) {
      return true;
    }

    const diaItem = new Date(fechaItem.getFullYear(), fechaItem.getMonth(), fechaItem.getDate()).getTime();
    const diaInicio = new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate()).getTime();
    const diaFin = new Date(rango.fin.getFullYear(), rango.fin.getMonth(), rango.fin.getDate()).getTime();

    return diaItem >= diaInicio && diaItem <= diaFin;
  }

  private formatearFechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private crearFechaLocalDesdeTexto(valor: string): Date | null {
    if (!valor) {
      return null;
    }

    const [year, month, day] = valor.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private crearFechaDesdeValor(valor: string): Date | null {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private obtenerTimestamp(valor: string): number {
    return this.crearFechaDesdeValor(valor)?.getTime() ?? 0;
  }
}
