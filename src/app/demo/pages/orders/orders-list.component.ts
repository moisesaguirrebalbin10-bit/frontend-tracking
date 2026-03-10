import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
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
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5>Pedidos</h5>
              <div class="btn-group" role="group">
                <button type="button" 
                  class="btn btn-sm" 
                  [ngClass]="sourceFilter() === null ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="setSourceFilter(null)">Todos</button>
                <button type="button" 
                  class="btn btn-sm" 
                  [ngClass]="sourceFilter() === 'web' ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="setSourceFilter('web')">Web</button>
                <button type="button" 
                  class="btn btn-sm" 
                  [ngClass]="sourceFilter() === 'redes' ? 'btn-primary' : 'btn-outline-primary'"
                  (click)="setSourceFilter('redes')">Redes</button>
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
                      <th>Entrega</th>
                      <th>Ubicación</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      <th>Vendedor</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let order of orders()">
                      <td>{{ order.external_id }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td>{{ order.created_at | date: 'short' }}</td>
                      <td>{{ order.delivery_date ? (order.delivery_date | date: 'short') : '-' }}</td>
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
                        <span class="badge" [ngClass]="order.source === 'web' ? 'bg-primary' : 'bg-info'">
                          {{ order.source === 'web' ? 'Web' : 'Redes' }}
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
  sourceFilter = signal<'web' | 'redes' | null>(null);
  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);
  
  private readonly itemsPerPage = 50;

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.orderService.getOrders(this.currentPage(), this.itemsPerPage).subscribe({
      next: (response) => {
        let data = response.data;
        
        console.log('Raw data from API:', data);
        console.log('Source filter:', this.sourceFilter());

        // Filter by source using user role
        if (this.sourceFilter()) {
          data = data.filter(o => {
            const src = this.getOrderSource(o);
            console.log('Order', o.id, 'src', src, 'filter', this.sourceFilter());
            return src === this.sourceFilter();
          });
        }

        console.log('Filtered data:', data);
        this.orders.set(data);
        this.lastPage.set(response.last_page);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading orders', error);
        this.loading.set(false);
      }
    });
  }

  setSourceFilter(source: 'web' | 'redes' | null) {
    this.sourceFilter.set(source);
    this.currentPage.set(1);
    this.loadOrders();
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

  viewOrder(order: Order) {
    this.selectedOrder.set(order);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
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

  getOrderSource(order: Order): 'web' | 'redes' | null {
    // explicit source field still wins
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
    // orders with no associated user come from webhook (WooCommerce) -> treat as redes
    if (!order.user) {
      return 'redes';
    }
    // other roles (admin, delivery, etc.) are not classified
    return null;
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
