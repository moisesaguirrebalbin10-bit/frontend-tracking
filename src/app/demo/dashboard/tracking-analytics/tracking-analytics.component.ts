import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderService } from '../../../services/order.service';

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
type DataSource = 'all' | 'internal' | 'woocommerce';
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
  dataSource = signal<DataSource>('all');
  groupMode = signal<GroupMode>('period');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  loading = signal(false);
  allOrders = signal<Order[]>([]);
  filteredOrders = signal<Order[]>([]);
  availableStores = signal<StoreFilterOption[]>([]);
  selectedStoreSlugs = signal<string[]>([]);
  analyticsRows = signal<AnalyticsRow[]>([]);

  gainAmount = signal(0);
  lossAmount = signal(0);
  failedOrders = signal(0);
  cancelledOrders = signal(0);
  trackedOrders = signal(0);

  readonly itemsPerPage = 100;

  mainChartOptions: Partial<ApexOptions> = {};
  statusChartOptions: Partial<ApexOptions> = {};

  constructor(private orderService: OrderService) {
    this.resetCharts();
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.fetchAllInternalOrders().subscribe({
      next: (orders) => {
        const sorted = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.allOrders.set(sorted);
        this.refreshAvailableStores(sorted);
        this.rebuildAnalytics();
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading tracking analytics orders', error);
        this.allOrders.set([]);
        this.refreshAvailableStores([]);
        this.rebuildAnalytics();
        this.loading.set(false);
      }
    });
  }

  setTimeframe(timeframe: Timeframe): void {
    this.timeframe.set(timeframe);
    this.rebuildAnalytics();
  }

  setDataSource(source: DataSource): void {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    this.rebuildAnalytics();
  }

  setGroupMode(mode: GroupMode): void {
    this.groupMode.set(mode);
    this.rebuildAnalytics();
  }

  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateFrom.set(input?.value || '');
    this.rebuildAnalytics();
  }

  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateTo.set(input?.value || '');
    this.rebuildAnalytics();
  }

  clearDateRange(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.rebuildAnalytics();
  }

  toggleStore(slug: string): void {
    const current = this.selectedStoreSlugs();
    this.selectedStoreSlugs.set(
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]
    );
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
      Grupo: this.groupMode() === 'store' ? this.getStoreBucket(order).label : this.getPeriodBucket(order).label,
      Nro_Boleta: order.external_id || order.id,
      Cliente: order.customer_name || 'Sin nombre',
      Productos: this.getOrderItemsSummary(order),
      Total_Pedido: this.getOrderTotal(order),
      Tienda: this.getOrderStoreLabel(order),
      Estado: this.getOrderStatusLabel(order),
      Fecha_Creacion: this.getOrderCreatedAtLabel(order)
    }));

    if (!summaryRows.length && !detailRows.length) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    if (summaryRows.length) {
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    }
    if (detailRows.length) {
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Pedidos');
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
      return 'Filtra por dia, semana, mes o rango libre.';
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
    return this.groupMode() === 'store' ? 'Tienda' : 'Periodo';
  }

  private rebuildAnalytics(): void {
    const filtered = this.getFilteredOrders();
    this.filteredOrders.set(filtered);

    this.trackedOrders.set(filtered.length);
    this.gainAmount.set(this.sumBy(filtered, (order) => (this.isGainStatus(order) ? this.getOrderTotal(order) : 0)));
    this.lossAmount.set(this.sumBy(filtered, (order) => (this.isLossStatus(order) ? this.getOrderTotal(order) : 0)));
    this.failedOrders.set(filtered.filter((order) => this.isFailedStatus(order)).length);
    this.cancelledOrders.set(filtered.filter((order) => this.normalizeStatus(order.status) === 'CANCELADO').length);

    const rows = this.buildAnalyticsRows(filtered);
    this.analyticsRows.set(rows);
    this.updateCharts(rows, filtered);
  }

  private getFilteredOrders(): Order[] {
    const now = new Date();
    return this.allOrders()
      .filter((order) => this.matchesDataSource(order))
      .filter((order) => this.matchesStoreFilter(order))
      .filter((order) => this.isWithinSelectedTimeframe(order.created_at, now));
  }

  private buildAnalyticsRows(orders: Order[]): AnalyticsRow[] {
    const rowsMap = new Map<string, AnalyticsRow>();

    for (const order of orders) {
      const bucket = this.groupMode() === 'store' ? this.getStoreBucket(order) : this.getPeriodBucket(order);
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
        existing.gainAmount += this.getOrderTotal(order);
      }
      if (this.isLossStatus(order)) {
        existing.lossAmount += this.getOrderTotal(order);
      }
      if (this.isInProgressStatus(order)) {
        existing.inProgressCount += 1;
      }
      if (this.normalizeStatus(order.status) === 'ENTREGADO') {
        existing.deliveredCount += 1;
      }
      if (this.isFailedStatus(order)) {
        existing.failedCount += 1;
      }
      if (this.normalizeStatus(order.status) === 'CANCELADO') {
        existing.cancelledCount += 1;
      }

      rowsMap.set(bucket.key, existing);
    }

    const rows = Array.from(rowsMap.values());
    if (this.groupMode() === 'store') {
      return rows.sort((a, b) => b.gainAmount - a.gainAmount || a.label.localeCompare(b.label));
    }
    return rows.sort((a, b) => a.key.localeCompare(b.key));
  }

  private getStoreBucket(order: Order): { key: string; label: string } {
    const slug = (order.store_slug || '').trim();
    const label = slug || (this.getOrderSource(order) === 'woocommerce' ? 'WooCommerce sin tienda' : 'Interno');
    return { key: label.toLowerCase(), label };
  }

  private getPeriodBucket(order: Order): { key: string; label: string } {
    const orderDate = new Date(order.created_at);
    const time = orderDate.getTime();
    if (Number.isNaN(time)) {
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
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-S${week}`;
      return { key: monthKey, label: `Semana ${week}` };
    }

    const key = orderDate.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(orderDate);
    return { key, label };
  }

  private updateCharts(rows: AnalyticsRow[], orders: Order[]): void {
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
      xaxis: {
        categories,
        labels: {
          style: {
            colors: categories.map(() => '#9ca3af')
          }
        }
      },
      yaxis: {
        labels: {
          formatter: (value) => `S/ ${Number(value || 0).toFixed(0)}`
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        fontFamily: `'Inter', sans-serif`
      },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: (value) => `S/ ${Number(value || 0).toFixed(2)}`
        }
      },
      grid: {
        borderColor: 'rgba(148, 163, 184, 0.16)'
      }
    };

    const inProgress = orders.filter((order) => this.isInProgressStatus(order)).length;
    const delivered = orders.filter((order) => this.normalizeStatus(order.status) === 'ENTREGADO').length;
    const failed = orders.filter((order) => this.isFailedStatus(order)).length;
    const cancelled = orders.filter((order) => this.normalizeStatus(order.status) === 'CANCELADO').length;

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
        position: 'bottom',
        fontFamily: `'Inter', sans-serif`,
        labels: { colors: '#cbd5e1' }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '12px'
        }
      },
      stroke: {
        colors: ['#111827']
      },
      tooltip: {
        theme: 'dark'
      }
    };
  }

  private resetCharts(): void {
    this.mainChartOptions = {
      chart: {
        type: 'bar',
        height: 360,
        toolbar: { show: false },
        background: 'transparent'
      },
      series: [],
      xaxis: { categories: [] }
    };
    this.statusChartOptions = {
      chart: {
        type: 'donut',
        height: 320,
        toolbar: { show: false },
        background: 'transparent'
      },
      series: [0, 0, 0, 0],
      labels: ['En Proceso', 'Entregados', 'Fallidos', 'Cancelados']
    };
  }

  private matchesStoreFilter(order: Order): boolean {
    const selected = this.selectedStoreSlugs();
    if (selected.length === 0) return true;
    return selected.includes((order.store_slug || '').trim());
  }

  private matchesDataSource(order: Order): boolean {
    const source = this.getOrderSource(order);
    if (this.dataSource() === 'internal') {
      return source !== 'woocommerce';
    }
    if (this.dataSource() === 'woocommerce') {
      return source === 'woocommerce';
    }
    return true;
  }

  private getOrderSource(order: Order): 'web' | 'redes' | 'woocommerce' | null {
    if (order.store_slug) {
      return 'woocommerce';
    }
    if (order.source === 'woocommerce') {
      return 'woocommerce';
    }
    if (order.source) {
      return order.source;
    }
    const role = order.user?.role;
    if (role === 'vendedor_redes') return 'redes';
    if (role === 'ventas_web') return 'web';
    if (!order.user) return 'woocommerce';
    return null;
  }

  private isWithinSelectedTimeframe(createdAt: string, now: Date): boolean {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) {
      return false;
    }

    if (this.timeframe() === 'day') {
      return this.isSameDay(createdDate, now);
    }

    if (this.timeframe() === 'week') {
      return this.isWithinLastDays(createdDate, now, 7);
    }

    if (this.timeframe() === 'month') {
      return createdDate.getFullYear() === now.getFullYear() && createdDate.getMonth() === now.getMonth();
    }

    const from = this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`) : null;
    const to = this.dateTo() ? new Date(`${this.dateTo()}T23:59:59`) : null;

    if (from && createdDate < from) return false;
    if (to && createdDate > to) return false;
    return true;
  }

  private isSameDay(dateA: Date, dateB: Date): boolean {
    return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();
  }

  private isWithinLastDays(orderDate: Date, referenceDate: Date, days: number): boolean {
    const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
    const endDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - (days - 1));
    return orderDay >= startDay && orderDay <= endDay;
  }

  private getWeekOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    return Math.ceil((date.getDate() + offset) / 7);
  }

  private normalizeStatus(status: OrderStatus | string | null | undefined): string {
    return String(status || '').trim().toUpperCase();
  }

  private isInProgressStatus(order: Order): boolean {
    return ['EN_PROCESO', 'EMPAQUETADO', 'DESPACHADO', 'EN_CAMINO'].includes(this.normalizeStatus(order.status));
  }

  private isFailedStatus(order: Order): boolean {
    return ['ERROR', 'ERROR_EN_PEDIDO'].includes(this.normalizeStatus(order.status));
  }

  private isGainStatus(order: Order): boolean {
    return this.isInProgressStatus(order) || this.normalizeStatus(order.status) === 'ENTREGADO';
  }

  private isLossStatus(order: Order): boolean {
    return this.isFailedStatus(order) || this.normalizeStatus(order.status) === 'CANCELADO';
  }

  private getOrderStoreLabel(order: Order): string {
    if (order.store_slug) {
      return order.store_slug;
    }
    if (order.woo_source) {
      return order.woo_source;
    }

    const source = this.getOrderSource(order);
    switch (source) {
      case 'web':
        return 'Web';
      case 'redes':
        return 'Redes';
      case 'woocommerce':
        return 'WooCommerce';
      default:
        return 'Interno';
    }
  }

  private getOrderStatusLabel(order: Order): string {
    if (order.woo_status_label && this.normalizeStatus(order.status) === 'EN_PROCESO') {
      return order.woo_status_label;
    }

    const status = this.normalizeStatus(order.status);
    const labels: Record<string, string> = {
      EN_PROCESO: 'En Proceso',
      EMPAQUETADO: 'Empaquetado',
      DESPACHADO: 'Despachado',
      EN_CAMINO: 'En Camino',
      ENTREGADO: 'Entregado',
      ERROR: 'Error',
      ERROR_EN_PEDIDO: 'Error en Pedido',
      CANCELADO: 'Cancelado'
    };

    return labels[status] ?? status;
  }

  private getOrderCreatedAtLabel(order: Order): string {
    const createdDate = new Date(order.created_at);
    if (Number.isNaN(createdDate.getTime())) {
      return order.created_at || '';
    }

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(createdDate);
  }

  private getOrderItemsSummary(order: Order): string {
    const items = Array.isArray(order.items) && order.items.length > 0
      ? order.items.map((item) => ({
          name: item.product_name,
          quantity: Number(item.quantity) || 0
        }))
      : this.getMetaLineItems(order).map((item) => ({
          name: item.name,
          quantity: item.quantity
        }));

    if (!items.length) {
      return 'Sin detalle';
    }

    return items.map((item) => `${item.quantity}x ${item.name}`).join(' | ');
  }

  private getMetaLineItems(order: Order): Array<{ name: string; quantity: number }> {
    const meta = order.meta as any;
    if (!meta || Array.isArray(meta) || !Array.isArray(meta.line_items)) {
      return [];
    }

    return meta.line_items.map((item: any) => ({
      name: item?.name || item?.parent_name || 'Producto',
      quantity: Number(item?.quantity) || 0
    }));
  }

  private getOrderTotal(order: Order): number {
    return Number(order.total) || 0;
  }

  private sumBy(orders: Order[], selector: (order: Order) => number): number {
    return Number(orders.reduce((sum, order) => sum + selector(order), 0).toFixed(2));
  }

  private refreshAvailableStores(orders: Order[]): void {
    const mapBySlug = new Map<string, StoreFilterOption>();

    for (const order of orders) {
      const slug = (order.store_slug || '').trim();
      if (!slug) continue;
      if (!mapBySlug.has(slug)) {
        mapBySlug.set(slug, { slug, label: slug });
      }
    }

    this.availableStores.set(Array.from(mapBySlug.values()).sort((a, b) => a.label.localeCompare(b.label)));
  }

  private fetchAllInternalOrders(): Observable<Order[]> {
    return this.orderService.getOrders(1, this.itemsPerPage).pipe(
      switchMap((firstPage) => {
        const allOrders = [...(firstPage.data || [])];
        const lastPage = firstPage.last_page || 1;

        if (lastPage <= 1) {
          return of(allOrders);
        }

        const remaining = Array.from({ length: lastPage - 1 }, (_, index) =>
          this.orderService.getOrders(index + 2, this.itemsPerPage).pipe(
            catchError(() => of({ data: [], current_page: index + 2, last_page: lastPage, total: 0 }))
          )
        );

        return forkJoin(remaining).pipe(
          map((pages) => [...allOrders, ...pages.flatMap((page) => page.data || [])])
        );
      }),
      catchError((error) => {
        console.error('Error fetching tracking analytics orders', error);
        return of([]);
      })
    );
  }
}