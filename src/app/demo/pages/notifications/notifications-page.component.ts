import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconDirective, IconService } from '@ant-design/icons-angular';
import { InboxOutline, MailOutline } from '@ant-design/icons-angular/icons';
import { formatDashboardCurrency, formatDashboardDate } from '../../../utils/dashboard-order-ui.utils';
import { OrderNotificationItem, OrderNotificationsService } from '../../../services/order-notifications.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterModule, IconDirective],
  template: `
    <div class="container-fluid notifications-page">
      <div class="card notifications-hero mb-4 border-0">
        <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <p class="notifications-eyebrow mb-2">Centro de Notificaciones</p>
            <h2 class="mb-2">Pedidos nuevos detectados</h2>
            <p class="text-muted mb-0">Se muestran primero las notificaciones sin ver. Puedes marcarlas como vistas, ocultarlas de la bandeja y restaurarlas cuando necesites revisar historial.</p>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="badge text-bg-primary unread-badge">Sin ver: {{ notificationsService.unreadCount() }}</span>
            <button class="btn btn-outline-primary" (click)="markAllAsRead()" [disabled]="notificationsService.unreadCount() === 0">Marcar todas como vistas</button>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body p-0">
          <div *ngIf="notifications().length === 0" class="empty-state text-center py-5">
            <h4 class="mb-2">No hay notificaciones pendientes</h4>
            <p class="text-muted mb-0">Las nuevas alertas de pedidos apareceran aqui cada vez que el sistema detecte ingresos recientes.</p>
          </div>

          <div *ngIf="notifications().length > 0">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 pt-3">
              <small class="text-muted">{{ pageRangeLabel() }}</small>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <select class="form-select form-select-sm" style="width:180px" [value]="visibilityFilter()" (change)="onVisibilityFilterChange($event)">
                  <option value="active">Activas</option>
                  <option value="hidden">Ocultas</option>
                  <option value="all">Todas</option>
                </select>
                <select class="form-select form-select-sm" style="width:220px" [value]="kindFilter()" (change)="onKindFilterChange($event)">
                  <option value="all">Todas las notificaciones</option>
                  <option value="new_order">Solo pedidos</option>
                  <option value="status_change">Solo cambios de estado</option>
                </select>
                <select class="form-select form-select-sm" style="width:96px" [value]="'' + perPage()" (change)="onPerPageChange($event)">
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            <div *ngIf="totalNotifications() === 0" class="empty-state text-center py-5 border-top">
              <h4 class="mb-2">No hay resultados para ese filtro</h4>
              <p class="text-muted mb-0">Prueba cambiando entre activas, ocultas o todos los tipos de notificacion.</p>
            </div>

            <div *ngIf="totalNotifications() > 0" class="table-responsive mt-3">
              <table class="table table-hover align-middle mb-0 notifications-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Tipo</th>
                    <th>Actor</th>
                    <th>Referencia</th>
                    <th>Detalle</th>
                    <th>Detectada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let notification of pagedNotifications()" [class.table-active]="!notification.readAt && !notification.hiddenAt" [class.notification-is-hidden]="!!notification.hiddenAt">
                    <td>
                      <span class="badge" [ngClass]="notification.hiddenAt ? 'text-bg-dark' : (notification.readAt ? 'text-bg-secondary' : 'text-bg-success')">
                        {{ notification.hiddenAt ? 'Oculta' : (notification.readAt ? 'Vista' : 'Sin ver') }}
                      </span>
                    </td>
                    <td>
                      <div class="notification-type-cell">
                        <span class="notification-table-icon" [class.is-large-icon]="notification.kind === 'new_order' || notification.kind === 'status_change'"><i antIcon [type]="notificationIconName(notification)" theme="outline"></i></span>
                        <span class="badge text-bg-dark">{{ kindLabel(notification) }}</span>
                      </div>
                    </td>
                    <td>{{ actorLabel(notification) }}</td>
                    <td>{{ referenceLabel(notification) }}</td>
                    <td>
                      <div class="notification-detail-cell">
                        <strong class="d-block">{{ notification.title }}</strong>
                        <small class="text-muted d-block">{{ notification.message }}</small>
                      </div>
                    </td>
                    <td>{{ date(notification.createdAt, 'Ahora') }}</td>
                    <td>
                      <div class="d-flex align-items-center gap-2 flex-wrap">
                        <button class="btn btn-sm btn-outline-primary" *ngIf="!notification.hiddenAt && !notification.readAt" (click)="markAsRead(notification.id)">Marcar vista</button>
                        <button class="btn btn-sm btn-outline-warning" *ngIf="!notification.hiddenAt" (click)="hideNotification(notification.id)">Ocultar</button>
                        <button class="btn btn-sm btn-outline-success" *ngIf="notification.hiddenAt" (click)="restoreNotification(notification.id)">Restaurar</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="lastPage() > 1" class="d-flex justify-content-between align-items-center mt-3 px-3 pb-3 flex-wrap gap-2">
              <small class="text-muted">Pagina {{ currentPage() }} de {{ lastPage() }}</small>
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item" [class.disabled]="currentPage() === 1">
                    <button class="page-link" (click)="goToPage(1)" [disabled]="currentPage() === 1">&laquo;</button>
                  </li>
                  <li class="page-item" [class.disabled]="currentPage() === 1">
                    <button class="page-link" (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1">&lsaquo;</button>
                  </li>
                  <li *ngFor="let page of pageNumbers()" class="page-item" [class.active]="page === currentPage()">
                    <button class="page-link" (click)="goToPage(page)">{{ page }}</button>
                  </li>
                  <li class="page-item" [class.disabled]="currentPage() === lastPage()">
                    <button class="page-link" (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === lastPage()">&rsaquo;</button>
                  </li>
                  <li class="page-item" [class.disabled]="currentPage() === lastPage()">
                    <button class="page-link" (click)="goToPage(lastPage())" [disabled]="currentPage() === lastPage()">&raquo;</button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-hero {
      background: linear-gradient(135deg, rgba(14, 116, 144, 0.14), rgba(37, 99, 235, 0.12));
      border: 1px solid rgba(14, 116, 144, 0.18);
    }

    .notifications-eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      font-weight: 700;
      color: #0f766e;
    }

    .unread-badge {
      font-size: 0.9rem;
      padding: 0.6rem 0.8rem;
    }

    .notification-row {
      padding: 1.1rem 1.25rem;
      transition: background-color 0.18s ease;
    }

    .notification-row:not(.is-read) {
      background: rgba(37, 99, 235, 0.04);
    }

    .notification-row.is-read {
      opacity: 0.82;
    }

    .notification-is-hidden {
      opacity: 0.74;
    }

    .notifications-table th,
    .notifications-table td {
      white-space: nowrap;
      vertical-align: middle;
    }

    .notifications-table td:last-child,
    .notifications-table th:last-child {
      white-space: normal;
    }

    .notification-detail-cell {
      min-width: 320px;
      max-width: 640px;
      white-space: normal;
    }

    .notification-type-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .notification-table-icon {
      width: 22px;
      min-width: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #0284c7;
    }

    .notification-table-icon i {
      font-size: 1.08rem;
    }

    .notification-table-icon.is-large-icon {
      width: 36px;
      min-width: 36px;
    }

    .notification-table-icon.is-large-icon i {
      font-size: 2.16rem;
      line-height: 1;
    }

    .notification-copy {
      max-width: 860px;
    }

    .empty-state {
      min-height: 360px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    :host-context(body.dark-mode) .notifications-hero {
      background: linear-gradient(135deg, rgba(14, 116, 144, 0.2), rgba(37, 99, 235, 0.12));
      border-color: rgba(56, 189, 248, 0.2);
    }

    :host-context(body.dark-mode) .notifications-eyebrow {
      color: #67e8f9;
    }
  `]
})
export class NotificationsPageComponent {
  private readonly iconService = inject(IconService);
  protected readonly notificationsService = inject(OrderNotificationsService);
  protected readonly kindFilter = signal<'all' | 'new_order' | 'status_change'>('all');
  protected readonly visibilityFilter = signal<'active' | 'hidden' | 'all'>('active');
  protected readonly perPage = signal(20);
  protected readonly currentPage = signal(1);
  protected readonly notifications = computed(() => this.notificationsService.notifications());
  protected readonly filteredNotifications = computed(() => {
    const visibility = this.visibilityFilter();
    const byVisibility = this.notifications().filter((notification) => {
      if (visibility === 'active') {
        return !notification.hiddenAt;
      }

      if (visibility === 'hidden') {
        return !!notification.hiddenAt;
      }

      return true;
    });

    const kind = this.kindFilter();
    if (kind === 'all') {
      return byVisibility;
    }

    return byVisibility.filter((notification) => notification.kind === kind);
  });
  protected readonly totalNotifications = computed(() => this.filteredNotifications().length);
  protected readonly lastPage = computed(() => Math.max(1, Math.ceil(this.totalNotifications() / this.perPage())));
  protected readonly pagedNotifications = computed(() => {
    const page = Math.min(this.currentPage(), this.lastPage());
    const start = (page - 1) * this.perPage();
    return this.filteredNotifications().slice(start, start + this.perPage());
  });

