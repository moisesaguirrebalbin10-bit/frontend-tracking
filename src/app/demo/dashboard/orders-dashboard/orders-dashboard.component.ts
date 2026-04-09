import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import {
  DashboardOrdersScope,
  DashboardOrderRow,
  DashboardOrderSource,
  DashboardOrderStatusValue,
  DashboardOrdersMetrics,
  DashboardOrdersQuery,
  DashboardOrdersResponse
} from '../../../models/dashboard-order.model';
import { UserRole } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { DashboardOrdersService } from '../../../services/dashboard-orders.service';
import { WooCommerceService, WooCommerceStore } from '../../../services/woocommerce.service';
import { RouteSearchService } from '../../../theme/shared/service/route-search.service';
import {
  fallbackText,
  formatDashboardCurrency,
  formatDashboardDate,
  getDashboardSourceBadgeClass,
  getDashboardSourceLabel,
  getDashboardStatusClass,
  getDashboardStatusOptions
} from '../../../utils/dashboard-order-ui.utils';
import { OrderDetailModalComponent } from './order-detail-modal.component';

type DashboardPeriod = 'day' | 'week' | 'month' | 'range';

@Component({
  selector: 'app-orders-dashboard',
  standalone: true,
  imports: [CommonModule, OrderDetailModalComponent],
  template: `
    <div class="container-fluid">
      <div class="row mb-3" *ngIf="isDeliveryUser">
        <div class="col-12">
          <div class="card border-0 delivery-hero-card">
            <div class="card-body py-3 px-4">
              <h2 class="delivery-hero-title mb-1">Tus Pedidos Pendientes por Entregar</h2>
              <p class="delivery-hero-copy mb-0">Esta vista muestra la cola de pedidos actualmente asignados a tu cuenta para despacho y entrega.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-3" *ngIf="isEmpaquetadorUser">
        <div class="col-12">
          <div class="card border-0 delivery-hero-card">
            <div class="card-body py-3 px-4">
              <h2 class="delivery-hero-title mb-1">Pedidos Pendientes por Empaquetar</h2>
              <p class="delivery-hero-copy mb-0">Por favor revisa la informacion en Mas Info para armar el paquete y marcar el check del proceso para confirmar su empaquetado o X en caso hubiese un error en el pedido.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-3 align-items-center">
        <div class="col-xl-6 col-md-6">
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn" [ngClass]="period() === 'day' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('day')">Por Dia</button>
            <button type="button" class="btn" [ngClass]="period() === 'week' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('week')">Por Semana</button>
            <button type="button" class="btn" [ngClass]="period() === 'month' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('month')">Por Mes</button>
            <button type="button" class="btn" *ngIf="canUseRangeFilter" [ngClass]="period() === 'range' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('range')">Filtro Dinamico</button>
          </div>
        </div>

        <div class="col-xl-6 col-md-6">
          <div class="d-flex align-items-center gap-2 w-100">
            <div class="btn-group" role="group" *ngIf="isAdminUser">
              <button type="button" class="btn" [ngClass]="effectiveScope === 'all' ? 'btn-dark' : 'btn-outline-dark'" (click)="setScope('all')">Todo</button>
              <button type="button" class="btn" [ngClass]="effectiveScope === 'my_queue' ? 'btn-dark' : 'btn-outline-dark'" (click)="setScope('my_queue')">Mi Cola</button>
            </div>
            <div class="btn-group flex-grow-1" role="group" *ngIf="showSourceFilter">
              <button type="button" class="btn" [ngClass]="source() === 'all' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('all')">Todos</button>
              <button type="button" class="btn" [ngClass]="source() === 'woo' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('woo')">WooCommerce</button>
              <button type="button" class="btn" [ngClass]="source() === 'bsale' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('bsale')">Bsale</button>
            </div>
            <button class="btn btn-outline-secondary" (click)="reloadAll()" [disabled]="listLoading() || metricsLoading()">
              <span *ngIf="listLoading() || metricsLoading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
              <i *ngIf="!listLoading() && !metricsLoading()" class="ti ti-refresh me-1"></i>
              Recargar
            </button>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-2">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-filter me-1"></i>Estado:</span>
                <button class="btn btn-sm" [ngClass]="status() === '' ? 'btn-primary' : 'btn-outline-primary'" (click)="setStatus('')">Todos</button>
                <button class="btn btn-sm" *ngFor="let item of statusOptions" [ngClass]="status() === item.value ? 'btn-primary' : 'btn-outline-secondary'" (click)="setStatus(item.value)">
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-2" *ngIf="showWooStoreFilter">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-building-store me-1"></i>Tienda:</span>
                <button class="btn btn-sm" [ngClass]="selectedWooStore() === '' ? 'btn-primary' : 'btn-outline-primary'" (click)="clearWooStoreFilter()">Todas</button>
                <button class="btn btn-sm" *ngFor="let store of wooStores()" [ngClass]="selectedWooStore() === store.slug ? 'btn-warning' : 'btn-outline-secondary'" (click)="setWooStore(store.slug)">
                  {{ store.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-3 g-2" *ngIf="canUseRangeFilter && period() === 'range'">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-calendar-search me-1"></i>Rango de fechas:</span>
                <div class="d-flex align-items-center gap-2">
                  <label class="text-muted mb-0">Desde</label>
                  <input type="date" class="form-control form-control-sm" style="width:160px" [value]="dateFrom()" (change)="onDateFromChange($event)" />
                </div>
                <div class="d-flex align-items-center gap-2">
                  <label class="text-muted mb-0">Hasta</label>
                  <input type="date" class="form-control form-control-sm" style="width:160px" [value]="dateTo()" (change)="onDateToChange($event)" />
                </div>
                <button *ngIf="dateFrom() || dateTo()" class="btn btn-sm btn-outline-secondary" (click)="clearDateRange()">Limpiar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-2">
        <div class="col-12">
          <small class="text-muted"><i class="ti ti-search me-1"></i>Busqueda activa: {{ searchLabel }}</small>
          <small class="text-muted d-block mt-1" *ngIf="scopeMessage">{{ scopeMessage }}</small>
        </div>
      </div>

      <div class="row mb-4 g-3">
        <div class="col-lg col-md-6" *ngFor="let metric of metricCards">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">{{ metric.label }}</h6>
              <h3 [ngClass]="metric.className">{{ metric.value }}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h5 class="mb-0">Listado de Pedidos</h5>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <small class="text-muted">{{ pageRangeLabel }}</small>
                  <select class="form-select form-select-sm" style="width:96px" [value]="'' + perPage()" (change)="onPerPageChange($event)">
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>

              <div *ngIf="listLoading()" class="text-center py-4">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
              </div>

              <div *ngIf="!listLoading() && listError()" class="alert alert-danger mb-3">{{ listError() }}</div>

              <div *ngIf="!listLoading()" class="table-responsive">
                <table class="table table-striped table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>N° Pedido</th>
                      <th>Boleta Bsale</th>
                      <th>Nombre</th>
                      <th>Fecha</th>
                      <th>F. Entrega</th>
                      <th>F. Entregado</th>
                      <th>Ubicacion</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Tienda/Vendedor</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of orders()">
                      <td class="fw-semibold">{{ text(order.order_number, '-') }}</td>
                      <td>{{ text(order.bsale_receipt, '-') }}</td>
                      <td>{{ text(order.customer_name, 'No registrado') }}</td>
                      <td>{{ date(order.ordered_at, 'Sin fecha') }}</td>
                      <td>{{ date(order.delivery_date, 'Sin fecha', false) }}</td>
                      <td>{{ date(order.delivered_at, 'Sin fecha') }}</td>
                      <td>{{ text(order.location, 'No registrado') }}</td>
                      <td class="fw-semibold text-nowrap">{{ money(order.total) }}</td>
                      <td><span class="badge" [ngClass]="statusClass(order)">{{ order.status.label }}</span></td>
                      <td>
                        <div class="d-flex flex-column gap-1">
                          <span>{{ sourceLabel(order) }}</span>
                          <span class="badge align-self-start" [ngClass]="sourceBadgeClass(order)">{{ order.readonly ? 'Solo lectura' : 'Editable' }}</span>
                        </div>
                      </td>
                      <td><button class="btn btn-sm btn-primary" (click)="viewOrder(order)">Mas Info</button></td>
                    </tr>
                    <tr *ngIf="orders().length === 0">
                      <td colspan="11" class="text-center text-muted py-4">No hay pedidos para el filtro seleccionado.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!listLoading() && pagination().last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small class="text-muted">Pagina {{ pagination().current_page }} de {{ pagination().last_page }}</small>
                <nav>
                  <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" [class.disabled]="pagination().current_page === 1">
                      <button class="page-link" (click)="goToPage(1)" [disabled]="pagination().current_page === 1">&laquo;</button>
                    </li>
                    <li class="page-item" [class.disabled]="pagination().current_page === 1">
                      <button class="page-link" (click)="goToPage(pagination().current_page - 1)" [disabled]="pagination().current_page === 1">&lsaquo;</button>
                    </li>
                    <li *ngFor="let item of pageNumbers" class="page-item" [class.active]="item === pagination().current_page">
                      <button class="page-link" (click)="goToPage(item)">{{ item }}</button>
                    </li>
                    <li class="page-item" [class.disabled]="pagination().current_page === pagination().last_page">
                      <button class="page-link" (click)="goToPage(pagination().current_page + 1)" [disabled]="pagination().current_page === pagination().last_page">&rsaquo;</button>
                    </li>
                    <li class="page-item" [class.disabled]="pagination().current_page === pagination().last_page">
                      <button class="page-link" (click)="goToPage(pagination().last_page)" [disabled]="pagination().current_page === pagination().last_page">&raquo;</button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <app-order-detail-modal [order]="selectedOrder()" [isOpen]="showModal()" (closeModal)="closeModal()" (orderChanged)="refreshAll()"></app-order-detail-modal>
  `,
  styles: [`
    .delivery-hero-card {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.12));
      border: 1px solid rgba(59, 130, 246, 0.22);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }

    .delivery-hero-title {
      font-size: 1.9rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .delivery-hero-copy {
      color: #475569;
      font-size: 0.95rem;
    }

    :host-context(body.dark-mode) .delivery-hero-card {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(14, 165, 233, 0.12));
      border-color: rgba(96, 165, 250, 0.24);
      box-shadow: none;
    }

    :host-context(body.dark-mode) .delivery-hero-title {
      color: #eff6ff;
    }

    :host-context(body.dark-mode) .delivery-hero-copy {
      color: #cbd5e1;
    }

    .metric-card {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .badge {
      font-size: 0.8em;
    }
  `]
})
export class OrdersDashboardComponent implements OnInit, OnDestroy {
  readonly statusOptions = getDashboardStatusOptions();
  readonly source = signal<DashboardOrderSource>('all');
  readonly scope = signal<DashboardOrdersScope>('all');
  readonly period = signal<DashboardPeriod>('day');
  readonly status = signal<DashboardOrderStatusValue | ''>('');
  readonly selectedWooStore = signal('');
  readonly wooStores = signal<WooCommerceStore[]>([]);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly page = signal(1);
  readonly perPage = signal(20);
  readonly orders = signal<DashboardOrderRow[]>([]);
  readonly selectedOrder = signal<DashboardOrderRow | null>(null);
  readonly showModal = signal(false);
  readonly listLoading = signal(false);
  readonly metricsLoading = signal(false);
  readonly listError = signal('');
  readonly pagination = signal<DashboardOrdersResponse>({
    current_page: 1,
    data: [],
    from: null,
    last_page: 1,
    per_page: 20,
    to: null,
    total: 0
  });
  readonly metrics = signal<DashboardOrdersMetrics>({
    total_orders: 0,
    delivered_orders: 0,
    in_process_orders: 0,
    error_orders: 0,
    cancelled_orders: 0,
    total_amount: 0
  });

