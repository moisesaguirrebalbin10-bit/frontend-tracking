import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from './order-detail-modal.component';
import { RouteSearchService } from '../../../theme/shared/service/route-search.service';

interface StoreFilterOption {
  slug: string;
  label: string;
}

@Component({
  selector: 'app-orders-dashboard',
  standalone: true,
  imports: [CommonModule, OrderDetailModalComponent],
  template: `
    <div class="container-fluid">
      <div class="row mb-3 g-3 align-items-center">
        <div class="col-xl-6 col-md-6">
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn" [ngClass]="timeframe() === 'day' ? 'btn-primary' : 'btn-outline-primary'" (click)="setTimeframe('day')">Por Día</button>
            <button type="button" class="btn" [ngClass]="timeframe() === 'week' ? 'btn-primary' : 'btn-outline-primary'" (click)="setTimeframe('week')">Por Semana</button>
            <button type="button" class="btn" [ngClass]="timeframe() === 'month' ? 'btn-primary' : 'btn-outline-primary'" (click)="setTimeframe('month')">Por Mes</button>
            <button type="button" class="btn" [ngClass]="timeframe() === 'range' ? 'btn-primary' : 'btn-outline-primary'" (click)="setTimeframe('range')">Filtro Dinámico</button>
          </div>
        </div>
        <div class="col-xl-6 col-md-6">
          <div class="d-flex align-items-center gap-2 w-100">
            <div class="btn-group flex-grow-1" role="group">
              <button type="button" class="btn" [ngClass]="dataSource() === 'all' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('all')">Todos</button>
              <button type="button" class="btn" [ngClass]="dataSource() === 'internal' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('internal')">Internos</button>
              <button type="button" class="btn" [ngClass]="dataSource() === 'woocommerce' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('woocommerce')">WooCommerce</button>
            </div>
            <button class="btn btn-outline-secondary" (click)="loadAllOrdersOnce(true)" [disabled]="loading()" title="Recargar pedidos desde el servidor" style="white-space:nowrap">
              <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
              <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
              Recargar
            </button>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-2" *ngIf="timeframe() === 'range'">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-calendar-search me-1"></i>Rango de fechas:</span>
                <div class="d-flex align-items-center gap-2">
                  <label class="text-muted mb-0" style="white-space:nowrap">Desde</label>
                  <input type="date" class="form-control form-control-sm" style="width:160px"
                    [value]="dateFrom()"
                    (change)="onDateFromChange($event)" />
                </div>
                <div class="d-flex align-items-center gap-2">
                  <label class="text-muted mb-0" style="white-space:nowrap">Hasta</label>
                  <input type="date" class="form-control form-control-sm" style="width:160px"
                    [value]="dateTo()"
                    (change)="onDateToChange($event)" />
                </div>
                <button *ngIf="dateFrom() || dateTo()" class="btn btn-sm btn-outline-secondary" (click)="clearDateRange()">Limpiar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-2" *ngIf="(dataSource() === 'woocommerce' || dataSource() === 'all') && availableStores().length > 1">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-building-store me-1"></i>Tienda:</span>
                <button
                  class="btn btn-sm"
                  [ngClass]="selectedStoreSlugs().length === 0 ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="clearStoreFilter()">Todas</button>
                <button
                  *ngFor="let store of availableStores()"
                  class="btn btn-sm"
                  [ngClass]="isStoreSelected(store.slug) ? 'btn-warning' : 'btn-outline-secondary'"
                  (click)="toggleStore(store.slug)">{{ store.label }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-4 g-3">
        <div class="col-md-3">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Total Pedidos</h6>
              <h3>{{ totalOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Entregados</h6>
              <h3 class="text-success">{{ deliveredOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">En Proceso</h6>
              <h3 class="text-warning">{{ inProgressOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Errores</h6>
              <h3 class="text-danger">{{ errorOrders() }}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h5 class="mb-0">{{ ordersTableTitle() }}</h5>
                <small class="text-muted">{{ pageRangeLabel }}</small>
              </div>

              <div *ngIf="loading()" class="text-center py-4">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>

              <div *ngIf="!loading()" class="table-responsive">
                <table class="table table-striped table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nro Boleta</th>
                      <th>Nombre</th>
                      <th>Fecha</th>
                      <th>Fecha de Entrega</th>
                      <th>Fecha Entregado</th>
                      <th>Ubicación</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th>Tienda/Vendedor</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of pagedOrders">
                      <td>{{ order.external_id }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td>{{ order.created_at | date: 'short' }}</td>
                      <td>{{ order.estimated_delivery_date ? formatEstimated(order.estimated_delivery_date) : '-' }}</td>
                      <td>{{ order.status === 'ENTREGADO' && order.delivery_date ? (order.delivery_date | date: 'short') : '-' }}</td>
                      <td><small>{{ order.delivery_location || '-' }}</small></td>
                      <td>$ {{ order.total }}</td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClassForOrder(order)">
                          {{ getStatusLabel(order) }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" [ngClass]="getSourceBadgeClass(order)">
                          {{ getSourceDisplay(order) }}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-sm btn-primary" (click)="viewOrder(order)">Más Info</button>
                      </td>
                    </tr>
                    <tr *ngIf="!filteredOrders().length">
                      <td colspan="10" class="text-center text-muted py-4">No hay pedidos para el filtro seleccionado.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!loading() && totalPages > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small class="text-muted">Página {{ currentPage() }} de {{ totalPages }}</small>
                <nav>
                  <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" [class.disabled]="currentPage() === 1">
                      <button class="page-link" (click)="goToPage(1)" [disabled]="currentPage() === 1">&laquo;</button>
                    </li>
                    <li class="page-item" [class.disabled]="currentPage() === 1">
                      <button class="page-link" (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1">&lsaquo;</button>
                    </li>
                    <li *ngFor="let p of pageNumbers" class="page-item" [class.active]="p === currentPage()">
                      <button class="page-link" (click)="goToPage(p)">{{ p }}</button>
                    </li>
                    <li class="page-item" [class.disabled]="currentPage() === totalPages">
                      <button class="page-link" (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages">&rsaquo;</button>
                    </li>
                    <li class="page-item" [class.disabled]="currentPage() === totalPages">
                      <button class="page-link" (click)="goToPage(totalPages)" [disabled]="currentPage() === totalPages">&raquo;</button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <app-order-detail-modal [order]="selectedOrder()" [isOpen]="showModal()" (closeModal)="closeModal()"></app-order-detail-modal>
  `,
  styles: [`
    .metric-card {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .badge {
      font-size: 0.8em;
    }
  `]
})
export class OrdersDashboardComponent implements OnInit {
  timeframe = signal<'day' | 'week' | 'month' | 'range'>('day');
  dataSource = signal<'internal' | 'woocommerce' | 'all'>('all');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  loading = signal(false);
  allOrders = signal<Order[]>([]);
  filteredOrders = signal<Order[]>([]);
  apiTotal = signal(0);
  apiLastPage = signal(1);

