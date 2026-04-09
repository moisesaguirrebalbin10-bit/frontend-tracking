import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import {
  DashboardOrdersScope,
  DashboardOrderRow,
  DashboardOrderSource,
  DashboardOrderStatusValue,
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
import { OrderDetailModalComponent } from '../../dashboard/orders-dashboard/order-detail-modal.component';

type DashboardPeriod = 'day' | 'week' | 'month' | 'range';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [CommonModule, OrderDetailModalComponent],
  template: `
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <div class="delivery-history-banner mb-3" *ngIf="isDeliveryUser">
                <h3 class="delivery-history-title mb-1">Este es el Listado de los Pedidos que has llevado desde tu inicio</h3>
                <p class="delivery-history-copy mb-0">Aqui puedes revisar tu historial operativo de pedidos asignados y entregas gestionadas desde tu sesion.</p>
              </div>

              <div class="delivery-history-banner mb-3" *ngIf="isEmpaquetadorUser">
                <h3 class="delivery-history-title mb-1">Este es el Listado de Pedidos En Proceso pendientes que hay en general</h3>
                <p class="delivery-history-copy mb-0">Revisar si ya fueron despachados previamente o su estado falto actualizar en el sistema como Completados.</p>
              </div>

              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 class="mb-0">Pedidos</h5>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <button class="btn btn-sm btn-outline-secondary" (click)="reload()" [disabled]="loading()">
                    <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
                    <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
                    Recargar
                  </button>
                  <div class="btn-group" role="group" *ngIf="isAdminUser">
                    <button type="button" class="btn btn-sm" [ngClass]="effectiveScope === 'all' ? 'btn-dark' : 'btn-outline-dark'" (click)="setScope('all')">Todo</button>
                    <button type="button" class="btn btn-sm" [ngClass]="effectiveScope === 'my_queue' ? 'btn-dark' : 'btn-outline-dark'" (click)="setScope('my_queue')">Mi Cola</button>
                  </div>
                  <div class="btn-group" role="group" *ngIf="showSourceFilter">
                    <button type="button" class="btn btn-sm" [ngClass]="source() === 'all' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('all')">Todos</button>
                    <button type="button" class="btn btn-sm" [ngClass]="source() === 'woo' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('woo')">WooCommerce</button>
                    <button type="button" class="btn btn-sm" [ngClass]="source() === 'bsale' ? 'btn-primary' : 'btn-outline-primary'" (click)="setSource('bsale')">Bsale</button>
                  </div>
                </div>
              </div>

              <div class="d-flex align-items-center gap-2 flex-wrap mt-3">
                <span class="text-muted small fw-semibold">Periodo:</span>
                <div class="btn-group btn-group-sm" role="group">
                  <button class="btn" [ngClass]="period() === 'day' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('day')">Dia</button>
                  <button class="btn" [ngClass]="period() === 'week' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('week')">Semana</button>
                  <button class="btn" [ngClass]="period() === 'month' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('month')">Mes</button>
                  <button class="btn" [ngClass]="period() === 'range' ? 'btn-primary' : 'btn-outline-primary'" (click)="setPeriod('range')">Rango</button>
                </div>

                <select class="form-select form-select-sm" style="width:180px" *ngIf="showStatusFilter" [value]="status()" (change)="onStatusChange($event)">
                  <option value="">Todos los estados</option>
                  <option *ngFor="let item of visibleStatusOptions" [value]="item.value">{{ item.label }}</option>
                </select>

                <select class="form-select form-select-sm" style="width:96px" [value]="'' + perPage()" (change)="onPerPageChange($event)">
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div class="d-flex align-items-center gap-2 flex-wrap mt-3" *ngIf="showWooStoreFilter">
                <span class="text-muted small fw-semibold">Tienda:</span>
                <button class="btn btn-sm" [ngClass]="selectedWooStore() === '' ? 'btn-primary' : 'btn-outline-primary'" (click)="clearWooStoreFilter()">Todas</button>
                <button class="btn btn-sm" *ngFor="let store of wooStores()" [ngClass]="selectedWooStore() === store.slug ? 'btn-warning' : 'btn-outline-secondary'" (click)="setWooStore(store.slug)">
                  {{ store.label }}
                </button>
              </div>

              <div class="d-flex align-items-center gap-2 flex-wrap mt-3" *ngIf="period() === 'range'">
                <input type="date" class="form-control form-control-sm" style="width:150px" [value]="dateFrom()" (change)="onDateFromChange($event)" />
                <input type="date" class="form-control form-control-sm" style="width:150px" [value]="dateTo()" (change)="onDateToChange($event)" />
                <button class="btn btn-sm btn-outline-secondary" *ngIf="dateFrom() || dateTo()" (click)="clearDateRange()">Limpiar</button>
              </div>

              <small class="text-muted d-block mt-3">Busqueda activa: {{ searchLabel }}</small>
              <small class="text-muted d-block mt-1" *ngIf="scopeMessage">{{ scopeMessage }}</small>
            </div>

            <div class="card-body">
              <div *ngIf="error()" class="alert alert-danger mb-3">{{ error() }}</div>

              <div *ngIf="loading()" class="text-center py-4">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
              </div>

              <div *ngIf="!loading()" class="table-responsive">
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
                      <td colspan="11" class="text-center text-muted py-4">No se encontraron pedidos para los filtros aplicados.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!loading() && pagination().last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small class="text-muted">{{ pageRangeLabel }}</small>
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

    <app-order-detail-modal [order]="selectedOrder()" [isOpen]="showModal()" (closeModal)="closeModal()" (orderChanged)="reload()"></app-order-detail-modal>
  `,
  styles: [`
    .delivery-history-banner {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.12));
      border: 1px solid rgba(59, 130, 246, 0.22);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
      padding: 1rem 1.25rem;
    }

    .delivery-history-title {
      color: #0f172a;
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .delivery-history-copy {
      color: #475569;
      font-size: 0.95rem;
    }

    :host-context(body.dark-mode) .delivery-history-banner {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(14, 165, 233, 0.12));
      border-color: rgba(96, 165, 250, 0.24);
      box-shadow: none;
    }

    :host-context(body.dark-mode) .delivery-history-title {
      color: #eff6ff;
    }

    :host-context(body.dark-mode) .delivery-history-copy {
      color: #cbd5e1;
    }

    .badge {
      font-size: 0.8em;
    }

    .table-hover tbody tr:hover {
      background-color: #f8f9fa;
    }
  `]
})
export class OrdersListComponent implements OnInit, OnDestroy {
  readonly statusOptions = getDashboardStatusOptions();
  readonly source = signal<DashboardOrderSource>('all');
  readonly scope = signal<DashboardOrdersScope>('all');
  readonly period = signal<DashboardPeriod>('day');
  readonly status = signal<DashboardOrderStatusValue | ''>('');
  readonly selectedWooStore = signal('');
  readonly wooStores = signal<WooCommerceStore[]>([]);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly perPage = signal(20);
  readonly page = signal(1);
  readonly orders = signal<DashboardOrderRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selectedOrder = signal<DashboardOrderRow | null>(null);
  readonly showModal = signal(false);
  readonly pagination = signal<DashboardOrdersResponse>({
    current_page: 1,
    data: [],
    from: null,
    last_page: 1,
    per_page: 20,
    to: null,
    total: 0
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
  private requestId = 0;
  private localFilterRequestId = 0;

  constructor() {
    this.scope.set(this.isAdminUser ? 'all' : 'my_queue');

    effect(() => {
      const term = this.routeSearchService.ordersTerm().trim();
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
    this.reload();
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

  get showStatusFilter(): boolean {
    return !this.isEmpaquetadorUser;
  }

  get showWooStoreFilter(): boolean {
    return this.effectiveSource === 'woo' && this.wooStores().length > 0;
  }

  get visibleStatusOptions(): Array<{ value: DashboardOrderStatusValue; label: string }> {
    if (!this.isDeliveryUser) {
      return this.statusOptions;
    }

    const allowed = new Set<DashboardOrderStatusValue>([
      'despachado',
      'en_camino',
      'entregado',
      'error_en_pedido',
      'cancelado'
    ]);

    return this.statusOptions.filter((item) => allowed.has(item.value));
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
    this.reload();
  }

  setWooStore(storeSlug: string): void {
    if (this.selectedWooStore() === storeSlug) {
      return;
    }
    this.selectedWooStore.set(storeSlug);
    this.page.set(1);
    this.reload();
  }

  clearWooStoreFilter(): void {
    if (!this.selectedWooStore()) {
      return;
    }
    this.selectedWooStore.set('');
    this.page.set(1);
    this.reload();
  }

  setScope(scope: DashboardOrdersScope): void {
    this.scope.set(scope);
    this.page.set(1);
    this.reload();
  }

  setPeriod(period: DashboardPeriod): void {
    this.period.set(period);
    this.page.set(1);
    this.reload();
  }

  onStatusChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    this.status.set((input?.value || '') as DashboardOrderStatusValue | '');
    this.page.set(1);
    this.reload();
  }

  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateFrom.set(input?.value || '');
    this.page.set(1);
    this.reload();
  }

  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.dateTo.set(input?.value || '');
    this.page.set(1);
    this.reload();
  }

  clearDateRange(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
    this.reload();
  }

  onPerPageChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    const value = Number(input?.value || 20);
    this.perPage.set(Number.isFinite(value) ? value : 20);
    this.page.set(1);
    this.reload();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().last_page || page === this.pagination().current_page) {
      return;
    }
    this.page.set(page);
    this.reload();
  }