  protected readonly pageNumbers = computed(() => {
    const total = this.lastPage();
    const current = this.currentPage();
    const delta = 2;
    const pages: number[] = [];
    for (let value = Math.max(1, current - delta); value <= Math.min(total, current + delta); value += 1) {
      pages.push(value);
    }
    return pages;
  });

  constructor() {
    this.iconService.addIcon(InboxOutline, MailOutline);
  }

  pageRangeLabel(): string {
    const total = this.totalNotifications();
    if (total === 0) {
      return '0 notificaciones';
    }

    const currentPage = Math.min(this.currentPage(), this.lastPage());
    const from = (currentPage - 1) * this.perPage() + 1;
    const to = Math.min(from + this.perPage() - 1, total);
    return 'Mostrando ' + from + '-' + to + ' de ' + total + ' notificaciones';
  }

  onPerPageChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    const value = Number(input?.value || 20);
    this.perPage.set(Number.isFinite(value) ? value : 20);
    this.currentPage.set(1);
  }

  onKindFilterChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    const value = input?.value;
    if (value === 'all' || value === 'new_order' || value === 'status_change') {
      this.kindFilter.set(value);
      this.currentPage.set(1);
    }
  }

  onVisibilityFilterChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    const value = input?.value;
    if (value === 'active' || value === 'hidden' || value === 'all') {
      this.visibilityFilter.set(value);
      this.currentPage.set(1);
    }
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
  }

  sourceLabel(notification: OrderNotificationItem): string {
    return this.notificationsService.sourceLabel(notification);
  }

  kindLabel(notification: OrderNotificationItem): string {
    return this.notificationsService.kindLabel(notification);
  }

  actorLabel(notification: OrderNotificationItem): string {
    return this.notificationsService.actorLabel(notification);
  }

  referenceLabel(notification: OrderNotificationItem): string {
    return this.notificationsService.referenceLabel(notification);
  }

  notificationIconName(notification: OrderNotificationItem): string {
    return notification.kind === 'new_order' ? 'inbox' : 'mail';
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  markAsRead(notificationId: string): void {
    this.notificationsService.markAsRead(notificationId);
  }

  hideNotification(notificationId: string): void {
    this.notificationsService.hideNotification(notificationId);
    if (this.currentPage() > this.lastPage()) {
      this.currentPage.set(this.lastPage());
    }
  }

  restoreNotification(notificationId: string): void {
    this.notificationsService.restoreNotification(notificationId);
    if (this.currentPage() > this.lastPage()) {
      this.currentPage.set(this.lastPage());
    }
  }

  text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  date(value: string | null | undefined, fallback: string): string {
    return formatDashboardDate(value, fallback);
  }

  money(value: number): string {
    return formatDashboardCurrency(value);
  }
}