import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { DashboardOrderRow, DashboardOrderSource, DashboardOrdersQuery, DashboardOrdersResponse } from '../../../models/dashboard-order.model';
import { DashboardOrdersService } from '../../../services/dashboard-orders.service';

interface StoreFilterOption {
  slug: string;
  label: string;
}

interface AnalyticsRow {
  key: string;
  label: string;
  orders: number;
  gainAmount: number;
  lossAmount: number;
  inProgressCount: number;
  deliveredCount: number;
  failedCount: number;
  cancelledCount: number;
}

type Timeframe = 'day' | 'week' | 'month' | 'range';
type GroupMode = 'period' | 'store';

@Component({
  selector: 'app-tracking-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './tracking-analytics.component.html',
  styleUrl: './tracking-analytics.component.scss'
})
export class TrackingAnalyticsComponent implements OnInit {
  timeframe = signal<Timeframe>('month');
  dataSource = signal<DashboardOrderSource>('all');
  groupMode = signal<GroupMode>('period');
  dateFrom = signal('');
  dateTo = signal('');

  loading = signal(false);
  loadError = signal('');
  allOrders = signal<DashboardOrderRow[]>([]);
  filteredOrders = signal<DashboardOrderRow[]>([]);
  availableStores = signal<StoreFilterOption[]>([]);
  selectedStoreSlugs = signal<string[]>([]);
  analyticsRows = signal<AnalyticsRow[]>([]);

  gainAmount = signal(0);
  lossAmount = signal(0);
  failedOrders = signal(0);
  cancelledOrders = signal(0);
  trackedOrders = signal(0);

  mainChartOptions: Partial<ApexOptions> = {};
  statusChartOptions: Partial<ApexOptions> = {};

  constructor(private readonly dashboardOrdersService: DashboardOrdersService) {
    this.resetCharts();
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.fetchAllRows().subscribe({
      next: (orders) => {
        this.allOrders.set(orders);
        this.refreshAvailableStores(orders);
        this.rebuildAnalytics();
        this.loading.set(false);
      },
      error: () => {
        this.allOrders.set([]);
        this.refreshAvailableStores([]);
        this.rebuildAnalytics();
        this.loadError.set('No se pudo cargar la analitica de tracking.');
        this.loading.set(false);
      }
    });
  }

  setTimeframe(timeframe: Timeframe): void {
    this.timeframe.set(timeframe);
    this.loadOrders();
  }

  setDataSource(source: DashboardOrderSource): void {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    this.loadOrders();
  }

