import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DashboardOrderRow, DashboardOrdersQuery } from 'src/app/models/dashboard-order.model';
import { DashboardOrdersService } from 'src/app/services/dashboard-orders.service';
import { EgresoFormComponent } from './components/egreso-form.component';
import { EgresosTableComponent } from './components/egresos-table.component';
import { IngresosTableComponent, IngresoPedido } from './components/ingresos-table.component';
import { Egreso } from './egreso.model';
import { EgresosService } from './egresos.service';

@Component({
  selector: 'app-contabilidad',
  standalone: true,
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
  fechaInicio = '';
  fechaFin = '';

  ingresosPage = 1;
  readonly ingresosPageSize = 20;
  ingresosTotalItems = 0;

  private readonly egresosService = inject(EgresosService);
  private readonly dashboardOrdersService = inject(DashboardOrdersService);
  private readonly cdr = inject(ChangeDetectorRef);

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
    const params: Record<string, string> = {};

    if (this.filtro === 'dia' && rango.inicio) {
      params['fecha'] = this.formatearFechaLocal(rango.inicio);
    } else if (rango.inicio && rango.fin) {
      params['fecha_inicio'] = this.formatearFechaLocal(rango.inicio);
      params['fecha_fin'] = this.formatearFechaLocal(rango.fin);
    }

    this.egresosService.getEgresos(params).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([] as Egreso[]);
        }
        throw error;
      })
    ).subscribe((data) => {
      this.egresos = (Array.isArray(data) ? data : [])
        .filter((egreso) => this.coincideConFiltroActual(egreso.fecha))
        .sort((a, b) => this.obtenerTimestamp(b.fecha) - this.obtenerTimestamp(a.fecha));
      this.cargandoEgresos = false;
      this.recalcularTotales();
      this.cdr.detectChanges();
    });
  }

  cargarIngresos() {
    this.cargandoIngresos = true;

    forkJoin({
      orders: this.dashboardOrdersService.fetchDashboardOrders(this.buildIngresosQuery()),
      metrics: this.dashboardOrdersService.fetchDashboardMetrics(this.buildMetricsQuery())
    }).pipe(
      catchError(() => of({
        orders: {
          current_page: this.ingresosPage,
          data: [] as DashboardOrderRow[],
          from: null,
          last_page: 1,
          per_page: this.ingresosPageSize,
          to: null,
          total: 0
        },
        metrics: {
          filters: {},
          metrics: {
            total_orders: 0,
            delivered_orders: 0,
            in_process_orders: 0,
            error_orders: 0,
            cancelled_orders: 0,
            total_amount: 0
          }
        }
      }))
    ).subscribe(({ orders, metrics }) => {
      this.ingresos = (orders.data || []).map((order) => this.mapearIngreso(order));
      this.ingresosTotalItems = orders.total || 0;
      this.ingresosPage = orders.current_page || 1;
      this.ingresoTotal = Number(metrics.metrics.total_amount || 0);
      this.cargandoIngresos = false;
      this.recalcularTotales();
      this.cdr.detectChanges();
    });
  }

  onIngresosPageChange(page: number) {
    this.ingresosPage = page;
    this.cargarIngresos();
  }

  onDateRangeChanged() {
    if (this.filtro !== 'rango') {
      return;
    }
    this.ingresosPage = 1;
    this.cargarDatos();
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
      this.egresosService.updateEgreso(this.egresoEdit.id, egreso).subscribe(() => {
        this.cargarEgresos();
        this.showForm = false;
      });
      return;
    }

    this.egresosService.createEgreso(egreso).subscribe(() => {
      this.cargarEgresos();
      this.showForm = false;
    });
  }

  onCancel() {
    this.showForm = false;
  }

  setFiltro(filtro: 'dia' | 'semana' | 'mes' | 'rango') {
    this.filtro = filtro;
    this.ingresosPage = 1;
    this.cargarDatos();
  }

  private buildIngresosQuery(): DashboardOrdersQuery {
    const base = this.buildMetricsQuery();
    return {
      ...base,
      page: this.ingresosPage,
      per_page: this.ingresosPageSize
    };
  }

  private buildMetricsQuery(): Omit<DashboardOrdersQuery, 'page' | 'per_page'> {
    const rango = this.obtenerRangoActual();
    const period = this.mapearPeriodo();
    const query: Omit<DashboardOrdersQuery, 'page' | 'per_page'> = {
      source: 'all',
      period
    };

    if (rango.inicio && rango.fin) {
      query.date_from = this.formatearFechaLocal(rango.inicio);
      query.date_to = this.formatearFechaLocal(rango.fin);
    }

    return query;
  }

  private mapearIngreso(order: DashboardOrderRow): IngresoPedido {
    return {
      id: `${order.source}-${order.source_record_id}`,
      boleta: String(order.bsale_receipt || order.order_number || '-'),
      fecha: String(order.ordered_at || ''),
      precio: Number(order.total || 0),
      tienda: String(order.store_slug || order.vendor_name || order.source || '-'),
      vendedor: String(order.vendor_name || '')
    };
  }

  private recalcularTotales() {
    this.egresoTotal = this.egresos.reduce((acc, item) => acc + item.precio, 0);
    this.ingresoNeto = this.ingresoTotal - this.egresoTotal;
  }

  private mapearPeriodo(): DashboardOrdersQuery['period'] {
    if (this.filtro === 'dia') return 'day';
    if (this.filtro === 'semana') return 'week';
    if (this.filtro === 'mes') return 'month';
    return 'range';
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