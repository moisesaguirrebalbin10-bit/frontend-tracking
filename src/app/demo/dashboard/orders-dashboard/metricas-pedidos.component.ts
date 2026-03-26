import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, OrdersResponse } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from './order-detail-modal.component';

interface KPIs {
  total: number;
  entregados: number;
  enProceso: number;
  canceladosErrores: number;
  totalFacturado: number;
}

@Component({
  selector: 'app-metricas-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetailModalComponent],
  template: `
    <div class="container-fluid">

      <!-- Filtros -->
      <div class="row mb-3 g-2">
        <div class="col-12">
          <div class="card">
            <div class="card-body py-2">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <i class="ti ti-filter text-muted"></i>
                <span class="fw-semibold text-muted me-1">Filtros:</span>

                <!-- Búsqueda libre -->
                <div class="input-group input-group-sm" style="width:200px">
                  <span class="input-group-text"><i class="ti ti-search"></i></span>
                  <input type="text" class="form-control" placeholder="Buscar..."
                    [(ngModel)]="searchText"
                    (ngModelChange)="onFilterChange()" />
                </div>

                <!-- Estado -->
                <select class="form-select form-select-sm" style="width:170px"
                  [(ngModel)]="selectedStatus"
                  (ngModelChange)="onFilterChange()">
                  <option value="">Todos los estados</option>
                  <option *ngFor="let s of allStatuses" [value]="s.value">{{ s.label }}</option>
                </select>

                <!-- Desde -->
                <div class="d-flex align-items-center gap-1">
                  <small class="text-muted">Desde</small>
                  <input type="date" class="form-control form-control-sm" style="width:145px"
                    [(ngModel)]="dateFrom"
                    (ngModelChange)="onFilterChange()" />
                </div>

                <!-- Hasta -->
                <div class="d-flex align-items-center gap-1">
                  <small class="text-muted">Hasta</small>
                  <input type="date" class="form-control form-control-sm" style="width:145px"
                    [(ngModel)]="dateTo"
                    (ngModelChange)="onFilterChange()" />
                </div>

                <!-- Limpiar -->
                <button *ngIf="hasActiveFilters()" class="btn btn-sm btn-outline-secondary" (click)="clearFilters()">
                  <i class="ti ti-x me-1"></i>Limpiar
                </button>

                <!-- Recargar -->
                <button class="btn btn-sm btn-outline-secondary ms-auto" (click)="loadOrders()" [disabled]="loading()">
                  <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
                  Recargar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="row mb-4 g-3">
        <div class="col-xl col-lg-4 col-md-6 col-6">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon bg-primary-soft text-primary"><i class="ti ti-shopping-cart"></i></span>
                <h6 class="text-muted mb-0">Total Pedidos</h6>
              </div>
              <h3 class="mb-0">{{ kpis().total }}</h3>
            </div>
          </div>
        </div>
        <div class="col-xl col-lg-4 col-md-6 col-6">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon bg-success-soft text-success"><i class="ti ti-check"></i></span>
                <h6 class="text-muted mb-0">Entregados</h6>
              </div>
              <h3 class="mb-0 text-success">{{ kpis().entregados }}</h3>
            </div>
          </div>
        </div>
        <div class="col-xl col-lg-4 col-md-6 col-6">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon bg-warning-soft text-warning"><i class="ti ti-loader"></i></span>
                <h6 class="text-muted mb-0">En Proceso</h6>
              </div>
              <h3 class="mb-0 text-warning">{{ kpis().enProceso }}</h3>
            </div>
          </div>
        </div>
        <div class="col-xl col-lg-4 col-md-6 col-6">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon bg-danger-soft text-danger"><i class="ti ti-alert-circle"></i></span>
                <h6 class="text-muted mb-0">Cancel. / Error</h6>
              </div>
              <h3 class="mb-0 text-danger">{{ kpis().canceladosErrores }}</h3>
            </div>
          </div>
        </div>
        <div class="col-xl col-lg-4 col-md-6 col-6">
          <div class="card kpi-card h-100 border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="kpi-icon bg-info-soft text-info"><i class="ti ti-currency-dollar"></i></span>
                <h6 class="text-muted mb-0">Total Facturado</h6>
              </div>
              <h3 class="mb-0 text-info">{{ kpis().totalFacturado | number:'1.0-0' }}</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h5 class="mb-0">
                  Pedidos
                  <span class="badge bg-primary ms-2">{{ filteredOrders().length }}</span>
                </h5>
                <small class="text-muted">{{ pageRangeLabel }}</small>
              </div>

              <div *ngIf="loading()" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="text-muted mt-2 small">Cargando pedidos...</p>
              </div>

              <div *ngIf="!loading()" class="table-responsive">
                <table class="table table-striped table-hover align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th class="text-nowrap">N° Externo</th>
                      <th>Boleta ID</th>
                      <th>Serie / Nro</th>
                      <th>Cliente</th>
                      <th class="text-nowrap">Fecha</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fuente</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of pagedOrders">
                      <td class="text-nowrap fw-semibold">{{ order.external_id || '-' }}</td>
                      <td>
                        <span *ngIf="getBsaleBoletaId(order)" class="badge bg-light text-dark border">
                          {{ getBsaleBoletaId(order) }}
                        </span>
                        <span *ngIf="!getBsaleBoletaId(order)" class="text-muted">-</span>
                      </td>
                      <td class="text-nowrap">
                        <ng-container *ngIf="getBsaleSerie(order) || getBsaleNumero(order)">
                          <span *ngIf="getBsaleSerie(order)" class="text-muted small">{{ getBsaleSerie(order) }}-</span>
                          <span>{{ getBsaleNumero(order) }}</span>
                        </ng-container>
                        <span *ngIf="!getBsaleSerie(order) && !getBsaleNumero(order)" class="text-muted">-</span>
                      </td>
                      <td>{{ order.customer_name }}</td>
                      <td class="text-nowrap">
                        <small>{{ order.created_at | date:'dd/MM/yy HH:mm' }}</small>
                      </td>
                      <td class="text-nowrap fw-semibold">
                        {{ getCurrencySymbol(order) }} {{ order.total | number:'1.0-2' }}
                      </td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClass(order)">
                          {{ getStatusLabel(order) }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" [ngClass]="getSourceBadgeClass(order)">
                          {{ getSourceLabel(order) }}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-sm btn-primary" (click)="viewOrder(order)">
                          <i class="ti ti-eye"></i>
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="!loading() && filteredOrders().length === 0">
                      <td colspan="9" class="text-center text-muted py-5">
                        <i class="ti ti-inbox fs-1 d-block mb-2 text-muted opacity-50"></i>
                        No se encontraron pedidos para los filtros aplicados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Paginación -->
              <div *ngIf="!loading() && totalPages > 1"
                class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
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

    <app-order-detail-modal
      [order]="selectedOrder()"
      [isOpen]="showModal()"
      (closeModal)="closeModal()">
    </app-order-detail-modal>
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
export class MetricasPedidosComponent implements OnInit {

  // ── State ──────────────────────────────────────────────
  loading = signal(false);
  allOrders = signal<Order[]>([]);
  currentPage = signal(1);
  readonly pageSize = 50;

  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);

  // ── Filtros ────────────────────────────────────────────
  searchText = '';
  selectedStatus = '';
  dateFrom = '';
  dateTo = '';

  readonly allStatuses = [
    { value: 'EN_PROCESO',  label: 'En Proceso' },
    { value: 'EMPAQUETADO', label: 'Empaquetado' },
    { value: 'DESPACHADO',  label: 'Despachado' },
    { value: 'EN_CAMINO',   label: 'En Camino' },
    { value: 'ENTREGADO',   label: 'Entregado' },
    { value: 'ERROR',       label: 'Error' },
    { value: 'CANCELADO',   label: 'Cancelado' },
  ];

  // ── Computed ───────────────────────────────────────────
  filteredOrders = signal<Order[]>([]);

  kpis = computed<KPIs>(() => {
    const orders = this.filteredOrders();
    const cancelledStatuses = ['CANCELADO', 'ERROR', 'ERROR_EN_PEDIDO'];
    const inProgressStatuses = ['EN_PROCESO', 'EMPAQUETADO', 'DESPACHADO', 'EN_CAMINO'];
    return {
      total: orders.length,
      entregados: orders.filter(o => (o.status as string)?.toUpperCase() === 'ENTREGADO').length,
      enProceso: orders.filter(o => inProgressStatuses.includes((o.status as string)?.toUpperCase())).length,
      canceladosErrores: orders.filter(o => cancelledStatuses.includes((o.status as string)?.toUpperCase())).length,
      totalFacturado: orders.reduce((sum, o) => sum + (o.total || 0), 0)
    };
  });

  get pagedOrders(): Order[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize));
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

  get pageRangeLabel(): string {
    const total = this.filteredOrders().length;
    if (total === 0) return '0 pedidos encontrados';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, total);
    return `Mostrando ${start}–${end} de ${total} pedidos`;
  }

  hasActiveFilters(): boolean {
    return !!(this.searchText || this.selectedStatus || this.dateFrom || this.dateTo);
  }

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.orderService.getOrdersWithFilters({ page: 1, perPage: 500 }).subscribe({
      next: (response: OrdersResponse) => {
        this.allOrders.set(response.data || []);
        this.applyClientFilters();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.applyClientFilters();
  }

  clearFilters() {
    this.searchText = '';
    this.selectedStatus = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.onFilterChange();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage.set(page);
  }

  viewOrder(order: Order) {
    this.selectedOrder.set(order);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
  }

  // ── Filtros cliente ────────────────────────────────────
  private applyClientFilters() {
    let orders = this.allOrders();

    if (this.selectedStatus) {
      orders = orders.filter(o => (o.status as string)?.toUpperCase() === this.selectedStatus.toUpperCase());
    }

    if (this.dateFrom) {
      const from = new Date(this.dateFrom);
      orders = orders.filter(o => o.created_at && new Date(o.created_at) >= from);
    }

    if (this.dateTo) {
      const to = new Date(this.dateTo);
      to.setHours(23, 59, 59, 999);
      orders = orders.filter(o => o.created_at && new Date(o.created_at) <= to);
    }

    if (this.searchText?.trim()) {
      const term = this.searchText.trim().toLowerCase();
      orders = orders.filter(o =>
        (o.external_id || '').toLowerCase().includes(term) ||
        (o.customer_name || '').toLowerCase().includes(term) ||
        (o.customer_email || '').toLowerCase().includes(term) ||
        (o.bsale_boleta || '').toLowerCase().includes(term) ||
        String(o.bsale?.boleta_id || '').includes(term)
      );
    }

    this.filteredOrders.set(orders);
  }

  // ── Helpers presentación ───────────────────────────────
  getBsaleBoletaId(order: Order): string | null {
    if (order.bsale?.boleta_id) return String(order.bsale.boleta_id);
    if (order.bsale_boleta) return order.bsale_boleta;
    return null;
  }

  getBsaleSerie(order: Order): string | null {
    return order.bsale?.serie || null;
  }

  getBsaleNumero(order: Order): string | null {
    return order.bsale?.numero || null;
  }

  getCurrencySymbol(order: Order): string {
    if (order.source === 'bsale') return 'S/';
    const meta = order.meta as any;
    if (meta?.currency === 'CLP') return '$';
    if (meta?.currency === 'PEN') return 'S/';
    return '$';
  }

  getStatusLabel(order: Order): string {
    if (order.source === 'bsale' && order.bsale_estado_pedido) {
      return order.bsale_estado_pedido;
    }
    const wooStatus = order.woo_status || order.meta?.status;
    const isEnProceso = (order.status as string)?.toUpperCase() === 'EN_PROCESO';
    if (order.woo_status_label && isEnProceso) return order.woo_status_label;
    if (wooStatus && isEnProceso) {
      const labels: Record<string, string> = {
        'pending': 'Pendiente', 'processing': 'En Proceso', 'on-hold': 'En Espera',
        'completed': 'Completado', 'cancelled': 'Cancelado', 'refunded': 'Reembolsado', 'failed': 'Fallido'
      };
      return labels[wooStatus] ?? wooStatus;
    }
    const internalLabels: Record<string, string> = {
      'EN_PROCESO': 'En Proceso', 'EMPAQUETADO': 'Empaquetado', 'DESPACHADO': 'Despachado',
      'EN_CAMINO': 'En Camino', 'ENTREGADO': 'Entregado',
      'ERROR': 'Error', 'ERROR_EN_PEDIDO': 'Error en Pedido', 'CANCELADO': 'Cancelado'
    };
    return internalLabels[(order.status as string)?.toUpperCase()] ?? order.status;
  }

  getStatusClass(order: Order): string {
    const wooStatus = order.woo_status || order.meta?.status;
    const isEnProceso = (order.status as string)?.toUpperCase() === 'EN_PROCESO';
    if (wooStatus && isEnProceso) {
      const colors: Record<string, string> = {
        'pending': 'bg-secondary', 'processing': 'bg-warning', 'on-hold': 'bg-info text-dark', 'failed': 'bg-danger'
      };
      return colors[wooStatus] ?? 'bg-warning';
    }
    const map: Record<string, string> = {
      'ENTREGADO': 'bg-success', 'ERROR': 'bg-danger', 'ERROR_EN_PEDIDO': 'bg-danger',
      'CANCELADO': 'bg-secondary', 'EN_CAMINO': 'bg-info', 'DESPACHADO': 'bg-primary',
      'EMPAQUETADO': 'bg-warning', 'EN_PROCESO': 'bg-warning'
    };
    return map[(order.status as string)?.toUpperCase()] ?? 'bg-warning';
  }

  getSourceLabel(order: Order): string {
    if (order.source === 'bsale') return 'Bsale';
    if (order.source === 'woocommerce' || order.store_slug) return order.woo_source || 'WooCommerce';
    if (order.source === 'redes') return 'Redes';
    if (order.source === 'web') return 'Web';
    return 'Interno';
  }

  getSourceBadgeClass(order: Order): string {
    if (order.source === 'bsale') return 'bg-primary text-white';
    if (order.source === 'woocommerce' || order.store_slug) return 'bg-success text-white';
    if (order.source === 'redes') return 'bg-info text-dark';
    return 'bg-secondary text-white';
  }
}