  setGroupMode(mode: GroupMode): void {
    this.groupMode.set(mode);
    this.rebuildAnalytics();
  }

  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateFrom.set(input?.value || '');
    this.loadOrders();
  }

  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateTo.set(input?.value || '');
    this.loadOrders();
  }

  clearDateRange(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.loadOrders();
  }

  toggleStore(slug: string): void {
    const current = this.selectedStoreSlugs();
    this.selectedStoreSlugs.set(current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]);
    this.rebuildAnalytics();
  }

  clearStoreFilter(): void {
    this.selectedStoreSlugs.set([]);
    this.rebuildAnalytics();
  }

  isStoreSelected(slug: string): boolean {
    return this.selectedStoreSlugs().includes(slug);
  }

  exportCurrentView(): void {
    const summaryRows = this.analyticsRows().map((row) => ({
      Grupo: row.label,
      Pedidos: row.orders,
      Ganancias: row.gainAmount,
      Perdidas: row.lossAmount,
      En_Proceso: row.inProgressCount,
      Entregados: row.deliveredCount,
      Fallidos: row.failedCount,
      Cancelados: row.cancelledCount
    }));

    const detailRows = this.filteredOrders().map((order) => ({
      Grupo: this.groupMode() === 'store' ? this.getStoreBucket(order).label : this.getPeriodBucket(order.ordered_at).label,
      Numero_Pedido: order.order_number || '-',
      Boleta_Bsale: order.bsale_receipt || '-',
      Cliente: order.customer_name || 'No registrado',
      Total: order.total || 0,
      Estado: order.status.label,
      Fuente: order.source,
      Tienda_Vendedor: order.vendor_name || order.store_slug || '-',
      Fecha: order.ordered_at || ''
    }));

    if (!summaryRows.length && !detailRows.length) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    if (summaryRows.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
    }
    if (detailRows.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Detalle');
    }

    const fileName = `tracking-analytics-${this.groupMode()}-${this.timeframe()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  get dateRangeSummary(): string {
    if (this.timeframe() !== 'range') {
      return 'Los filtros de origen y periodo se resuelven server-side contra la BD local.';
    }
    if (this.dateFrom() && this.dateTo()) {
      return `Rango activo: ${this.dateFrom()} a ${this.dateTo()}`;
    }
    if (this.dateFrom()) {
      return `Desde ${this.dateFrom()}`;
    }
    if (this.dateTo()) {
      return `Hasta ${this.dateTo()}`;
    }
    return 'Selecciona un rango para acotar la analitica.';
  }

  get tableTitle(): string {
    return this.groupMode() === 'store' ? 'Tabla Dinamica por Tienda' : 'Tabla Dinamica por Periodo';
  }

  get groupColumnLabel(): string {
    return this.groupMode() === 'store' ? 'Tienda / Vendedor' : 'Periodo';
  }

  private fetchAllRows(): Observable<DashboardOrderRow[]> {
    const perPage = 100;
    return this.dashboardOrdersService.fetchDashboardOrders({
      ...this.buildQuery(),
      page: 1,
      per_page: perPage
    }).pipe(
      switchMap((firstPage) => {
        if ((firstPage.last_page || 1) <= 1) {
          return of(firstPage.data || []);
        }

        const requests = Array.from({ length: firstPage.last_page - 1 }, (_, index) =>
          this.dashboardOrdersService.fetchDashboardOrders({
            ...this.buildQuery(),
            page: index + 2,
            per_page: perPage
          }).pipe(
            catchError(() => of(this.emptyPage(index + 2, firstPage.last_page, firstPage.total, perPage)))
          )
        );

        return forkJoin(requests).pipe(
          map((remaining) => [firstPage, ...remaining].flatMap((page) => page.data || []))
        );
      }),
      catchError(() => of([]))
    );
  }

  private emptyPage(page: number, lastPage: number, total: number, perPage: number): DashboardOrdersResponse {
    return {
      current_page: page,
      data: [],
      from: null,
      last_page: lastPage,
      per_page: perPage,
      to: null,
      total
    };
  }

  private buildQuery(): Omit<DashboardOrdersQuery, 'page' | 'per_page'> {
    const bounds = this.getPeriodBounds();
    return {
      source: this.dataSource(),
      period: this.timeframe(),
      date_from: bounds.dateFrom,
      date_to: bounds.dateTo
    };
  }

  private getPeriodBounds(): { dateFrom?: string; dateTo?: string } {
    const today = new Date();
    const timeframe = this.timeframe();

    if (timeframe === 'range') {
      return {
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined
      };
    }

    if (timeframe === 'day') {
      const value = this.toLocalDateString(today);
      return { dateFrom: value, dateTo: value };
    }

    if (timeframe === 'week') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      start.setDate(start.getDate() - 6);
      return {
        dateFrom: this.toLocalDateString(start),
        dateTo: this.toLocalDateString(today)
      };
    }

    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      dateFrom: this.toLocalDateString(start),
      dateTo: this.toLocalDateString(today)
    };
  }

  private toLocalDateString(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private rebuildAnalytics(): void {
    const filtered = this.allOrders().filter((order) => this.matchesStoreFilter(order));
    this.filteredOrders.set(filtered);
    this.trackedOrders.set(filtered.length);
    this.gainAmount.set(this.sumBy(filtered, (order) => (this.isGainStatus(order) ? order.total : 0)));
    this.lossAmount.set(this.sumBy(filtered, (order) => (this.isLossStatus(order) ? order.total : 0)));
    this.failedOrders.set(filtered.filter((order) => this.isFailedStatus(order)).length);
    this.cancelledOrders.set(filtered.filter((order) => this.normalizeStatus(order.status.value) === 'cancelado').length);

    const rows = this.buildAnalyticsRows(filtered);
    this.analyticsRows.set(rows);
    this.updateCharts(rows, filtered);
  }

  private buildAnalyticsRows(orders: DashboardOrderRow[]): AnalyticsRow[] {
    const rowsMap = new Map<string, AnalyticsRow>();

    for (const order of orders) {
      const bucket = this.groupMode() === 'store' ? this.getStoreBucket(order) : this.getPeriodBucket(order.ordered_at);
      const existing = rowsMap.get(bucket.key) ?? {
        key: bucket.key,
        label: bucket.label,
        orders: 0,
        gainAmount: 0,
        lossAmount: 0,
        inProgressCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        cancelledCount: 0
      };

      existing.orders += 1;
      if (this.isGainStatus(order)) {
        existing.gainAmount += order.total;
      }
      if (this.isLossStatus(order)) {
        existing.lossAmount += order.total;
      }
      if (this.isInProgressStatus(order)) {
        existing.inProgressCount += 1;
      }
      if (this.normalizeStatus(order.status.value) === 'entregado') {
        existing.deliveredCount += 1;
      }
      if (this.isFailedStatus(order)) {
        existing.failedCount += 1;
      }
      if (this.normalizeStatus(order.status.value) === 'cancelado') {
        existing.cancelledCount += 1;
      }

      rowsMap.set(bucket.key, existing);
    }

    return Array.from(rowsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  private getStoreBucket(order: DashboardOrderRow): { key: string; label: string } {
    const label = order.vendor_name || order.store_slug || (order.source === 'bsale' ? 'Bsale' : 'WooCommerce');
    return { key: label.toLowerCase(), label };
  }

  private getPeriodBucket(dateValue: string | null): { key: string; label: string } {
    const orderDate = dateValue ? new Date(dateValue) : null;
    if (!orderDate || Number.isNaN(orderDate.getTime())) {
      return { key: 'sin-fecha', label: 'Sin fecha' };
    }

    if (this.timeframe() === 'day') {
      const hour = String(orderDate.getHours()).padStart(2, '0');
      return { key: `${orderDate.toISOString().slice(0, 10)}-${hour}`, label: `${hour}:00` };
    }

    if (this.timeframe() === 'week') {
      const key = orderDate.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(orderDate);
      return { key, label };
    }

    if (this.timeframe() === 'month') {
      const week = this.getWeekOfMonth(orderDate);
      return {
        key: `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-S${week}`,
        label: `Semana ${week}`
      };
    }

    const key = orderDate.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(orderDate);
    return { key, label };
  }

  private updateCharts(rows: AnalyticsRow[], orders: DashboardOrderRow[]): void {
    const categories = rows.map((row) => row.label);
    this.mainChartOptions = {
      chart: {
        type: 'bar',
        height: 360,
        toolbar: { show: false },
        background: 'transparent'
      },
      series: [
        { name: 'Ganancias', data: rows.map((row) => Number(row.gainAmount.toFixed(2))) },
        { name: 'Perdidas', data: rows.map((row) => Number(row.lossAmount.toFixed(2))) }
      ],
      colors: ['#22c55e', '#ef4444'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '42%',
          borderRadius: 6
        }
      },
      dataLabels: { enabled: false },
      stroke: {
        show: true,
        width: 6,
        colors: ['transparent']
      },
      xaxis: { categories },
      yaxis: {
        labels: {
          formatter: (value) => `S/ ${Number(value || 0).toFixed(0)}`
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left'
      },
      tooltip: {
        theme: 'dark'
      }
    };

    const inProgress = orders.filter((order) => this.isInProgressStatus(order)).length;
    const delivered = orders.filter((order) => this.normalizeStatus(order.status.value) === 'entregado').length;
    const failed = orders.filter((order) => this.isFailedStatus(order)).length;
    const cancelled = orders.filter((order) => this.normalizeStatus(order.status.value) === 'cancelado').length;

    this.statusChartOptions = {
      chart: {
        type: 'donut',
        height: 320,
        toolbar: { show: false },
        background: 'transparent'
      },
      labels: ['En Proceso', 'Entregados', 'Fallidos', 'Cancelados'],
      series: [inProgress, delivered, failed, cancelled],
      colors: ['#f59e0b', '#22c55e', '#ef4444', '#94a3b8'],
      legend: {
        position: 'bottom'
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: '12px' }
      },
      tooltip: {
        theme: 'dark'
      }
    };
  }

  private resetCharts(): void {
    this.mainChartOptions = {
      chart: { type: 'bar', height: 360 },
      series: [],
      xaxis: { categories: [] }
    };
    this.statusChartOptions = {
      chart: { type: 'donut', height: 320 },
      series: [0, 0, 0, 0],
      labels: ['En Proceso', 'Entregados', 'Fallidos', 'Cancelados']
    };
  }

  private matchesStoreFilter(order: DashboardOrderRow): boolean {
    const selected = this.selectedStoreSlugs();
    if (selected.length === 0) {
      return true;
    }
    return selected.includes(String(order.store_slug || '').trim());
  }

  private normalizeStatus(status: string | null | undefined): string {
    return String(status || '').trim().toLowerCase();
  }

  private isInProgressStatus(order: DashboardOrderRow): boolean {
    return ['en_proceso', 'empaquetado', 'despachado', 'en_camino'].includes(this.normalizeStatus(order.status.value));
  }

  private isFailedStatus(order: DashboardOrderRow): boolean {
    return this.normalizeStatus(order.status.value) === 'error_en_pedido';
  }

  private isGainStatus(order: DashboardOrderRow): boolean {
    return this.isInProgressStatus(order) || this.normalizeStatus(order.status.value) === 'entregado';
  }

  private isLossStatus(order: DashboardOrderRow): boolean {
    return this.isFailedStatus(order) || this.normalizeStatus(order.status.value) === 'cancelado';
  }

  private getWeekOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    return Math.ceil((date.getDate() + offset) / 7);
  }

  private sumBy(orders: DashboardOrderRow[], selector: (order: DashboardOrderRow) => number): number {
    return Number(orders.reduce((sum, order) => sum + selector(order), 0).toFixed(2));
  }

  private refreshAvailableStores(orders: DashboardOrderRow[]): void {
    const stores = new Map<string, StoreFilterOption>();
    for (const order of orders) {
      const slug = String(order.store_slug || '').trim();
      if (!slug) {
        continue;
      }
      if (!stores.has(slug)) {
        stores.set(slug, { slug, label: slug });
      }
    }
    this.availableStores.set(Array.from(stores.values()).sort((a, b) => a.label.localeCompare(b.label)));
  }
}