  reload(): void {
    if (this.hasActiveWooStoreFilter()) {
      this.reloadWithWooStoreFilter();
      return;
    }

    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    this.dashboardOrdersService.fetchDashboardOrders(this.buildQuery()).subscribe({
      next: (response) => {
        if (requestId !== this.requestId) {
          return;
        }
        if (!this.hasActiveSearch()) {
          this.cachedRows = response.data || [];
          this.cachedPagination = response;
        }
        this.orders.set(response.data || []);
        this.pagination.set(response);
        this.loading.set(false);
      },
      error: () => {
        if (requestId !== this.requestId) {
          return;
        }
        if (this.hasActiveSearch() && this.cachedPagination) {
          const filteredRows = this.getFallbackSearchRows();
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
          this.error.set('');
          this.loading.set(false);
          return;
        }
        this.orders.set([]);
        this.error.set('No se pudo cargar el listado de pedidos.');
        this.pagination.set({
          current_page: this.page(),
          data: [],
          from: null,
          last_page: 1,
          per_page: this.perPage(),
          to: null,
          total: 0
        });
        this.loading.set(false);
      }
    });
  }

  private reloadWithWooStoreFilter(): void {
    const requestId = ++this.localFilterRequestId;
    this.loading.set(true);
    this.error.set('');

    this.dashboardOrdersService.fetchAllDashboardOrders(this.buildWooStoreLocalQuery()).subscribe({
      next: (rows) => {
        if (requestId !== this.localFilterRequestId) {
          return;
        }

        const filteredRows = this.applyWooStoreLocalFilters(rows);
        this.cachedRows = filteredRows;
        this.cachedPagination = null;
        this.locallyFilteredRows = filteredRows;
        this.applyLocalPagination(filteredRows);
        this.loading.set(false);
      },
      error: () => {
        if (requestId !== this.localFilterRequestId) {
          return;
        }

        this.locallyFilteredRows = [];
        this.orders.set([]);
        this.pagination.set({
          current_page: 1,
          data: [],
          from: null,
          last_page: 1,
          per_page: this.perPage(),
          to: null,
          total: 0
        });
        this.error.set('No se pudo cargar el listado de pedidos.');
        this.loading.set(false);
      }
    });
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

  sourceLabel(order: DashboardOrderRow): string {
    return getDashboardSourceLabel(order);
  }

  sourceBadgeClass(order: DashboardOrderRow): string {
    return getDashboardSourceBadgeClass(order);
  }

  private scheduleRefresh(searchChange: boolean): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => this.reload(), searchChange ? 350 : 0);
  }

  private buildQuery(): DashboardOrdersQuery {
    const bounds = this.getPeriodBounds();
    return {
      source: this.effectiveSource,
      scope: this.effectiveScope,
      period: this.period(),
      date_from: bounds.dateFrom,
      date_to: bounds.dateTo,
      search: this.searchTerm() || undefined,
      status: this.effectiveStatus,
      store_slug: this.effectiveSource === 'woo' ? this.selectedWooStore() || undefined : undefined,
      page: this.page(),
      per_page: this.perPage()
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

  get effectiveStatus(): DashboardOrderStatusValue | undefined {
    if (this.isEmpaquetadorUser) {
      return 'en_proceso';
    }

    return (this.status() || undefined) as DashboardOrderStatusValue | undefined;
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
}