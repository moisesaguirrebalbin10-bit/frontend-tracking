import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { WooCommerceService, WooCommerceStore } from '../../../services/woocommerce.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from '../../dashboard/orders-dashboard/order-detail-modal.component';

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
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 class="mb-0">Pedidos</h5>
                <div class="btn-group" role="group">
                  <button type="button"
                    class="btn btn-sm"
                    [ngClass]="dataSource() === 'internal' ? 'btn-primary' : 'btn-outline-primary'"
                    (click)="setDataSource('internal')">Internos</button>
                  <button type="button"
                    class="btn btn-sm"
                    [ngClass]="dataSource() === 'woocommerce' ? 'btn-primary' : 'btn-outline-primary'"
                    (click)="setDataSource('woocommerce')">WooCommerce</button>
                  <button type="button"
                    class="btn btn-sm"
                    [ngClass]="dataSource() === 'all' ? 'btn-primary' : 'btn-outline-primary'"
                    (click)="setDataSource('all')">Todos</button>
                </div>
              </div>
              <div class="d-flex align-items-center gap-2 flex-wrap mt-2"
                *ngIf="(dataSource() === 'woocommerce' || dataSource() === 'all') && availableStores().length > 1">
                <span class="text-muted small fw-semibold"><i class="ti ti-building-store me-1"></i>Tienda:</span>
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
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-striped table-hover">
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
                    <tr *ngFor="let order of orders()">
                      <td>{{ order.external_id }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td>{{ order.created_at | date: 'short' }}</td>
                      <td>{{ order.estimated_delivery_date ? formatEstimated(order.estimated_delivery_date) : '-' }}</td>
                      <td>{{ order.status === 'ENTREGADO' && order.delivery_date ? (order.delivery_date | date:'short') : '-' }}</td>
                      <td>
                        <small>{{ order.delivery_location || '-' }}</small>
                      </td>
                      <td>$ {{ order.total }}</td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClass(order.status)">
                          {{ order.status }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" 
                          [ngClass]="getSourceBadgeClass(order)">
                          {{ getSourceDisplay(order) }}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-sm btn-primary" (click)="viewOrder(order)">Más Info</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <nav *ngIf="lastPage() > 1">
                <ul class="pagination justify-content-center">
                  <li class="page-item" [class.disabled]="currentPage() === 1">
                    <button class="page-link" (click)="previousPage()" [disabled]="currentPage() === 1">
                      Anterior
                    </button>
                  </li>
                  <li *ngFor="let page of getPages()" 
                    class="page-item"
                    [class.active]="page === currentPage()">
                    <button class="page-link" (click)="goToPage(page)" *ngIf="isNumber(page)">
                      {{ page }}
                    </button>
                    <span class="page-link" *ngIf="!isNumber(page)">{{ page }}</span>
                  </li>
                  <li class="page-item" [class.disabled]="currentPage() === lastPage()">
                    <button class="page-link" (click)="nextPage()" [disabled]="currentPage() === lastPage()">
                      Siguiente
                    </button>
                  </li>
                </ul>
              </nav>

              <div *ngIf="loading()" class="text-center">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <app-order-detail-modal 
      [order]="selectedOrder()" 
      [isOpen]="showModal()"
      (closeModal)="closeModal()">
    </app-order-detail-modal>
  `,
  styles: [`
    .badge {
      font-size: 0.8em;
    }
    .table-hover tbody tr:hover {
      background-color: #f8f9fa;
    }
  `]
})
export class OrdersListComponent implements OnInit {
  orders = signal<Order[]>([]);
  loading = signal(false);
  currentPage = signal(1);
  lastPage = signal(1);
  dataSource = signal<'internal' | 'woocommerce' | 'all'>('all');
  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);
  availableStores = signal<WooCommerceStore[]>([]);
  selectedStoreSlugs = signal<string[]>([]);

  private readonly itemsPerPage = 100;

  constructor(
    private orderService: OrderService,
    private wooCommerceService: WooCommerceService
  ) {}

  ngOnInit() {
    this.loadStores();
    this.loadOrders();
  }

  loadOrders() {
    const source = this.dataSource();
    
    if (source === 'internal') {
      this.loadInternalOrders();
    } else if (source === 'woocommerce') {
      this.loadWooCommerceOrders();
    } else {
      this.loadAllOrders();
    }
  }

  private loadInternalOrders() {
    this.loading.set(true);
    this.orderService.getOrders(this.currentPage(), this.itemsPerPage).subscribe({
      next: (response) => {
        this.orders.set(response.data);
        this.lastPage.set(response.last_page);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading internal orders', error);
        this.loading.set(false);
      }
    });
  }

  private loadWooCommerceOrders() {
    this.loading.set(true);
    const storeFilter = this.selectedStoreSlugs();
    this.orderService.getWooCommerceOrders(
      this.currentPage(), this.itemsPerPage,
      storeFilter.length ? { stores: storeFilter } : undefined
    ).subscribe({
      next: (response) => {
        const transformedOrders = (response.data || []).map(wooOrder =>
          this.orderService.transformWooCommerceOrder(wooOrder, wooOrder.store_label)
        );
        this.orders.set(transformedOrders);
        this.lastPage.set(response.meta.total_pages || 1);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading WooCommerce orders', error);
        this.loading.set(false);
      }
    });
  }

  private loadAllOrders() {
    this.loading.set(true);
    const storeFilter = this.selectedStoreSlugs();
    const wooFilters = storeFilter.length ? { stores: storeFilter } : undefined;

    this.orderService.getOrders(this.currentPage(), this.itemsPerPage).subscribe({
      next: (internalResponse) => {
        this.orderService.getWooCommerceOrders(this.currentPage(), this.itemsPerPage, wooFilters).subscribe({
          next: (wooResponse) => {
            const wooOrders = (wooResponse.data || []).map(wooOrder =>
              this.orderService.transformWooCommerceOrder(wooOrder, wooOrder.store_label)
            );
            const allOrders = [...internalResponse.data, ...wooOrders]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            this.orders.set(allOrders);
            this.lastPage.set(Math.max(internalResponse.last_page || 1, wooResponse.meta?.total_pages || 1));
            this.loading.set(false);
          },
          error: () => {
            this.orders.set(internalResponse.data);
            this.lastPage.set(internalResponse.last_page);
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.orderService.getWooCommerceOrders(this.currentPage(), this.itemsPerPage, wooFilters).subscribe({
          next: (wooResponse) => {
            const wooOrders = (wooResponse.data || []).map(wooOrder =>
              this.orderService.transformWooCommerceOrder(wooOrder, wooOrder.store_label)
            );
            this.orders.set(wooOrders);
            this.lastPage.set(wooResponse.meta?.total_pages || 1);
            this.loading.set(false);
          },
          error: () => {
            this.orders.set([]);
            this.lastPage.set(1);
            this.loading.set(false);
          }
        });
      }
    });
  }

  setDataSource(source: 'internal' | 'woocommerce' | 'all') {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    this.loadOrders();
  }

  toggleStore(slug: string) {
    const current = this.selectedStoreSlugs();
    const idx = current.indexOf(slug);
    this.selectedStoreSlugs.set(idx >= 0 ? current.filter(s => s !== slug) : [...current, slug]);
    this.currentPage.set(1);
    this.loadOrders();
  }

  clearStoreFilter() {
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    this.loadOrders();
  }

  isStoreSelected(slug: string): boolean {
    return this.selectedStoreSlugs().includes(slug);
  }

  private loadStores() {
    this.wooCommerceService.listStores().subscribe(stores => this.availableStores.set(stores));
  }

  getStatusClass(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.ENTREGADO: return 'bg-success';
      case OrderStatus.ERROR: return 'bg-danger';
      case OrderStatus.CANCELADO: return 'bg-secondary';
      case OrderStatus.EN_CAMINO: return 'bg-info';
      case OrderStatus.DESPACHADO: return 'bg-primary';
      default: return 'bg-warning';
    }
  }

    // Formatea la fecha estimada, mostrando raw si no es un solo valor ISO
    formatEstimated(date: string): string {
      if (!date) return '-';
      // rango detectado
      if (date.includes(' y ')) return date;
      // tratar de parsear
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(d);
      }
      return date;
    }

  previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadOrders();
    }
  }

  nextPage() {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadOrders();
    }
  }

  goToPage(page: number | string) {
    if (typeof page === 'number') {
      this.currentPage.set(page);
      this.loadOrders();
    }
  }

  getOrderSource(order: Order): 'web' | 'redes' | 'woocommerce' | null {
    // WooCommerce orders
    if (order.source === 'woocommerce') {
      return 'woocommerce';
    }
    // explicit source field
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
    // orders with no associated user come from webhook (WooCommerce) -> treat as woocommerce
    if (!order.user) {
      return 'woocommerce';
    }
    // other roles (admin, delivery, etc.) are not classified
    return null;
  }

  getSourceDisplay(order: Order): string {
    if (order.woo_source) {
      return order.woo_source;
    }
    const source = this.getOrderSource(order);
    switch (source) {
      case 'web': return 'Web';
      case 'redes': return 'Redes';
      case 'woocommerce': return 'WooCommerce';
      default: return order.user?.name || 'Desconocido';
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

  getPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const current = this.currentPage();
    const last = this.lastPage();
    const range = 2;

    if (last <= 7) {
      for (let i = 1; i <= last; i++) {
        pages.push(i);
      }
    } else {
      if (current > 1 + range) pages.push(1, '...');
      for (let i = Math.max(1, current - range); i <= Math.min(last, current + range); i++) {
        pages.push(i);
      }
      if (current < last - range) pages.push('...', last);
    }

    return pages;
  }

  isNumber(value: any): boolean {
    return typeof value === 'number';
  }
}
