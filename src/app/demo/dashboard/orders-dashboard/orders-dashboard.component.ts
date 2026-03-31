
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from './order-detail-modal.component';
import { RouteSearchService } from '../../../theme/shared/service/route-search.service';
import { BsaleService, BsalePaginationState } from '../../../services/bsale.service';

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
              <button type="button" class="btn" [ngClass]="dataSource() === 'woocommerce' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('woocommerce')">WooCommerce</button>
              <button type="button" class="btn" [ngClass]="dataSource() === 'bsale' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('bsale')">
                <i class="ti ti-receipt me-1"></i>Bsale
              </button>
            </div>
            <button class="btn btn-outline-secondary" (click)="reloadAll()" [disabled]="loading()" title="Recargar pedidos desde el servidor" style="white-space:nowrap">
              <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
              <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
              Recargar
            </button>
          </div>
        </div>
      </div>

      <!-- Filtro por Estado -->
      <div class="row mb-3 g-2">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="text-muted fw-semibold"><i class="ti ti-filter me-1"></i>Estado:</span>
                <button class="btn btn-sm"
                  [ngClass]="selectedStatusFilter() === '' ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="setStatusFilter('')">Todos</button>
                <button class="btn btn-sm" *ngFor="let s of allStatuses"
                  [ngClass]="selectedStatusFilter() === s.value ? 'btn-primary' : 'btn-outline-secondary'"
                  (click)="setStatusFilter(s.value)">{{ s.label }}</button>
              </div>
            </div>
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
                  [ngClass]="selectedStoreSlugs().length === 0 && dataSource() !== 'bsale' ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="clearStoreFilter(); setDataSource('all')">Todas</button>
                <button
                  class="btn btn-sm"
                  [ngClass]="dataSource() === 'bsale' ? 'btn-info' : 'btn-outline-info'"
                  (click)="clearStoreFilter(); setDataSource('bsale')">
                  <i class="ti ti-receipt me-1"></i>Bsale
                </button>
                <button
                  *ngFor="let store of availableStores()"
                  class="btn btn-sm"
                  [ngClass]="isStoreSelected(store.slug) && dataSource() !== 'bsale' ? 'btn-warning' : 'btn-outline-secondary'"
                  (click)="onStoreButtonClick(store.slug)">{{ store.label }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-4 g-3">
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Total Pedidos</h6>
              <h3>{{ totalOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Entregados</h6>
              <h3 class="text-success">{{ deliveredOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">En Proceso</h6>
              <h3 class="text-warning">{{ inProgressOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Errores</h6>
              <h3 class="text-danger">{{ errorOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Cancelados</h6>
              <h3 class="text-secondary">{{ cancelledOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-lg col-md-6">
          <div class="card metric-card h-100">
            <div class="card-body">
              <h6 class="text-muted">Total Facturado</h6>
              <h3 class="text-info">{{ totalBilled() | number:'1.0-0' }}</h3>
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

              <div *ngIf="!loading() && dataSource() === 'bsale' && bsaleErrorMessage()" class="alert alert-warning mb-3" role="alert">
                {{ bsaleErrorMessage() }}
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
                      <th>Ubicación</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Tienda/Vendedor</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of pagedOrders">
                      <td class="fw-semibold">{{ order.external_id || '-' }}</td>
                      <td>{{ getBsaleSerieDisplay(order) }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td>{{ getOrderCreatedAtDisplay(order) }}</td>
                      <td>{{ getEstimatedDeliveryDisplay(order) }}</td>
                      <td>{{ order.status === 'ENTREGADO' && order.delivery_date ? (order.delivery_date | date: 'short') : '-' }}</td>
                      <td><small>{{ getDeliveryLocationDisplay(order) }}</small></td>
                      <td class="fw-semibold text-nowrap">{{ getCurrencySymbol(order) }} {{ order.total | number:'1.0-2' }}</td>
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
                      <td colspan="11" class="text-center text-muted py-4">No hay pedidos para el filtro seleccionado.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!loading() && dataSource() !== 'bsale' && totalPages > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
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

              <div *ngIf="!loading() && showBsalePagination()" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small class="text-muted">Página {{ bsalePagination()?.currentPage ?? 1 }} de {{ bsaleTotalPages() }}</small>
                <nav>
                  <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" [class.disabled]="(bsalePagination()?.currentPage ?? 1) === 1">
                      <button class="page-link" (click)="bsalePrevPage()" [disabled]="(bsalePagination()?.currentPage ?? 1) === 1">&lsaquo;</button>
                    </li>
                    <li *ngFor="let p of bsalePageNumbers" class="page-item" [class.active]="p === (bsalePagination()?.currentPage ?? 1)">
                      <button class="page-link" (click)="bsaleGoToPage(p)">{{ p }}</button>
                    </li>
                    <li class="page-item" [class.disabled]="(bsalePagination()?.currentPage ?? 1) === bsaleTotalPages()">
                      <button class="page-link" (click)="bsaleNextPage()" [disabled]="(bsalePagination()?.currentPage ?? 1) === bsaleTotalPages()">&rsaquo;</button>
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

  /**
   * Devuelve la fecha de creación del pedido, priorizando meta.date_created (Woo) y mostrando siempre en hora Perú.
   */
  getOrderCreatedAtDisplay(order: any): string {
    let meta = order.meta;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    let result;
    if (
      (order.source === 'woocommerce' || order.store_slug) &&
      meta &&
      typeof meta === 'object' &&
      meta.date_created
    ) {
      result = meta.date_created;
    } else {
      result = order.created_at;
    }
    
    // Formatear a dd/MM/yy HH:mm si es posible
    if (!result) return '-';
    let d = result.replace('T', ' ').replace(/-/g, '/');
    let [datePart, timePart] = d.split(' ');
    if (!datePart || !timePart) return result;
    let [yyyy, mm, dd] = datePart.split('/');
    let [hh, min] = timePart.split(':');
    if (!yyyy || !mm || !dd || !hh || !min) return result;
    return `${dd}/${mm.slice(0,2)}/${yyyy.slice(2)} ${hh}:${min}`;
  }

    // Maneja el click en un botón de tienda Woo, asegurando que si está en Bsale cambie a 'all' antes de alternar la tienda
    onStoreButtonClick(slug: string) {
      if (this.dataSource() === 'bsale') {
        this.setDataSource('all');
      }
      this.toggleStore(slug);
    }
  timeframe = signal<'day' | 'week' | 'month' | 'range'>('day');
  dataSource = signal<'woocommerce' | 'bsale' | 'all'>('all');
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
  cancelledOrders = signal(0);
  totalBilled = signal(0);

  selectedStatusFilter = signal<string>('');

  readonly allStatuses = [
    { value: 'EN_PROCESO',  label: 'En Proceso' },
    { value: 'EMPAQUETADO', label: 'Empaquetado' },
    { value: 'DESPACHADO',  label: 'Despachado' },
    { value: 'EN_CAMINO',   label: 'En Camino' },
    { value: 'ENTREGADO',   label: 'Entregado' },
    { value: 'ERROR',       label: 'Error' },
    { value: 'CANCELADO',   label: 'Cancelado' },
  ];

  currentPage = signal(1);
  readonly pageSize = 50;

  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);
  availableStores = signal<StoreFilterOption[]>([]);
  selectedStoreSlugs = signal<string[]>([]);
  bsaleOrders = signal<Order[]>([]);
  bsalePagination = signal<BsalePaginationState | null>(null);
  bsaleErrorMessage = signal<string | null>(null);
  private hasFullDataset = signal(false);
  private routeSearchService = inject(RouteSearchService);

  get pageRangeLabel(): string {
    if (this.dataSource() === 'bsale') {
      const pagination = this.bsalePagination();
      const isDayFilter = this.timeframe() === 'day';
      const total = isDayFilter
        ? this.filteredOrders().length
        : (pagination?.totalRegistros ?? this.filteredOrders().length);
      if (total === 0) return '0 pedidos encontrados';
      if (isDayFilter) {
        return `Mostrando ${total} pedidos del día (últimos ${pagination?.limit ?? this.pageSize} registros cargados)`;
      }
      const currentPage = pagination?.currentPage ?? 1;
      const limit = pagination?.limit ?? this.pageSize;
      const start = (currentPage - 1) * limit + 1;
      const end = Math.min(currentPage * limit, total);
      return `Mostrando ${start}–${end} de ${total} pedidos`;
    }

    const total = this.apiTotal();
    if (total === 0) return '0 pedidos encontrados';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, total);
    return `Mostrando ${start}–${end} de ${total} pedidos`;
  }

  get pagedOrders(): Order[] {
    if (this.dataSource() === 'bsale') {
      return this.filteredOrders();
    }

    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    if (this.dataSource() === 'bsale') {
      return this.bsaleTotalPages();
    }
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
    if (this.dataSource() === 'bsale') {
      this.bsaleGoToPage(page);
      return;
    }
    this.currentPage.set(page);
  }

  constructor(
    private orderService: OrderService,
    private bsaleService: BsaleService
  ) {
    effect(() => {
      this.routeSearchService.currentTerm();
      this.currentPage.set(1);
      this.applyFilters();
    });
  }

  ngOnInit() {
    this.loadAllOrdersOnce(true);
    this.preloadBsaleForAll();
  }

  setStatusFilter(status: string) {
    this.selectedStatusFilter.set(status);
    this.currentPage.set(1);
    this.applyFilters();
  }

  setTimeframe(tf: 'day' | 'week' | 'month' | 'range') {
    this.timeframe.set(tf);
    this.currentPage.set(1);
    if (this.dataSource() !== 'bsale' && tf === 'range' && !this.hasFullDataset()) {
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

  setDataSource(source: 'woocommerce' | 'bsale' | 'all') {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    if (source !== 'bsale') {
      this.bsaleErrorMessage.set(null);
    }
    this.currentPage.set(1);
    if (source === 'bsale') {
      if (!this.bsalePagination()) {
        this.loadBsalePage1();
      } else {
        this.applyFilters();
      }
      return;
    }

    if (source === 'all' && !this.bsalePagination()) {
      this.preloadBsaleForAll();
    }

    this.applyFilters();
  }

  toggleStore(slug: string) {
    const current = this.selectedStoreSlugs();
    const idx = current.indexOf(slug);
    this.selectedStoreSlugs.set(idx >= 0 ? current.filter(s => s !== slug) : [...current, slug]);
    this.currentPage.set(1);
    if (this.dataSource() !== 'bsale' && this.timeframe() === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  clearStoreFilter() {
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    if (this.dataSource() !== 'bsale' && this.timeframe() === 'range' && !this.hasFullDataset()) {
      this.loadAllOrdersOnce(true);
      return;
    }
    this.applyFilters();
  }

  isStoreSelected(slug: string): boolean {
    return this.selectedStoreSlugs().includes(slug);
  }

  private loadBsalePage1() {
    this.loading.set(true);
    this.orderService.getBsaleOrdersFirstPage().subscribe({
      next: ({ orders, pagination }) => {
        this.bsaleErrorMessage.set(null);
        this.bsaleOrders.set(this.sortOrdersByCreatedAtDesc(orders));
        this.bsalePagination.set(pagination);
        this.currentPage.set(pagination.currentPage);
        this.applyFilters();
        this.loading.set(false);
      },
      error: (err) => {
        this.bsaleErrorMessage.set(this.getBsaleErrorMessage(err));
        this.bsaleOrders.set([]);
        this.bsalePagination.set(null);
        this.applyFilters();
        this.loading.set(false);
      }
    });
  }

  reloadAll() {
    if (this.dataSource() === 'bsale') {
      this.bsaleErrorMessage.set(null);
      this.bsaleService.resetCache();
      this.loadBsalePage1();
      return;
    }

    if (this.dataSource() === 'all') {
      this.bsaleErrorMessage.set(null);
      this.bsaleService.resetCache();
      this.preloadBsaleForAll(true);
    }

    this.loadAllOrdersOnce(true);
  }

  private preloadBsaleForAll(forceRefresh: boolean = false) {
    if (!forceRefresh && this.bsalePagination()) {
      return;
    }

    this.orderService.getBsaleOrdersFirstPage().subscribe({
      next: ({ orders, pagination }) => {
        this.bsaleOrders.set(this.sortOrdersByCreatedAtDesc(orders));
        this.bsalePagination.set(pagination);

        if (this.dataSource() === 'all') {
          this.applyFilters();
        }
      },
      error: (err) => {
        if (this.dataSource() === 'bsale') {
          this.bsaleErrorMessage.set(this.getBsaleErrorMessage(err));
        }
      }
    });
  }

  bsaleTotalPages(): number {
    const pagination = this.bsalePagination();
    if (!pagination) return 1;
    return this.bsaleService.getTotalPages(pagination.totalRegistros);
  }

  showBsalePagination(): boolean {
    return this.dataSource() === 'bsale' && this.timeframe() !== 'day' && this.bsaleTotalPages() > 1;
  }

  get bsalePageNumbers(): number[] {
    const total = this.bsaleTotalPages();
    const current = this.bsalePagination()?.currentPage ?? 1;
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }

    return range;
  }

  bsaleGoToPage(page: number) {
    const total = this.bsalePagination()?.totalRegistros ?? 0;
    if (page < 1 || page > this.bsaleTotalPages()) return;

    this.loading.set(true);
    this.orderService.getBsaleOrdersPage(page, total).subscribe({
      next: ({ orders, pagination }) => {
        this.bsaleErrorMessage.set(null);
        this.bsaleOrders.set(this.sortOrdersByCreatedAtDesc(orders));
        this.bsalePagination.set(pagination);
        this.currentPage.set(pagination.currentPage);
        this.applyFilters();
        this.loading.set(false);
      },
      error: (err) => {
        this.bsaleErrorMessage.set(this.getBsaleErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  bsalePrevPage() {
    const current = this.bsalePagination()?.currentPage ?? 1;
    if (current > 1) {
      this.bsaleGoToPage(current - 1);
    }
  }

  bsaleNextPage() {
    const current = this.bsalePagination()?.currentPage ?? 1;
    if (current < this.bsaleTotalPages()) {
      this.bsaleGoToPage(current + 1);
    }
  }

  loadAllOrdersOnce(fullData: boolean) {
    this.loading.set(true);
    this.hasFullDataset.set(fullData);

    this.fetchAllInternalOrders(fullData).subscribe({
      next: (orders) => {
        const sortedOrders = this.sortOrdersByCreatedAtDesc(orders);
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

  private sortOrdersByCreatedAtDesc(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      if (aTime === bTime) {
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      }

      return bTime - aTime;
    });
  }

  private fetchAllInternalOrders(fullData: boolean): Observable<Order[]> {
    return this.orderService.getOrders(1, this.pageSize).pipe(
      switchMap(firstPage => {
        const allOrders = [...firstPage.data];
        if (!fullData) {
          return of(allOrders);
        }
        const lastPage = firstPage.last_page || 1;
        if (lastPage <= 1) return of(allOrders);
        const remaining = Array.from({ length: lastPage - 1 }, (_, i) =>
          this.orderService.getOrders(i + 2, this.pageSize).pipe(
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
    const statusFilter = this.selectedStatusFilter().trim().toUpperCase();
    const now = new Date();
    const sourceOrders = this.getSourceOrdersForFilters();
    const filtered = sourceOrders
      .filter((order) => this.matchesDataSource(order))
      .filter((order) => this.isWithinSelectedTimeframe(order.created_at, now))
      .filter((order) => this.matchesSearch(order, searchTerm))
      .filter((order) => !statusFilter || this.normalizeStatus(order.status) === statusFilter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    this.filteredOrders.set(filtered);
    if (this.dataSource() === 'bsale') {
      if (this.timeframe() === 'day') {
        this.apiTotal.set(filtered.length);
        this.apiLastPage.set(1);
        this.currentPage.set(1);
      } else {
        this.apiTotal.set(this.bsalePagination()?.totalRegistros ?? filtered.length);
        this.apiLastPage.set(this.bsaleTotalPages());
        this.currentPage.set(this.bsalePagination()?.currentPage ?? 1);
      }
    } else {
      this.apiTotal.set(filtered.length);
      this.apiLastPage.set(Math.max(1, Math.ceil(filtered.length / this.pageSize)));
    }
    this.totalOrders.set(filtered.length);
    this.deliveredOrders.set(filtered.filter((order) => this.normalizeStatus(order.status) === 'ENTREGADO').length);
    this.inProgressOrders.set(
      filtered.filter((order) => ['EN_PROCESO', 'EMPAQUETADO', 'DESPACHADO', 'EN_CAMINO'].includes(this.normalizeStatus(order.status))).length
    );
    this.errorOrders.set(filtered.filter((order) => ['ERROR', 'ERROR_EN_PEDIDO'].includes(this.normalizeStatus(order.status))).length);
    this.cancelledOrders.set(filtered.filter((order) => this.normalizeStatus(order.status) === 'CANCELADO').length);
    this.totalBilled.set(filtered.reduce((sum, o) => sum + this.toNumericTotal(o.total), 0));
  }

  private getSourceOrdersForFilters(): Order[] {
    if (this.dataSource() === 'bsale') {
      return this.bsaleOrders();
    }

    if (this.dataSource() === 'all' && this.bsaleOrders().length > 0) {
      return this.sortOrdersByCreatedAtDesc([...this.allOrders(), ...this.bsaleOrders()]);
    }

    return this.allOrders();
  }

  private toNumericTotal(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value ?? '')
      .trim()
      .replace(/[^0-9,.-]/g, '')
      .replace(/,(?=\d{1,2}$)/, '.')
      .replace(/,/g, '');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeStatus(status: OrderStatus | string | null | undefined): string {
    return String(status || '').trim().toUpperCase();
  }

  private matchesSearch(order: Order, term: string): boolean {
    if (!term) {
      return true;
    }

    const normalizedTerm = this.normalizeDateTerm(term);
    const ticket = String(order.external_id || '').toLowerCase();
    const bsaleSerie = this.getBsaleSerieDisplay(order).toLowerCase();
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
      bsaleSerie.includes(term) ||
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
    const isBsale = this.getOrderSource(order) === 'bsale';
    const storeFilterActive = this.selectedStoreSlugs().length > 0;

    if (this.dataSource() === 'woocommerce') {
      return isWoo && this.matchesStoreFilter(order);
    }

    if (this.dataSource() === 'bsale') {
      return isBsale;
    }

    // 'all':
    // Si hay filtro de tienda, solo mostrar Woo de esas tiendas (no Bsale)
    if (storeFilterActive) {
      return isWoo && this.matchesStoreFilter(order);
    }
    // Si no hay filtro de tienda, mostrar ambos
    return isWoo || isBsale;
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

  getEstimatedDeliveryDisplay(order: Order): string {
    if (order.source === 'bsale' && order.bsale_fecha_despacho) {
      return this.formatEstimated(order.bsale_fecha_despacho);
    }

    const defaultEstimatedText = 'Pedido para Provincia 2-3 dias aprox';
    const topLevelEstimated = order.estimated_delivery_date;
    if (topLevelEstimated) {
      return this.formatEstimated(topLevelEstimated);
    }

    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const deliveryMeta =
        this.findMetaValue(meta.meta_data, '_delivery_date') ||
        this.findMetaValue(meta.meta_data, 'delivery_date') ||
        this.findMetaValue(meta.meta_data, 'estimated_delivery_date') ||
        this.findMetaValue(meta.meta_data, '_estimated_delivery_date') ||
        this.findMetaValue(meta.meta_data, '_billing_fecha_entrega');

      if (deliveryMeta) {
        return this.formatEstimated(String(deliveryMeta));
      }

      const f1 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_1');
      const f2 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_2');
      if (f1 && f2) return `${f1} y ${f2}`;
      if (f1) return String(f1);
    }

    return defaultEstimatedText;
  }

  getDeliveryLocationDisplay(order: Order): string {
    if (order.source === 'bsale' && order.bsale_marca_red_social) {
      return order.bsale_marca_red_social;
    }

    if (order.delivery_location && order.delivery_location.trim()) {
      return order.delivery_location;
    }

    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const mapAddress = this.findMetaValue(meta.meta_data, '_billing_direccion_mapa');
      if (mapAddress) return mapAddress;

      const shippingAddress = `${meta.shipping?.address_1 || ''} ${meta.shipping?.city || ''}`.trim();
      if (shippingAddress) return shippingAddress;

      const billingAddress = `${meta.billing?.address_1 || ''} ${meta.billing?.city || ''}`.trim();
      if (billingAddress) return billingAddress;
    }

    return '-';
  }

  private findMetaValue(metaData: any, key: string): string | null {
    if (!Array.isArray(metaData)) {
      return null;
    }

    const entry = metaData.find((m: any) => m?.key === key);
    return entry?.value != null ? String(entry.value) : null;
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
    if (order.source === 'bsale' && order.bsale_estado_pedido) {
      return order.bsale_estado_pedido;
    }

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

  getOrderSource(order: Order): 'web' | 'redes' | 'bsale' | 'woocommerce' | null {
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
    if (order.source === 'bsale') {
      return order.bsale_vendedor || 'Bsale';
    }

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

  getBsaleSerieDisplay(order: Order): string {
    if (order.source === 'bsale' && order.bsale_boleta) {
      return order.bsale_boleta;
    }

    const bsale = order.bsale || (order.meta as any)?.bsale;
    const serie = String(bsale?.serie || '').trim();
    const numero = String(bsale?.numero || '').trim();

    if (serie) {
      if (numero && !serie.includes(numero)) {
        return `${serie}-${numero}`;
      }
      return serie;
    }

    if (numero) {
      return numero;
    }

    return '-';
  }

  getBsaleBoletaId(order: Order): string | null {
    const bsale = order.bsale || (order.meta as any)?.bsale;
    if (bsale?.boleta_id) return String(bsale.boleta_id);
    if (order.bsale_boleta) return order.bsale_boleta;
    return null;
  }

  getCurrencySymbol(order: Order): string {
    if (order.source === 'bsale') return 'S/';
    const meta = order.meta as any;
    if (meta?.currency === 'PEN') return 'S/';
    return '$';
  }

  getSourceBadgeClass(order: Order): string {
    if (order.source === 'bsale') {
      return 'bg-info';
    }

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

  private getBsaleErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 500) {
        return 'No se pudieron cargar pedidos de Bsale (error 500 del servidor).';
      }
      if (err.status === 0) {
        return 'No se pudo conectar al backend para consultar Bsale.';
      }
      return `No se pudieron cargar pedidos de Bsale (HTTP ${err.status}).`;
    }

    return 'No se pudieron cargar pedidos de Bsale. Intenta recargar en unos segundos.';
  }
}
