import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from './order-detail-modal.component';

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
          </div>
        </div>
        <div class="col-xl-6 col-md-6">
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn" [ngClass]="dataSource() === 'all' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('all')">Todos</button>
            <button type="button" class="btn" [ngClass]="dataSource() === 'internal' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('internal')">Internos</button>
            <button type="button" class="btn" [ngClass]="dataSource() === 'woocommerce' ? 'btn-primary' : 'btn-outline-primary'" (click)="setDataSource('woocommerce')">WooCommerce</button>
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
                <small class="text-muted">{{ filteredOrders().length }} pedidos encontrados</small>
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
                    <tr *ngFor="let order of filteredOrders()">
                      <td>{{ order.external_id }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td>{{ order.created_at | date: 'short' }}</td>
                      <td>{{ order.estimated_delivery_date ? formatEstimated(order.estimated_delivery_date) : '-' }}</td>
                      <td>{{ order.status === 'ENTREGADO' && order.delivery_date ? (order.delivery_date | date: 'short') : '-' }}</td>
                      <td><small>{{ order.delivery_location || '-' }}</small></td>
                      <td>$ {{ order.total }}</td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClass(order.status)">
                          {{ order.status }}
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
  timeframe = signal<'day' | 'week' | 'month'>('day');
  dataSource = signal<'internal' | 'woocommerce' | 'all'>('all');

  loading = signal(false);
  allOrders = signal<Order[]>([]);
  filteredOrders = signal<Order[]>([]);

  totalOrders = signal(0);
  deliveredOrders = signal(0);
  inProgressOrders = signal(0);
  errorOrders = signal(0);

  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadDashboard();
  }

  setTimeframe(tf: 'day' | 'week' | 'month') {
    this.timeframe.set(tf);
    this.applyFilters();
  }

  setDataSource(source: 'internal' | 'woocommerce' | 'all') {
    this.dataSource.set(source);
    this.applyFilters();
  }

  loadDashboard() {
    this.loading.set(true);

    forkJoin({
      internal: this.orderService.getOrders(1, 1000).pipe(
        catchError((error) => {
          console.error('Error loading internal orders for dashboard', error);
          return of({ data: [], current_page: 1, last_page: 1, total: 0 });
        })
      ),
      woo: this.orderService.getWooCommerceOrders(1, 1000).pipe(
        catchError((error) => {
          console.error('Error loading WooCommerce orders for dashboard', error);
          return of({ data: [], meta: { total: 0, total_pages: 1, current_page: 1, per_page: 1000 } });
        })
      )
    }).subscribe({
      next: ({ internal, woo }) => {
        const wooOrders = (woo.data || []).map((wooOrder) => this.orderService.transformWooCommerceOrder(wooOrder, 'WooCommerce'));
        const mergedOrders = [...internal.data, ...wooOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        this.allOrders.set(mergedOrders);
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

  private applyFilters() {
    const now = new Date();
    const orders = this.allOrders()
      .filter((order) => this.matchesDataSource(order))
      .filter((order) => this.isWithinSelectedTimeframe(order.created_at, now))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    this.filteredOrders.set(orders);
    this.totalOrders.set(orders.length);
    this.deliveredOrders.set(orders.filter((order) => order.status === OrderStatus.ENTREGADO).length);
    this.inProgressOrders.set(
      orders.filter((order) => [OrderStatus.EN_PROCESO, OrderStatus.EMPAQUETADO, OrderStatus.DESPACHADO, OrderStatus.EN_CAMINO].includes(order.status)).length
    );
    this.errorOrders.set(orders.filter((order) => order.status === OrderStatus.ERROR).length);
  }

  private matchesDataSource(order: Order): boolean {
    if (this.dataSource() === 'all') {
      return true;
    }

    if (this.dataSource() === 'internal') {
      return this.getOrderSource(order) !== 'woocommerce';
    }

    return this.getOrderSource(order) === 'woocommerce';
  }

  private isWithinSelectedTimeframe(dateValue: string, referenceDate: Date): boolean {
    const orderDate = new Date(dateValue);

    if (this.timeframe() === 'day') {
      return orderDate.getFullYear() === referenceDate.getFullYear() && orderDate.getMonth() === referenceDate.getMonth() && orderDate.getDate() === referenceDate.getDate();
    }

    if (this.timeframe() === 'week') {
      return this.isSameWeek(orderDate, referenceDate);
    }

    return orderDate.getFullYear() === referenceDate.getFullYear() && orderDate.getMonth() === referenceDate.getMonth();
  }

  private isSameWeek(firstDate: Date, secondDate: Date): boolean {
    const firstWeekStart = this.getWeekStart(firstDate);
    const secondWeekStart = this.getWeekStart(secondDate);
    return firstWeekStart.getTime() === secondWeekStart.getTime();
  }

  private getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() + diff);
    return weekStart;
  }

  ordersTableTitle(): string {
    const titles = {
      day: 'Pedidos del Día',
      week: 'Pedidos de la Semana',
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

  getStatusClass(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.ENTREGADO:
        return 'bg-success';
      case OrderStatus.ERROR:
        return 'bg-danger';
      case OrderStatus.CANCELADO:
        return 'bg-secondary';
      case OrderStatus.EN_CAMINO:
        return 'bg-info';
      case OrderStatus.DESPACHADO:
        return 'bg-primary';
      default:
        return 'bg-warning';
    }
  }

  getOrderSource(order: Order): 'web' | 'redes' | 'woocommerce' | null {
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