  totalOrders = signal(0);
  deliveredOrders = signal(0);
  inProgressOrders = signal(0);
  errorOrders = signal(0);

  currentPage = signal(1);
  readonly pageSize = 100;

  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);
  availableStores = signal<StoreFilterOption[]>([]);
  selectedStoreSlugs = signal<string[]>([]);
  private hasFullDataset = signal(false);
  private routeSearchService = inject(RouteSearchService);

  get pageRangeLabel(): string {
    const total = this.apiTotal();
    if (total === 0) return '0 pedidos encontrados';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, total);
    return `Mostrando ${start}–${end} de ${total} pedidos`;
  }

  get pagedOrders(): Order[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return this.apiLastPage();
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage.set(page);
  }

  constructor(
    private orderService: OrderService
  ) {
    effect(() => {
      this.routeSearchService.currentTerm();
      this.currentPage.set(1);
      this.applyFilters();
    });
  }

  ngOnInit() {
    this.loadAllOrdersOnce(true);
  }

  setTimeframe(tf: 'day' | 'week' | 'month' | 'range') {
    this.timeframe.set(tf);
    this.currentPage.set(1);
    if (tf === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  onDateFromChange(event: Event) {
    this.dateFrom.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
    this.applyFilters();
  }

  onDateToChange(event: Event) {
    this.dateTo.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
    this.applyFilters();
  }

  clearDateRange() {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
    this.applyFilters();
  }

  setDataSource(source: 'internal' | 'woocommerce' | 'all') {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    if (this.timeframe() === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  toggleStore(slug: string) {
    const current = this.selectedStoreSlugs();
    const idx = current.indexOf(slug);
    this.selectedStoreSlugs.set(idx >= 0 ? current.filter(s => s !== slug) : [...current, slug]);
    this.currentPage.set(1);
    if (this.timeframe() === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  clearStoreFilter() {
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    if (this.timeframe() === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  isStoreSelected(slug: string): boolean {
    return this.selectedStoreSlugs().includes(slug);
  }

  loadAllOrdersOnce(fullData: boolean) {
    this.loading.set(true);
    this.hasFullDataset.set(fullData);

    this.fetchAllInternalOrders(fullData).subscribe({
      next: (orders) => {
        const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.allOrders.set(sortedOrders);
        this.refreshAvailableStores(sortedOrders);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.allOrders.set([]);
        this.applyFilters();
        this.loading.set(false);
      }
    });
  }

  private fetchAllInternalOrders(fullData: boolean): Observable<Order[]> {
    return this.orderService.getOrders(1, 100).pipe(
      switchMap(firstPage => {
        const allOrders = [...firstPage.data];
        if (!fullData) {
          return of(allOrders);
        }
        const lastPage = firstPage.last_page || 1;
        if (lastPage <= 1) return of(allOrders);
        const remaining = Array.from({ length: lastPage - 1 }, (_, i) =>
          this.orderService.getOrders(i + 2, 100).pipe(
            catchError(() => of({ data: [], current_page: i + 2, last_page: lastPage, total: 0 }))
          )
        );
        return forkJoin(remaining).pipe(
          map(pages => [...allOrders, ...pages.flatMap(p => p.data)])
        );
      }),
      catchError(err => {
        console.error('Error loading internal orders for dashboard', err);
        return of([]);
      })
    );
  }

  private refreshAvailableStores(orders: Order[]) {
    const mapBySlug = new Map<string, StoreFilterOption>();

    for (const order of orders) {
      const slug = (order.store_slug || '').trim();
      if (!slug) continue;

      if (!mapBySlug.has(slug)) {
        mapBySlug.set(slug, {
          slug,
          label: slug
        });
      }
    }

    this.availableStores.set(Array.from(mapBySlug.values()).sort((a, b) => a.label.localeCompare(b.label)));
  }

  private applyFilters() {
    const searchTerm = this.routeSearchService.currentTerm().trim().toLowerCase();
    const now = new Date();
    const filtered = this.allOrders()
      .filter((order) => this.matchesDataSource(order))
      .filter((order) => this.isWithinSelectedTimeframe(order.created_at, now))
      .filter((order) => this.matchesSearch(order, searchTerm))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    this.filteredOrders.set(filtered);
    this.apiTotal.set(filtered.length);
    this.apiLastPage.set(Math.max(1, Math.ceil(filtered.length / this.pageSize)));
    this.totalOrders.set(filtered.length);
    this.deliveredOrders.set(filtered.filter((order) => order.status === OrderStatus.ENTREGADO).length);
    this.inProgressOrders.set(
      filtered.filter((order) => [OrderStatus.EN_PROCESO, OrderStatus.EMPAQUETADO, OrderStatus.DESPACHADO, OrderStatus.EN_CAMINO].includes(order.status)).length
    );
    this.errorOrders.set(filtered.filter((order) => order.status === OrderStatus.ERROR).length);
  }

  private matchesSearch(order: Order, term: string): boolean {
    if (!term) {
      return true;
    }

    const normalizedTerm = this.normalizeDateTerm(term);
    const ticket = String(order.external_id || '').toLowerCase();
    const customerName = String(order.customer_name || '').toLowerCase();
    const createdAtIso = String(order.created_at || '').toLowerCase();

    const createdDate = order.created_at ? new Date(order.created_at) : null;
    const createdAtShort = createdDate && !isNaN(createdDate.getTime())
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(createdDate).toLowerCase()
      : '';
    const createdAtDateOnly = createdDate && !isNaN(createdDate.getTime())
      ? createdDate.toISOString().split('T')[0].toLowerCase()
      : '';
    const createdAtDateCandidates = createdDate && !isNaN(createdDate.getTime())
      ? this.buildDateSearchCandidates(createdDate)
      : [];

    return (
      ticket.includes(term) ||
      customerName.includes(term) ||
      createdAtIso.includes(term) ||
      createdAtShort.includes(term) ||
      createdAtDateOnly.includes(term) ||
      createdAtDateCandidates.some((value) => value.includes(normalizedTerm))
    );
  }

  private normalizeDateTerm(value: string): string {
    return (value || '').trim().toLowerCase().replace(/[.\-\s]+/g, '/').replace(/\/+/g, '/');
  }

  private buildDateSearchCandidates(date: Date): string[] {
    const year4 = String(date.getFullYear());
    const year2 = year4.slice(-2);
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate());
    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');

    return [
      `${month}/${day}/${year2}`,
      `${mm}/${dd}/${year2}`,
      `${day}/${month}/${year2}`,
      `${dd}/${mm}/${year2}`,
      `${year2}/${month}/${day}`,
      `${year2}/${mm}/${dd}`,
      `${year4}/${month}/${day}`,
      `${year4}/${mm}/${dd}`,
      `${year4}-${mm}-${dd}`,
      `${day}/${month}/${year4}`,
      `${dd}/${mm}/${year4}`,
      `${month}/${day}/${year4}`,
      `${mm}/${dd}/${year4}`
    ].map((item) => this.normalizeDateTerm(item));
  }

  private matchesDataSource(order: Order): boolean {
    const isWoo = this.getOrderSource(order) === 'woocommerce';

    if (this.dataSource() === 'internal') {
      return !isWoo;
    }

    if (this.dataSource() === 'woocommerce') {
      return isWoo && this.matchesStoreFilter(order);
    }

    // 'all': internal orders always pass; Woo orders must match store filter
    return isWoo ? this.matchesStoreFilter(order) : true;
  }

  private matchesStoreFilter(order: Order): boolean {
    const selected = this.selectedStoreSlugs();
    if (selected.length === 0) return true;
    return selected.includes(order.store_slug ?? '');
  }

  private isWithinSelectedTimeframe(dateValue: string, referenceDate: Date): boolean {
    const orderDate = new Date(dateValue);

    if (this.timeframe() === 'day') {
      return orderDate.getFullYear() === referenceDate.getFullYear() && orderDate.getMonth() === referenceDate.getMonth() && orderDate.getDate() === referenceDate.getDate();
    }

    if (this.timeframe() === 'week') {
      return this.isWithinLastDays(orderDate, referenceDate, 7);
    }

    if (this.timeframe() === 'range') {
      const from = this.dateFrom();
      const to = this.dateTo();
      const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      if (from && to) {
        const fromDay = new Date(from + 'T00:00:00');
        const toDay = new Date(to + 'T23:59:59');
        return orderDay >= fromDay && orderDay <= toDay;
      }
      if (from) {
        const fromDay = new Date(from + 'T00:00:00');
        return orderDay >= fromDay;
      }
      if (to) {
        const toDay = new Date(to + 'T23:59:59');
        return orderDay <= toDay;
      }
      return true;
    }

    return orderDate.getFullYear() === referenceDate.getFullYear() && orderDate.getMonth() === referenceDate.getMonth();
  }

  private isWithinLastDays(orderDate: Date, referenceDate: Date, days: number): boolean {
    const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
    const endDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - (days - 1));
    return orderDay >= startDay && orderDay <= endDay;
  }

  ordersTableTitle(): string {
    if (this.timeframe() === 'range') {
      const from = this.dateFrom();
      const to = this.dateTo();
      if (from && to) return `Pedidos del ${from} al ${to}`;
      if (from) return `Pedidos desde ${from}`;
      if (to) return `Pedidos hasta ${to}`;
      return 'Pedidos — Filtro Dinámico';
    }
    const titles: Record<string, string> = {
      day: 'Pedidos del Día',
      week: 'Pedidos de los Últimos 7 Días',
      month: 'Pedidos del Mes'
    };
    return titles[this.timeframe()];
  }

  formatEstimated(date: string): string {
    if (!date) return '-';
    if (date.includes(' y ')) return date;

    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(parsedDate);
    }

    return date;
  }

  getStatusClass(status: OrderStatus | string): string {
    switch ((status as string)?.toUpperCase()) {
      case 'ENTREGADO': return 'bg-success';
      case 'ERROR':
      case 'ERROR_EN_PEDIDO': return 'bg-danger';
      case 'CANCELADO': return 'bg-secondary';
      case 'EN_CAMINO': return 'bg-info';
      case 'DESPACHADO': return 'bg-primary';
      case 'EMPAQUETADO':
      case 'EN_PROCESO': return 'bg-warning';
      default: return 'bg-warning';
    }
  }

  /** Devuelve la etiqueta legible del estado, priorizando woo_status_label/woo_status del backend */
  getStatusLabel(order: Order): string {
    const effectiveWooStatus = order.woo_status || order.meta?.status;
    const isEnProceso = (order.status as string)?.toUpperCase() === 'EN_PROCESO';
    // Si el backend ya envía la etiqueta traducida, usarla directamente
    if (order.woo_status_label && isEnProceso) {
      return order.woo_status_label;
    }
    if (effectiveWooStatus && isEnProceso) {
      const wooLabels: Record<string, string> = {
        'pending':    'Pendiente de Pago',
        'processing': 'En Proceso',
        'on-hold':    'En Espera',
        'completed':  'Completado',
        'cancelled':  'Cancelado',
        'refunded':   'Reembolsado',
        'failed':     'Fallido'
      };
      return wooLabels[effectiveWooStatus] ?? effectiveWooStatus;
    }
    const internalLabels: Record<string, string> = {
      'EN_PROCESO':      'En Proceso',
      'EMPAQUETADO':     'Empaquetado',
      'DESPACHADO':      'Despachado',
      'EN_CAMINO':       'En Camino',
      'ENTREGADO':       'Entregado',
      'ERROR':           'Error',
      'ERROR_EN_PEDIDO': 'Error en Pedido',
      'CANCELADO':       'Cancelado'
    };
    return internalLabels[(order.status as string)?.toUpperCase()] ?? order.status;
  }

  /** Color del badge usando woo_status cuando aplica */
  getStatusClassForOrder(order: Order): string {
    const effectiveWooStatus = order.woo_status || order.meta?.status;
    const isEnProceso = (order.status as string)?.toUpperCase() === 'EN_PROCESO';
    if (effectiveWooStatus && isEnProceso) {
      const wooColors: Record<string, string> = {
        'pending':    'bg-secondary',
        'processing': 'bg-warning',
        'on-hold':    'bg-info text-dark',
        'failed':     'bg-danger'
      };
      return wooColors[effectiveWooStatus] ?? 'bg-warning';
    }
    return this.getStatusClass(order.status);
  }

  getOrderSource(order: Order): 'web' | 'redes' | 'woocommerce' | null {
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
    if (role === 'vendedor_redes') {
      return 'redes';
    }
    if (role === 'ventas_web') {
      return 'web';
    }
    if (!order.user) {
      return 'woocommerce';
    }

    return null;
  }

  getSourceDisplay(order: Order): string {
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
        return order.user?.name || 'Desconocido';
    }
  }

  getSourceBadgeClass(order: Order): string {
    if (order.source === 'woocommerce' || (order.woo_source && !order.user)) {
      return 'bg-warning';
    }
    if (order.source === 'web' || order.user?.role === 'ventas_web') {
      return 'bg-primary';
    }
    if (order.source === 'redes' || order.user?.role === 'vendedor_redes') {
      return 'bg-info';
    }
    return 'bg-secondary';
  }

  viewOrder(order: Order) {
    this.selectedOrder.set(order);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
  }
}
