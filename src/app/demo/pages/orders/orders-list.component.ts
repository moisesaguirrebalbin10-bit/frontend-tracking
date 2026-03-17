import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrderDetailModalComponent } from '../../dashboard/orders-dashboard/order-detail-modal.component';
import { RouteSearchService } from '../../../theme/shared/service/route-search.service';

interface StoreFilterOption {
  slug: string;
  label: string;
}

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
                <div class="d-flex align-items-center gap-2">
                  <button class="btn btn-sm btn-outline-secondary" (click)="loadOrders()" [disabled]="loading()" title="Recargar pedidos desde el servidor">
                    <span *ngIf="loading()" class="spinner-border spinner-border-sm me-1" role="status"></span>
                    <i *ngIf="!loading()" class="ti ti-refresh me-1"></i>
                    Recargar
                  </button>
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
                        <span class="badge" [ngClass]="getStatusClassForOrder(order)">
                          {{ getStatusLabel(order) }}
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
  allOrders = signal<Order[]>([]);
  rawOrders = signal<Order[]>([]);
  loading = signal(false);
  currentPage = signal(1);
  lastPage = signal(1);
  dataSource = signal<'internal' | 'woocommerce' | 'all'>('all');
  selectedOrder = signal<Order | null>(null);
  showModal = signal(false);
  availableStores = signal<StoreFilterOption[]>([]);
  selectedStoreSlugs = signal<string[]>([]);

  private readonly itemsPerPage = 100;
  private routeSearchService = inject(RouteSearchService);

  constructor(
    private orderService: OrderService
  ) {
    effect(() => {
      const searchTerm = this.routeSearchService.ordersTerm();
      this.applySearch(searchTerm);
    });
  }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.fetchAllInternalOrders().subscribe({
      next: (orders) => {
        this.allOrders.set(this.sortOrdersByCreatedAtDesc(orders));
        this.refreshAvailableStores(this.allOrders());
        this.applySourceAndStoreFilters();
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading internal orders', error);
        this.loading.set(false);
      }
    });
  }

  setDataSource(source: 'internal' | 'woocommerce' | 'all') {
    this.dataSource.set(source);
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    this.applySourceAndStoreFilters();
  }

  toggleStore(slug: string) {
    const current = this.selectedStoreSlugs();
    const idx = current.indexOf(slug);
    this.selectedStoreSlugs.set(idx >= 0 ? current.filter(s => s !== slug) : [...current, slug]);
    this.currentPage.set(1);
    this.applySourceAndStoreFilters();
  }

  clearStoreFilter() {
    this.selectedStoreSlugs.set([]);
    this.currentPage.set(1);
    this.applySourceAndStoreFilters();
  }

  isStoreSelected(slug: string): boolean {
    return this.selectedStoreSlugs().includes(slug);
  }

  private refreshAvailableStores(orders: Order[]) {
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
      this.applySearch(this.routeSearchService.getTermForContext('orders'));
    }
  }

  nextPage() {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.set(this.currentPage() + 1);
      this.applySearch(this.routeSearchService.getTermForContext('orders'));
    }
  }

  goToPage(page: number | string) {
    if (typeof page === 'number') {
      this.currentPage.set(page);
      this.applySearch(this.routeSearchService.getTermForContext('orders'));
    }
  }

  getOrderSource(order: Order): 'web' | 'redes' | 'woocommerce' | null {
    if (order.store_slug) {
      return 'woocommerce';
    }

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
    if (order.store_slug) {
      return order.store_slug;
    }

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

  private setLoadedOrders(orders: Order[]): void {
    this.rawOrders.set(this.sortOrdersByCreatedAtDesc(orders));
    this.applySearch(this.routeSearchService.getTermForContext('orders'));
  }

  private applySearch(rawTerm: string): void {
    const term = (rawTerm || '').trim().toLowerCase();
    const sourceOrders = this.rawOrders();

    if (!term) {
      this.setPagedOrders(this.sortOrdersByCreatedAtDesc(sourceOrders));
      return;
    }

    const filteredOrders = sourceOrders.filter((order) => this.matchesSearch(order, term));
    this.setPagedOrders(this.sortOrdersByCreatedAtDesc(filteredOrders));
  }

  private setPagedOrders(orders: Order[]) {
    const totalPages = Math.max(1, Math.ceil(orders.length / this.itemsPerPage));
    this.lastPage.set(totalPages);

    if (this.currentPage() > totalPages) {
      this.currentPage.set(totalPages);
    }

    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.orders.set(orders.slice(start, end));
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

  private matchesSearch(order: Order, term: string): boolean {
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

  private getOrderSearchKeys(order: Order): string[] {
    return [
      String(order.external_id || '').toLowerCase(),
      String(order.id || '').toLowerCase(),
      String(order.woo_order_id || '').toLowerCase()
    ].filter(Boolean);
  }

  private applySourceAndStoreFilters() {
    const filteredBySource = this.allOrders().filter((order) => this.matchesDataSource(order));
    const filteredByStore = filteredBySource.filter((order) => this.matchesStoreFilter(order));
    this.setLoadedOrders(filteredByStore);
  }

  private fetchAllInternalOrders(): Observable<Order[]> {
    return this.orderService.getOrders(1, this.itemsPerPage).pipe(
      switchMap((firstPage) => {
        const allOrders = [...(firstPage.data || [])];
        const lastPage = firstPage.last_page || 1;

        if (lastPage <= 1) {
          return of(allOrders);
        }

        const remaining = Array.from({ length: lastPage - 1 }, (_, i) =>
          this.orderService.getOrders(i + 2, this.itemsPerPage).pipe(
            catchError(() => of({ data: [], current_page: i + 2, last_page: lastPage, total: 0 }))
          )
        );

        return forkJoin(remaining).pipe(
          map((pages) => [...allOrders, ...pages.flatMap((page) => page.data || [])])
        );
      })
    );
  }

  private matchesDataSource(order: Order): boolean {
    const isWoo = this.getOrderSource(order) === 'woocommerce';

    if (this.dataSource() === 'internal') {
      return !isWoo;
    }

    if (this.dataSource() === 'woocommerce') {
      return isWoo;
    }

    return true;
  }

  private matchesStoreFilter(order: Order): boolean {
    const selected = this.selectedStoreSlugs();
    if (selected.length === 0) return true;
    return selected.includes(order.store_slug ?? '');
  }
}
