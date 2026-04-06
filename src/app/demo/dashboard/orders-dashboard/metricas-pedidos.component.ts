import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DashboardOrderRow,
  DashboardOrderStatusValue,
  DashboardOrdersMetrics,
  DashboardOrdersQuery,
  DashboardOrdersResponse
} from '../../../models/dashboard-order.model';
import { DashboardOrdersService } from '../../../services/dashboard-orders.service';
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

interface KPIItem {
  label: string;
  value: string | number;
  icon: string;
  iconClass: string;
  valueClass?: string;
}

@Component({
  selector: 'app-metricas-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetailModalComponent],
  template: `
    <div class="container-fluid">
      <div class="row mb-3 g-2">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <i class="ti ti-filter text-muted"></i>
                <span class="fw-semibold text-muted me-1">Filtros:</span>

                <div class="input-group input-group-sm" style="width:220px">
                  <span class="input-group-text"><i class="ti ti-search"></i></span>
                  <input type="text" class="form-control" placeholder="Buscar..." [(ngModel)]="searchText" (ngModelChange)="onSearchChange()" />
                </div>

                <select class="form-select form-select-sm" style="width:170px" [(ngModel)]="selectedStatus" (ngModelChange)="onFiltersChange()">
                  <option value="">Todos los estados</option>
                  <option *ngFor="let item of statusOptions" [value]="item.value">{{ item.label }}</option>
                </select>

                <div class="d-flex align-items-center gap-1">
                  <small class="text-muted">Desde</small>
                  <input type="date" class="form-control form-control-sm" style="width:145px" [(ngModel)]="dateFrom" (ngModelChange)="onFiltersChange()" />
                </div>

                <div class="d-flex align-items-center gap-1">
                  <small class="text-muted">Hasta</small>
                  <input type="date" class="form-control form-control-sm" style="width:145px" [(ngModel)]="dateTo" (ngModelChange)="onFiltersChange()" />
                </div>

                <button *ngIf="hasActiveFilters()" class="btn btn-sm btn-outline-secondary" (click)="clearFilters()">
                  <i class="ti ti-x me-1"></i>Limpiar
                </button>

                <button class="btn btn-sm btn-outline-secondary ms-auto" (click)="loadData()" [disabled]="loading()">
                  <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
                  Recargar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-4 g-3">
        <div class="col-xl col-lg-4 col-md-6 col-6" *ngFor="let metric of kpiCards">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon" [ngClass]="metric.iconClass"><i [ngClass]="metric.icon"></i></span>
                <h6 class="text-muted mb-0">{{ metric.label }}</h6>
              </div>
              <h3 class="mb-0" [ngClass]="metric.valueClass">{{ metric.value }}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h5 class="mb-0">Pedidos <span class="badge bg-primary ms-2">{{ pagination().total }}</span></h5>
                <small class="text-muted">{{ pageRangeLabel }}</small>
              </div>

              <div *ngIf="loading()" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
              </div>

              <div *ngIf="error()" class="alert alert-danger mb-3">{{ error() }}</div>

              <div *ngIf="!loading()" class="table-responsive">
                <table class="table table-striped table-hover align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>N° Pedido</th>
                      <th>Boleta Bsale</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fuente</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of orders()">
                      <td class="fw-semibold">{{ text(order.order_number, '-') }}</td>
                      <td>{{ text(order.bsale_receipt, '-') }}</td>
                      <td>{{ text(order.customer_name, 'No registrado') }}</td>
                      <td><small>{{ date(order.ordered_at, 'Sin fecha') }}</small></td>
                      <td class="fw-semibold">{{ money(order.total) }}</td>
                      <td><span class="badge" [ngClass]="statusClass(order)">{{ order.status.label }}</span></td>
                      <td><span class="badge" [ngClass]="sourceBadgeClass(order)">{{ sourceLabel(order) }}</span></td>
                      <td><button class="btn btn-sm btn-primary" (click)="viewOrder(order)"><i class="ti ti-eye"></i></button></td>
                    </tr>
                    <tr *ngIf="orders().length === 0">
                      <td colspan="8" class="text-center text-muted py-5">No se encontraron pedidos para los filtros aplicados.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!loading() && pagination().last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <small class="text-muted">Pagina {{ pagination().current_page }} de {{ pagination().last_page }}</small>
                <nav>
                  <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" [class.disabled]="pagination().current_page === 1">
                      <button class="page-link" (click)="goToPage(1)" [disabled]="pagination().current_page === 1">&laquo;</button>
                    </li>
                    <li class="page-item" [class.disabled]="pagination().current_page === 1">
                      <button class="page-link" (click)="goToPage(pagination().current_page - 1)" [disabled]="pagination().current_page === 1">&lsaquo;</button>
                    </li>
                    <li *ngFor="let page of pageNumbers" class="page-item" [class.active]="page === pagination().current_page">
                      <button class="page-link" (click)="goToPage(page)">{{ page }}</button>
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

    <app-order-detail-modal [order]="selectedOrder()" [isOpen]="showModal()" (closeModal)="closeModal()"></app-order-detail-modal>
  `,
  styles: [`
    .kpi-card { border-radius: 10px; }
    .kpi-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .bg-primary-soft { background-color: rgba(var(--bs-primary-rgb), 0.12); }
    .bg-success-soft { background-color: rgba(var(--bs-success-rgb), 0.12); }
    .bg-warning-soft { background-color: rgba(var(--bs-warning-rgb), 0.12); }
    .bg-danger-soft  { background-color: rgba(var(--bs-danger-rgb),  0.12); }
    .bg-info-soft    { background-color: rgba(var(--bs-info-rgb),    0.12); }
    .badge { font-size: 0.78em; }
  `]
})
export class MetricasPedidosComponent implements OnInit, OnDestroy {
  readonly statusOptions = getDashboardStatusOptions();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly orders = signal<DashboardOrderRow[]>([]);
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
  readonly metrics = signal<DashboardOrdersMetrics>({
    total_orders: 0,
    delivered_orders: 0,
    in_process_orders: 0,
    error_orders: 0,
    cancelled_orders: 0,
    total_amount: 0
  });