  private readonly authService = inject(AuthService);
  private readonly dashboardOrdersService = inject(DashboardOrdersService);
  private readonly wooCommerceService = inject(WooCommerceService);
  private readonly routeSearchService = inject(RouteSearchService);
  private readonly searchTerm = signal('');
  private cachedRows: DashboardOrderRow[] = [];
  private cachedPagination: DashboardOrdersResponse | null = null;
  private locallyFilteredRows: DashboardOrderRow[] = [];
  private searchReady = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsRequestId = 0;
  private listRequestId = 0;
  private localFilterRequestId = 0;

  constructor() {
    this.scope.set(this.isAdminUser ? 'all' : 'my_queue');

    effect(() => {
      const term = this.routeSearchService.currentTerm().trim();
      this.searchTerm.set(term);
      if (!this.searchReady) {
        this.searchReady = true;
        return;
      }
      this.page.set(1);
      this.scheduleRefresh(true);
    });
  }

  ngOnInit(): void {
    this.loadWooStores();
    this.refreshAll();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  get searchLabel(): string {
    return this.searchTerm() ? '"' + this.searchTerm() + '"' : 'Sin filtro';
  }

  get scopeMessage(): string {
    if (this.isEmpaquetadorUser) {
      return 'Vista operativa: se muestran todos los pedidos en proceso pendientes de empaquetado.';
    }

    if (!this.isAdminUser) {
      return 'Vista operativa: el backend devuelve solo tu cola asignada.';
    }

    return this.effectiveScope === 'my_queue'
      ? 'Vista operativa: se esta mostrando solo la cola asignada al usuario actual.'
      : '';
  }

  get showSourceFilter(): boolean {
    return !this.isDeliveryUser && !this.isEmpaquetadorUser;
  }

  get canUseRangeFilter(): boolean {
    return !this.isDeliveryUser;
  }

  get showWooStoreFilter(): boolean {
    return this.effectiveSource === 'woo' && this.wooStores().length > 0;
  }

  get metricCards(): Array<{ label: string; value: string | number; className?: string }> {
    const metrics = this.metrics();
    return [
      { label: 'Total Pedidos', value: metrics.total_orders },
      { label: 'Entregados', value: metrics.delivered_orders, className: 'text-success' },
      { label: 'En Proceso', value: metrics.in_process_orders, className: 'text-warning' },
      { label: 'Errores', value: metrics.error_orders, className: 'text-danger' },
      { label: 'Cancelados', value: metrics.cancelled_orders, className: 'text-secondary' },
      { label: 'Total Facturado', value: formatDashboardCurrency(metrics.total_amount), className: 'text-info' }
    ];
  }

  get pageNumbers(): number[] {
    const total = this.pagination().last_page;
    const current = this.pagination().current_page;
    const delta = 2;
    const pages: number[] = [];
    for (let value = Math.max(1, current - delta); value <= Math.min(total, current + delta); value += 1) {
      pages.push(value);
    }
    return pages;
  }

  get pageRangeLabel(): string {
    const current = this.pagination();
    if (current.total === 0) {
      return '0 pedidos encontrados';
    }
    return 'Mostrando ' + (current.from ?? 0) + '-' + (current.to ?? 0) + ' de ' + current.total + ' pedidos';
  }

  setSource(source: DashboardOrderSource): void {
    this.source.set(source);
    if (source !== 'woo') {
      this.selectedWooStore.set('');
    }
    this.page.set(1);
    this.refreshAll();
  }

  setWooStore(storeSlug: string): void {
    if (this.selectedWooStore() === storeSlug) {
      return;
    }
    this.selectedWooStore.set(storeSlug);
    this.page.set(1);
    this.refreshAll();
  }

  clearWooStoreFilter(): void {
    if (!this.selectedWooStore()) {
      return;
    }
    this.selectedWooStore.set('');
    this.page.set(1);
    this.refreshAll();
  }

  setScope(scope: DashboardOrdersScope): void {
    this.scope.set(scope);
    this.page.set(1);
    this.refreshAll();
  }

  setPeriod(period: DashboardPeriod): void {
    if (period === 'range' && !this.canUseRangeFilter) {
      return;
    }
    this.period.set(period);
    this.page.set(1);
    this.refreshAll();
  }

  setStatus(status: DashboardOrderStatusValue | ''): void {
    this.status.set(status);
    this.page.set(1);
    this.refreshAll();
  }

  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateFrom.set(input?.value || '');
    this.page.set(1);
    this.refreshAll();
  }

  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateTo.set(input?.value || '');
    this.page.set(1);
    this.refreshAll();
  }

  clearDateRange(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
    this.refreshAll();
  }

  onPerPageChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    const value = Number(input?.value || 20);
    this.perPage.set(Number.isFinite(value) ? value : 20);
    this.page.set(1);
    this.refreshList();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().last_page || page === this.pagination().current_page) {
      return;
    }
    this.page.set(page);
    this.refreshList();
  }

  reloadAll(): void {
    this.refreshAll();
  }

  viewOrder(order: DashboardOrderRow): void {
    this.selectedOrder.set(order);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedOrder.set(null);
  }

  text(value: unknown, fallback: string): string {
    return fallbackText(value, fallback);
  }

  date(value: string | null | undefined, fallback: string, includeTime: boolean = true): string {
    return formatDashboardDate(value, fallback, includeTime);
  }

  money(value: number): string {
    return formatDashboardCurrency(value);
  }

  statusClass(order: DashboardOrderRow): string {
    return getDashboardStatusClass(order.status.value);
  }

  sourceBadgeClass(order: DashboardOrderRow): string {
    return getDashboardSourceBadgeClass(order);
  }

  sourceLabel(order: DashboardOrderRow): string {
    return getDashboardSourceLabel(order);
  }

  private scheduleRefresh(searchChange: boolean): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => this.refreshAll(), searchChange ? 350 : 0);
  }

  refreshAll(): void {
    if (this.hasActiveWooStoreFilter()) {
      this.refreshWooStoreFilteredDashboard();
      return;
    }

    this.refreshMetrics();
    this.refreshList();
  }

  private refreshMetrics(): void {
    const requestId = ++this.metricsRequestId;
    this.metricsLoading.set(true);
    this.dashboardOrdersService.fetchDashboardMetrics(this.buildQuery()).subscribe({
      next: ({ metrics }) => {
        if (requestId !== this.metricsRequestId) {
          return;
        }
        if (!this.hasActiveSearch()) {
          this.metrics.set(metrics);
        }
        if (this.hasActiveSearch()) {
          this.metrics.set(this.buildMetricsFromRows(this.getFallbackSearchRows()));
        }
        this.metricsLoading.set(false);
      },
      error: () => {
        if (requestId !== this.metricsRequestId) {
          return;
        }
        this.metrics.set(this.hasActiveSearch() ? this.buildMetricsFromRows(this.getFallbackSearchRows()) : {
          total_orders: 0,
          delivered_orders: 0,
          in_process_orders: 0,
          error_orders: 0,
          cancelled_orders: 0,
          total_amount: 0
        });
        this.metricsLoading.set(false);
      }
    });
  }

  private refreshList(): void {
    if (this.hasActiveWooStoreFilter()) {
      if (this.locallyFilteredRows.length > 0) {
        this.listLoading.set(false);
        this.listError.set('');
        this.applyLocalPagination(this.locallyFilteredRows);
        return;
      }

      this.refreshWooStoreFilteredDashboard();
      return;
    }

    const requestId = ++this.listRequestId;
    this.listLoading.set(true);
    this.listError.set('');
    this.dashboardOrdersService.fetchDashboardOrders(this.buildQuery(true)).subscribe({
      next: (response) => {
        if (requestId !== this.listRequestId) {
          return;
        }
        if (!this.hasActiveSearch()) {
          this.cachedRows = response.data || [];
          this.cachedPagination = response;
        }
        this.orders.set(response.data || []);
        this.pagination.set(response);
        this.listLoading.set(false);
      },
      error: () => {
        if (requestId !== this.listRequestId) {
          return;
        }
        if (this.hasActiveSearch() && this.cachedPagination) {
          const filteredRows = this.getFallbackSearchRows();
          this.metricsRequestId += 1;
          this.orders.set(filteredRows);
          this.pagination.set({
            ...this.cachedPagination,
            current_page: 1,
            data: filteredRows,
            from: filteredRows.length ? 1 : null,
            to: filteredRows.length || null,
            total: filteredRows.length,
            last_page: 1,
            per_page: this.perPage()
          });
          this.metrics.set(this.buildMetricsFromRows(filteredRows));
          this.listError.set('');
          this.listLoading.set(false);
          return;
        }
        this.orders.set([]);
        this.listError.set('No se pudo cargar el listado de pedidos.');
        this.pagination.set({
          current_page: this.page(),
          data: [],
          from: null,
          last_page: 1,
          per_page: this.perPage(),
          to: null,
          total: 0
        });
        this.listLoading.set(false);
      }
    });
  }

  private refreshWooStoreFilteredDashboard(): void {
    const requestId = ++this.localFilterRequestId;
    this.listLoading.set(true);
    this.metricsLoading.set(true);
    this.listError.set('');

    this.dashboardOrdersService.fetchAllDashboardOrders(this.buildWooStoreLocalQuery()).subscribe({
      next: (rows) => {
        if (requestId !== this.localFilterRequestId) {
          return;
        }

        const filteredRows = this.applyWooStoreLocalFilters(rows);
        this.cachedRows = filteredRows;
        this.cachedPagination = null;
        this.locallyFilteredRows = filteredRows;
        this.metrics.set(this.buildMetricsFromRows(filteredRows));
        this.applyLocalPagination(filteredRows);
        this.metricsLoading.set(false);
        this.listLoading.set(false);
      },
      error: () => {
        if (requestId !== this.localFilterRequestId) {
          return;
        }

        this.locallyFilteredRows = [];
        this.orders.set([]);
        this.metrics.set({
          total_orders: 0,
          delivered_orders: 0,
          in_process_orders: 0,
          error_orders: 0,
          cancelled_orders: 0,
          total_amount: 0
        });
        this.pagination.set({
          current_page: 1,
          data: [],
          from: null,
          last_page: 1,
          per_page: this.perPage(),
          to: null,
          total: 0
        });
        this.listError.set('No se pudo cargar el listado de pedidos.');
        this.metricsLoading.set(false);
        this.listLoading.set(false);
      }
    });
  }

  private buildQuery(includePagination: boolean = false): DashboardOrdersQuery {
    const bounds = this.getPeriodBounds();
    return {
      source: this.effectiveSource,
      scope: this.effectiveScope,
      period: this.period(),
      date_from: bounds.dateFrom,
      date_to: bounds.dateTo,
      search: this.searchTerm() || undefined,
      status: this.status() || undefined,
      store_slug: this.effectiveSource === 'woo' ? this.selectedWooStore() || undefined : undefined,
      page: includePagination ? this.page() : undefined,
      per_page: includePagination ? this.perPage() : undefined
    };
  }

  private buildWooStoreLocalQuery(): Omit<DashboardOrdersQuery, 'page' | 'per_page'> {
    const query = this.buildQuery();
    return {
      ...query,
      search: undefined,
      store_slug: undefined
    };
  }

  private getPeriodBounds(): { dateFrom?: string; dateTo?: string } {
    const today = new Date();
    const currentPeriod = this.period();

    if (currentPeriod === 'range') {
      return {
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined
      };
    }

    if (currentPeriod === 'day') {
      const value = this.toLocalDateString(today);
      return { dateFrom: value, dateTo: value };
    }

    if (currentPeriod === 'week') {
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

  get isAdminUser(): boolean {
    return this.authService.isAdmin();
  }

  get effectiveScope(): DashboardOrdersScope {
    if (this.isEmpaquetadorUser) {
      return 'all';
    }

    return this.isAdminUser ? this.scope() : 'my_queue';
  }

  get effectiveSource(): DashboardOrderSource {
    return this.isDeliveryUser || this.isEmpaquetadorUser ? 'all' : this.source();
  }

  get isDeliveryUser(): boolean {
    return this.authService.getCurrentUser()?.role === UserRole.DELIVERY;
  }

  get isEmpaquetadorUser(): boolean {
    return this.authService.getCurrentUser()?.role === UserRole.EMPAQUETADOR;
  }

  private loadWooStores(): void {
    this.wooCommerceService.listStores().subscribe({
      next: (stores) => {
        this.wooStores.set(
          [...stores]
            .filter((store) => !!String(store.slug || '').trim())
            .sort((left, right) => left.label.localeCompare(right.label))
        );
      },
      error: () => {
        this.wooStores.set([]);
      }
    });
  }

  private hasActiveSearch(): boolean {
    return !!this.searchTerm().trim();
  }

  private hasActiveWooStoreFilter(): boolean {
    return this.effectiveSource === 'woo' && !!this.selectedWooStore().trim();
  }

  private applyWooStoreLocalFilters(rows: DashboardOrderRow[]): DashboardOrderRow[] {
    const selectedStore = this.selectedWooStore().trim().toLowerCase();
    const term = this.searchTerm().trim().toLowerCase();

    return rows.filter((row) => {
      const rowStore = String(row.store_slug || '').trim().toLowerCase();
      if (selectedStore && rowStore !== selectedStore) {
        return false;
      }

      if (term && !this.rowMatchesSearch(row, term)) {
        return false;
      }

      return true;
    });
  }

  private applyLocalPagination(rows: DashboardOrderRow[]): void {
    const total = rows.length;
    const lastPage = Math.max(1, Math.ceil(total / this.perPage()));
    const currentPage = Math.min(this.page(), lastPage);
    const startIndex = (currentPage - 1) * this.perPage();
    const pagedRows = rows.slice(startIndex, startIndex + this.perPage());

    if (currentPage !== this.page()) {
      this.page.set(currentPage);
    }

    this.orders.set(pagedRows);
    this.pagination.set({
      current_page: currentPage,
      data: pagedRows,
      from: total ? startIndex + 1 : null,
      last_page: lastPage,
      per_page: this.perPage(),
      to: total ? startIndex + pagedRows.length : null,
      total
    });
  }

  private getFallbackSearchRows(): DashboardOrderRow[] {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return [...this.cachedRows];
    }

    return this.cachedRows.filter((row) => this.rowMatchesSearch(row, term));
  }

  private rowMatchesSearch(row: DashboardOrderRow, term: string): boolean {
    const values = [
      row.order_number,
      row.bsale_receipt,
      row.customer_name,
      row.vendor_name,
      row.store_slug,
      row.status?.label,
      row.ordered_at
    ];

    return values.some((value) => String(value || '').toLowerCase().includes(term));
  }

  private buildMetricsFromRows(rows: DashboardOrderRow[]): DashboardOrdersMetrics {
    return {
      total_orders: rows.length,
      delivered_orders: rows.filter((row) => row.status.value === 'entregado').length,
      in_process_orders: rows.filter((row) => ['en_proceso', 'empaquetado', 'despachado', 'en_camino'].includes(row.status.value)).length,
      error_orders: rows.filter((row) => row.status.value === 'error_en_pedido').length,
      cancelled_orders: rows.filter((row) => row.status.value === 'cancelado').length,
      total_amount: rows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    };
  }
}