  searchText = '';
  selectedStatus = '';
  dateFrom = '';
  dateTo = '';

  private readonly dashboardOrdersService: DashboardOrdersService;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dashboardOrdersService: DashboardOrdersService) {
    this.dashboardOrdersService = dashboardOrdersService;
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  get kpiCards(): KPIItem[] {
    const metrics = this.metrics();
    return [
      { label: 'Total Pedidos', value: metrics.total_orders, icon: 'ti ti-shopping-cart', iconClass: 'bg-primary-soft text-primary' },
      { label: 'Entregados', value: metrics.delivered_orders, valueClass: 'text-success', icon: 'ti ti-check', iconClass: 'bg-success-soft text-success' },
      { label: 'En Proceso', value: metrics.in_process_orders, valueClass: 'text-warning', icon: 'ti ti-loader', iconClass: 'bg-warning-soft text-warning' },
      { label: 'Cancel. / Error', value: metrics.cancelled_orders + metrics.error_orders, valueClass: 'text-danger', icon: 'ti ti-alert-circle', iconClass: 'bg-danger-soft text-danger' },
      { label: 'Total Facturado', value: formatDashboardCurrency(metrics.total_amount), valueClass: 'text-info', icon: 'ti ti-currency-dollar', iconClass: 'bg-info-soft text-info' }
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

  hasActiveFilters(): boolean {
    return !!(this.searchText || this.selectedStatus || this.dateFrom || this.dateTo);
  }

  onSearchChange() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.loadData(1), 350);
  }

  onFiltersChange() {
    this.loadData(1);
  }

  clearFilters() {
    this.searchText = '';
    this.selectedStatus = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.loadData(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page) {
      return;
    }
    this.loadData(page);
  }

  loadData(page: number = this.pagination().current_page || 1) {
    this.loading.set(true);
    this.error.set('');

    this.dashboardOrdersService.fetchDashboardOrders(this.buildQuery(page)).subscribe({
      next: (response) => {
        this.orders.set(response.data || []);
        this.pagination.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.error.set('No se pudo cargar el listado de pedidos.');
        this.loading.set(false);
      }
    });

    this.dashboardOrdersService.fetchDashboardMetrics(this.buildMetricsQuery()).subscribe({
      next: ({ metrics }) => this.metrics.set(metrics),
      error: () => this.metrics.set({
        total_orders: 0,
        delivered_orders: 0,
        in_process_orders: 0,
        error_orders: 0,
        cancelled_orders: 0,
        total_amount: 0
      })
    });
  }

  viewOrder(order: DashboardOrderRow) {
    this.selectedOrder.set(order);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
  }

  text(value: unknown, fallback: string): string {
    return fallbackText(value, fallback);
  }

  date(value: string | null | undefined, fallback: string): string {
    return formatDashboardDate(value, fallback);
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

  private buildMetricsQuery(): Omit<DashboardOrdersQuery, 'page' | 'per_page'> {
    return {
      source: 'all',
      period: this.dateFrom || this.dateTo ? 'range' : 'month',
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      search: this.searchText.trim() || undefined,
      status: (this.selectedStatus || undefined) as DashboardOrderStatusValue | undefined
    };
  }

  private buildQuery(page: number): DashboardOrdersQuery {
    return {
      ...this.buildMetricsQuery(),
      page,
      per_page: 20
    };
  }
}