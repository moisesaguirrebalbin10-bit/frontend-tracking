import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin, of, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { DashboardOrdersService } from './dashboard-orders.service';
import { DashboardOrderRow, DashboardOrdersQuery } from '../models/dashboard-order.model';
import { User, UserRole } from '../models/user.model';
import { environment } from '../../environments/environment';

export type NotificationKind = 'new_order' | 'status_change';

export interface OrderNotificationItem {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  openedAt: string | null;
  readAt: string | null;
  hiddenAt?: string | null;
  title: string;
  message: string;
  source?: 'woo' | 'bsale' | null;
  orderKey?: string | null;
  sourceRecordId?: number | null;
  orderNumber?: string | null;
  bsaleReceipt?: string | null;
  orderedAt?: string | null;
  total?: number | null;
  reference?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  activityLogId?: number | null;
}

export interface NewOrdersToastState {
  id: string;
  title: string;
  count: number;
  message: string;
}

export interface AdminActivityToastState {
  id: string;
  title: string;
  message: string;
  tone: 'success' | 'danger';
}

interface PersistedNotificationsState {
  orderFeedInitializedAt?: string | null;
  activityFeedInitializedAt?: string | null;
  knownOrderKeys: string[];
  knownActivityLogIds?: number[];
  notifications: OrderNotificationItem[];
}

interface AdminOrderActivityNotificationRow {
  id: number;
  type: 'status_change';
  source: 'woo' | 'bsale';
  order_id: number | null;
  order_reference: string | null;
  order_number: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_role_label: string | null;
  old_status: string | null;
  old_status_label: string | null;
  new_status: string | null;
  new_status_label: string | null;
  error_reason: string | null;
  assigned_delivery_name: string | null;
  title: string;
  total: number | string | null;
  message: string;
  created_at: string | null;
}

interface AdminOrderActivityNotificationsResponse {
  data: AdminOrderActivityNotificationRow[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderNotificationsService {
  private readonly pollIntervalMs = 5 * 60 * 1000;
  private readonly apiUrl = `${environment.apiUrl}/notifications/order-activities`;
  private readonly purgedStatusChangeTestMessages = new Set([
    'Delivery Pruebas Delivery marco el pedido B002-1536-1536 con un error en el proceso (Falta de informacion en envio)',
    'Operaciones Despacho Despachador marco el pedido B002-1536-1536 como Pedido exitoso despachado derivado a Delivery Pruebas',
    'Operaciones Empaquetado Empaquetador marco el pedido B002-1536-1536 como Empaquetado'
  ]);
  private readonly maxKnownOrderKeys = 600;
  private readonly maxKnownActivityLogIds = 600;
  private readonly maxStoredNotifications = 500;
  private readonly notificationsState = signal<OrderNotificationItem[]>([]);
  private readonly newOrdersToastState = signal<NewOrdersToastState | null>(null);
  private readonly adminActivityToastState = signal<AdminActivityToastState | null>(null);
  private readonly newOrdersToastLeavingState = signal(false);
  private readonly adminActivityToastLeavingState = signal(false);
  private knownOrderKeys = new Set<string>();
  private knownActivityLogIds = new Set<number>();
  private orderFeedInitializedAt: string | null = null;
  private activityFeedInitializedAt: string | null = null;
  private pollSubscription: Subscription | null = null;
  private toastTimeoutId: number | null = null;
  private adminActivityToastTimeoutId: number | null = null;
  private pendingAdminActivityToasts: AdminActivityToastState[] = [];
  private lastToastSignature: string | null = null;
  private authSubscription: Subscription;
  private currentUser: User | null = null;
  private started = false;

  readonly notifications = computed(() => this.sortNotifications(this.notificationsState()));
  readonly visibleNotifications = computed(() => this.notifications().filter((item) => !item.hiddenAt));
  readonly unreadCount = computed(() => this.visibleNotifications().filter((item) => !item.readAt).length);
  readonly unopenedCount = computed(() => this.visibleNotifications().filter((item) => !item.openedAt).length);
  readonly latestNotifications = computed(() => this.visibleNotifications().slice(0, 20));
  readonly newOrdersToast = computed(() => this.newOrdersToastState());
  readonly adminActivityToast = computed(() => this.adminActivityToastState());
  readonly isNewOrdersToastLeaving = computed(() => this.newOrdersToastLeavingState());
  readonly isAdminActivityToastLeaving = computed(() => this.adminActivityToastLeavingState());

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly dashboardOrdersService: DashboardOrdersService
  ) {
    this.authSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.clearNewOrdersToast();
      this.clearAdminActivityToast();
      this.lastToastSignature = null;
      this.loadStateForCurrentUser();

      if (this.started) {
        this.restartPolling();
      }
    });
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.currentUser = this.authService.getCurrentUser();
    this.loadStateForCurrentUser();
    this.restartPolling();
  }

  stop(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.clearNewOrdersToast();
    this.clearAdminActivityToast();
    this.lastToastSignature = null;
    this.started = false;
  }

  dismissNewOrdersToast(): void {
    if (!this.newOrdersToastState() || this.newOrdersToastLeavingState()) {
      return;
    }

    this.newOrdersToastLeavingState.set(true);
    window.setTimeout(() => this.clearNewOrdersToast(), 220);
  }

  dismissAdminActivityToast(): void {
    if (!this.adminActivityToastState() || this.adminActivityToastLeavingState()) {
      return;
    }

    this.adminActivityToastLeavingState.set(true);
    window.setTimeout(() => {
      this.hideCurrentAdminActivityToast();
      this.showNextAdminActivityToast();
    }, 220);
  }

  private clearNewOrdersToast(): void {
    this.newOrdersToastState.set(null);
    this.newOrdersToastLeavingState.set(false);
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  private clearAdminActivityToast(): void {
    this.adminActivityToastState.set(null);
    this.adminActivityToastLeavingState.set(false);
    this.pendingAdminActivityToasts = [];
    if (this.adminActivityToastTimeoutId !== null) {
      window.clearTimeout(this.adminActivityToastTimeoutId);
      this.adminActivityToastTimeoutId = null;
    }
  }

  private hideCurrentAdminActivityToast(): void {
    this.adminActivityToastState.set(null);
    this.adminActivityToastLeavingState.set(false);
    if (this.adminActivityToastTimeoutId !== null) {
      window.clearTimeout(this.adminActivityToastTimeoutId);
      this.adminActivityToastTimeoutId = null;
    }
  }

  markDropdownOpened(): void {
    let changed = false;
    const next = this.notificationsState().map((item) => {
      if (item.hiddenAt || item.openedAt) {
        return item;
      }

      changed = true;
      return {
        ...item,
        openedAt: new Date().toISOString()
      };
    });

    if (changed) {
      this.notificationsState.set(next);
      this.persistState();
    }
  }

  markAllAsRead(): void {
    let changed = false;
    const timestamp = new Date().toISOString();
    const next = this.notificationsState().map((item) => {
      if (item.hiddenAt || item.readAt) {
        return item;
      }

      changed = true;
      return {
        ...item,
        openedAt: item.openedAt ?? timestamp,
        readAt: timestamp
      };
    });

    if (changed) {
      this.notificationsState.set(next);
      this.persistState();
    }
  }

  markAsRead(notificationId: string): void {
    let changed = false;
    const timestamp = new Date().toISOString();
    const next = this.notificationsState().map((item) => {
      if (item.id !== notificationId || item.readAt) {
        return item;
      }

      changed = true;
      return {
        ...item,
        openedAt: item.openedAt ?? timestamp,
        readAt: timestamp
      };
    });

    if (changed) {
      this.notificationsState.set(next);
      this.persistState();
    }
  }

  hideNotification(notificationId: string): void {
    let changed = false;
    const timestamp = new Date().toISOString();
    const next = this.notificationsState().map((item) => {
      if (item.id !== notificationId || item.hiddenAt) {
        return item;
      }

      changed = true;
      return {
        ...item,
        hiddenAt: timestamp,
        openedAt: item.openedAt ?? timestamp,
        readAt: item.readAt ?? timestamp
      };
    });

    if (!changed) {
      return;
    }

    this.notificationsState.set(next);
    this.persistState();
  }

  restoreNotification(notificationId: string): void {
    let changed = false;
    const next = this.notificationsState().map((item) => {
      if (item.id !== notificationId || !item.hiddenAt) {
        return item;
      }

      changed = true;
      return {
        ...item,
        hiddenAt: null
      };
    });

    if (!changed) {
      return;
    }

    this.notificationsState.set(next);
    this.persistState();
  }

  sourceLabel(item: OrderNotificationItem): string {
    return item.source === 'bsale' ? 'Bsale' : 'Woo';
  }

  kindLabel(item: OrderNotificationItem): string {
    return item.kind === 'status_change' ? 'Cambio de Estado' : 'Pedido Nuevo';
  }

  actorLabel(item: OrderNotificationItem): string {
    if (!item.actorName) {
      return '-';
    }

    return item.actorRole ? `${item.actorName} ${item.actorRole}` : item.actorName;
  }

  referenceLabel(item: OrderNotificationItem): string {
    return String(item.reference || item.bsaleReceipt || item.orderNumber || '-');
  }

  private restartPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;

    if (!this.currentUser) {
      return;
    }

    this.pollSubscription = timer(0, this.pollIntervalMs).subscribe(() => {
      const ordersRequest = this.dashboardOrdersService.fetchAllDashboardOrders(this.buildPollingQuery(), 100);
      const activityRequest = this.shouldFetchActivityNotifications()
        ? this.fetchAdminActivityNotifications(100)
        : of<AdminOrderActivityNotificationsResponse>({ data: [] });

      forkJoin({ orders: ordersRequest, activities: activityRequest }).subscribe({
        next: ({ orders, activities }) => {
          this.handleOrderSnapshot(orders);
          this.handleActivitySnapshot(activities.data || []);
        },
        error: () => undefined
      });
    });
  }

  private handleOrderSnapshot(rows: DashboardOrderRow[]): void {
    const normalizedRows = [...rows].sort((left, right) => {
      const leftTime = new Date(left.ordered_at || 0).getTime();
      const rightTime = new Date(right.ordered_at || 0).getTime();
      return rightTime - leftTime;
    });

    const snapshotKeys = normalizedRows.map((row) => this.toOrderKey(row));
    if (!this.orderFeedInitializedAt) {
      if (this.shouldCreateNewOrderNotifications()) {
        const initialNotifications = normalizedRows.map((row) => this.createNotification(row, row.ordered_at));
        this.notificationsState.set(
          this.sortNotifications(initialNotifications).slice(0, this.maxStoredNotifications)
        );
      }
      this.knownOrderKeys = new Set(snapshotKeys.slice(0, this.maxKnownOrderKeys));
      this.orderFeedInitializedAt = new Date().toISOString();
      this.handleRoleQueueToast(normalizedRows);
      this.persistState();
      return;
    }

    const newRows = normalizedRows.filter((row) => !this.knownOrderKeys.has(this.toOrderKey(row)));
    if (newRows.length === 0) {
      this.handleRoleQueueToast(normalizedRows);
      this.refreshKnownOrderKeys(snapshotKeys);
      return;
    }

    if (this.shouldCreateNewOrderNotifications()) {
      const createdNotifications = newRows.map((row) => this.createNotification(row));
      this.notificationsState.set(
        this.sortNotifications([...createdNotifications, ...this.notificationsState()]).slice(0, this.maxStoredNotifications)
      );
      this.showNewOrdersToast(newRows.length);
    }

    this.handleRoleQueueToast(normalizedRows);
    this.refreshKnownOrderKeys(snapshotKeys);
    this.persistState();
  }

  private handleActivitySnapshot(rows: AdminOrderActivityNotificationRow[]): void {
    const normalizedRows = rows.filter((row) => !this.isPurgedStatusChangeTestRow(row)).sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();
      return rightTime - leftTime;
    });

    const snapshotIds = normalizedRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    if (!this.activityFeedInitializedAt) {
      const initialNotifications = normalizedRows.map((row) => this.createActivityNotification(row));
      this.notificationsState.set(
        this.sortNotifications([...initialNotifications, ...this.notificationsState()]).slice(0, this.maxStoredNotifications)
      );
      this.knownActivityLogIds = new Set(snapshotIds.slice(0, this.maxKnownActivityLogIds));
      this.activityFeedInitializedAt = new Date().toISOString();
      this.persistState();
      return;
    }

    const newRows = normalizedRows.filter((row) => !this.knownActivityLogIds.has(Number(row.id)));
    if (newRows.length === 0) {
      this.refreshKnownActivityLogIds(snapshotIds);
      return;
    }

    const createdNotifications = newRows.map((row) => this.createActivityNotification(row));
    this.notificationsState.set(
      this.sortNotifications([...createdNotifications, ...this.notificationsState()]).slice(0, this.maxStoredNotifications)
    );
    this.enqueueAdminActivityToasts(newRows);
    this.refreshKnownActivityLogIds(snapshotIds);
    this.persistState();
  }

  private refreshKnownOrderKeys(snapshotKeys: string[]): void {
    const prioritizedKeys = [
      ...snapshotKeys,
      ...Array.from(this.knownOrderKeys).filter((key) => !snapshotKeys.includes(key))
    ].slice(0, this.maxKnownOrderKeys);

    this.knownOrderKeys = new Set(prioritizedKeys);
  }

  private refreshKnownActivityLogIds(snapshotIds: number[]): void {
    const prioritizedIds = [
      ...snapshotIds,
      ...Array.from(this.knownActivityLogIds).filter((id) => !snapshotIds.includes(id))
    ].slice(0, this.maxKnownActivityLogIds);

    this.knownActivityLogIds = new Set(prioritizedIds);
  }

  private createNotification(row: DashboardOrderRow, createdAt: string | null | undefined = null): OrderNotificationItem {
    const timestamp = createdAt || new Date().toISOString();
    const source = row.source;
    const reference = row.bsale_receipt || row.order_number || '-';
    return {
      id: `${this.toOrderKey(row)}:${new Date(timestamp).getTime() || Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      kind: 'new_order',
      title: `Nuevo Pedido de ${this.sourceLabel({ source } as OrderNotificationItem)}`,
      message: `Boleta ${reference} del ${row.ordered_at || 'Sin fecha'} por ${Number(row.total || 0).toFixed(2)}`,
      orderKey: this.toOrderKey(row),
      source,
      sourceRecordId: row.source_record_id,
      orderNumber: row.order_number,
      bsaleReceipt: row.bsale_receipt,
      orderedAt: row.ordered_at,
      total: Number(row.total || 0),
      reference,
      createdAt: timestamp,
      openedAt: null,
      readAt: null,
      hiddenAt: null
    };
  }

  private createActivityNotification(row: AdminOrderActivityNotificationRow): OrderNotificationItem {
    const createdAt = row.created_at || new Date().toISOString();
    return {
      id: `activity:${row.id}`,
      kind: 'status_change',
      title: row.title || 'Actualizacion Operativa de Pedido',
      message: row.message,
      source: row.source,
      orderNumber: row.order_number,
      reference: row.order_reference,
      total: row.total !== null && row.total !== undefined ? Number(row.total) : null,
      actorName: row.actor_name,
      actorRole: row.actor_role_label || row.actor_role,
      activityLogId: row.id,
      createdAt,
      openedAt: null,
      readAt: null,
      hiddenAt: null
    };
  }

  private toOrderKey(row: DashboardOrderRow): string {
    return `${row.source}:${row.source_record_id}`;
  }

  private buildPollingQuery(): Omit<DashboardOrdersQuery, 'page' | 'per_page'> {
    const today = this.toLocalDateString(new Date());
    const role = this.currentUser?.role;

    if (role === UserRole.DESPACHADOR || role === UserRole.DELIVERY) {
      return {
        source: 'all',
        scope: this.resolveScopeForUser(this.currentUser),
        period: 'month',
      };
    }

    return {
      source: 'all',
      scope: this.resolveScopeForUser(this.currentUser),
      period: 'day',
      date_from: today,
      date_to: today
    };
  }

  private resolveScopeForUser(user: User | null): 'all' | 'my_queue' {
    if (!user) {
      return 'my_queue';
    }

    if (user.role === UserRole.ADMIN || user.is_admin || user.role === UserRole.EMPAQUETADOR) {
      return 'all';
    }

    return 'my_queue';
  }

  private toLocalDateString(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadStateForCurrentUser(): void {
    const storageKey = this.getStorageKey();
    if (!storageKey) {
      this.notificationsState.set([]);
      this.knownOrderKeys = new Set<string>();
      this.knownActivityLogIds = new Set<number>();
      this.orderFeedInitializedAt = null;
      this.activityFeedInitializedAt = null;
      return;
    }

    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      this.notificationsState.set([]);
      this.knownOrderKeys = new Set<string>();
      this.knownActivityLogIds = new Set<number>();
      this.orderFeedInitializedAt = null;
      this.activityFeedInitializedAt = null;
      return;
    }

    try {
      const parsed = JSON.parse(rawValue) as PersistedNotificationsState;
      const notifications = Array.isArray(parsed.notifications) ? parsed.notifications.map((item) => this.normalizePersistedNotification(item)).filter(Boolean) as OrderNotificationItem[] : [];
      const cleanedNotifications = notifications.filter((item) => !this.isPurgedStatusChangeTestNotification(item));
      const removedActivityIds = notifications
        .filter((item) => this.isPurgedStatusChangeTestNotification(item))
        .map((item) => Number(item.activityLogId))
        .filter((value) => Number.isFinite(value));
      const knownOrderKeys = Array.isArray(parsed.knownOrderKeys) ? parsed.knownOrderKeys : [];
      const knownActivityLogIds = Array.isArray(parsed.knownActivityLogIds) ? parsed.knownActivityLogIds.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];

      this.notificationsState.set(cleanedNotifications.slice(0, this.maxStoredNotifications));
      this.knownOrderKeys = new Set(knownOrderKeys.slice(0, this.maxKnownOrderKeys));
      this.knownActivityLogIds = new Set([...knownActivityLogIds, ...removedActivityIds].slice(0, this.maxKnownActivityLogIds));
      this.orderFeedInitializedAt = parsed.orderFeedInitializedAt ?? (cleanedNotifications.some((item) => item.kind === 'new_order') ? new Date().toISOString() : null);
      this.activityFeedInitializedAt = parsed.activityFeedInitializedAt ?? (cleanedNotifications.some((item) => item.kind === 'status_change') ? new Date().toISOString() : null);

      if (cleanedNotifications.length !== notifications.length) {
        this.persistState();
      }
    } catch {
      this.notificationsState.set([]);
      this.knownOrderKeys = new Set<string>();
      this.knownActivityLogIds = new Set<number>();
      this.orderFeedInitializedAt = null;
      this.activityFeedInitializedAt = null;
      localStorage.removeItem(storageKey);
    }
  }

  private persistState(): void {
    const storageKey = this.getStorageKey();
    if (!storageKey) {
      return;
    }

    const payload: PersistedNotificationsState = {
      orderFeedInitializedAt: this.orderFeedInitializedAt,
      activityFeedInitializedAt: this.activityFeedInitializedAt,
      knownOrderKeys: Array.from(this.knownOrderKeys).slice(0, this.maxKnownOrderKeys),
      knownActivityLogIds: Array.from(this.knownActivityLogIds).slice(0, this.maxKnownActivityLogIds),
      notifications: this.notificationsState().slice(0, this.maxStoredNotifications)
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  private getStorageKey(): string | null {
    const userId = this.currentUser?.id;
    return userId ? `order_notifications:${userId}` : null;
  }

  private sortNotifications(items: OrderNotificationItem[]): OrderNotificationItem[] {
    return [...items].sort((left, right) => {
      if (!!left.readAt !== !!right.readAt) {
        return left.readAt ? 1 : -1;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  private fetchAdminActivityNotifications(perPage: number): import('rxjs').Observable<AdminOrderActivityNotificationsResponse> {
    return this.http.get<AdminOrderActivityNotificationsResponse>(this.apiUrl, {
      params: {
        per_page: String(perPage)
      }
    });
  }

  private shouldFetchActivityNotifications(): boolean {
    if (!this.currentUser) {
      return false;
    }

    return this.currentUser.is_admin || [UserRole.ADMIN, UserRole.DESPACHADOR, UserRole.DELIVERY].includes(this.currentUser.role);
  }

  private shouldCreateNewOrderNotifications(): boolean {
    if (!this.currentUser) {
      return false;
    }

    return this.currentUser.is_admin || [UserRole.ADMIN, UserRole.EMPAQUETADOR].includes(this.currentUser.role);
  }

  private handleRoleQueueToast(rows: DashboardOrderRow[]): void {
    if (!this.currentUser) {
      return;
    }

    if (this.currentUser.role === UserRole.DESPACHADOR) {
      const count = rows.filter((row) => String(row.status?.value || '') === 'empaquetado').length;
      if (count > 0) {
        this.showToastCard(
          'Pedidos por Despachar',
          count,
          `Tienes ${count} cantidad de Pedidos por Despachar`,
          `dispatcher:${count}`
        );
      }
      return;
    }

    if (this.currentUser.role === UserRole.DELIVERY) {
      const today = this.toLocalDateString(new Date());
      const count = rows.filter((row) => this.isDeliveryOrderForToday(row, today)).length;
      if (count > 0) {
        this.showToastCard(
          'Pedidos para Entregar',
          count,
          `Tienes ${count} cantidad de Pedidos para entregar el dia de hoy, Marcalos En Camino cuando inicies la ruta y Entregado cuando lo entregues al Cliente`,
          `delivery:${count}:${today}`
        );
      }
    }
  }

  private showNewOrdersToast(count: number): void {
    if (!count || count < 1) {
      return;
    }

    const message = `Tienes ${count} pedidos nuevos porfavor dale al boton "Recargar" para Actualizar la tabla de pedidos`;
    const title = this.currentUser?.role === UserRole.EMPAQUETADOR ? 'Pedidos Nuevos Pendientes' : 'Pedidos Nuevos Detectados';

    this.showToastCard(title, count, message, `new-orders:${count}:${Date.now()}`);
  }

  private showToastCard(title: string, count: number, message: string, signature: string): void {
    if (this.lastToastSignature === signature) {
      return;
    }

    this.lastToastSignature = signature;
    this.newOrdersToastState.set({
      id: signature,
      title,
      count,
      message
    });
    this.newOrdersToastLeavingState.set(false);

    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = window.setTimeout(() => {
      this.dismissNewOrdersToast();
    }, 10000);
  }

  private enqueueAdminActivityToasts(rows: AdminOrderActivityNotificationRow[]): void {
    if (!this.currentUser?.is_admin && this.currentUser?.role !== UserRole.ADMIN) {
      return;
    }

    const nextToasts = rows
      .sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime())
      .map((row) => this.createAdminActivityToast(row));

    if (nextToasts.length === 0) {
      return;
    }

    this.pendingAdminActivityToasts.push(...nextToasts);
    if (!this.adminActivityToastState()) {
      this.showNextAdminActivityToast();
    }
  }

  private createAdminActivityToast(row: AdminOrderActivityNotificationRow): AdminActivityToastState {
    const actorLabel = [String(row.actor_name || '').trim(), String(row.actor_role_label || row.actor_role || '').trim()]
      .filter(Boolean)
      .join(' ')
      .trim();
    const actor = actorLabel || 'Usuario';
    const reference = String(row.order_reference || row.order_number || 'Pedido').trim();
    const isError = row.new_status === 'error_en_pedido';
    const statusLabel = String(row.new_status_label || row.title || 'Actualizado').trim();

    return {
      id: `admin-activity:${row.id}`,
      title: isError ? 'Alerta Operativa' : 'Cambio de Estado Exitoso',
      tone: isError ? 'danger' : 'success',
      message: isError
        ? `El Usuario (${actor}) marco un error en el pedido ${reference}`
        : `El Usuario (${actor}) marco el pedido ${reference} como ${statusLabel}`,
    };
  }

  private showNextAdminActivityToast(): void {
    const nextToast = this.pendingAdminActivityToasts.shift() ?? null;
    if (!nextToast) {
      this.adminActivityToastState.set(null);
      this.adminActivityToastLeavingState.set(false);
      if (this.adminActivityToastTimeoutId !== null) {
        window.clearTimeout(this.adminActivityToastTimeoutId);
        this.adminActivityToastTimeoutId = null;
      }
      return;
    }

    this.adminActivityToastState.set(nextToast);
    this.adminActivityToastLeavingState.set(false);
    if (this.adminActivityToastTimeoutId !== null) {
      window.clearTimeout(this.adminActivityToastTimeoutId);
    }

    this.adminActivityToastTimeoutId = window.setTimeout(() => {
      this.dismissAdminActivityToast();
    }, 10000);
  }

  private isDeliveryOrderForToday(row: DashboardOrderRow, today: string): boolean {
    const normalizedStatus = String(row.status?.value || '');
    if (normalizedStatus !== 'despachado' && normalizedStatus !== 'en_camino') {
      return false;
    }

    const deliveryDate = String(row.delivery_date || '').trim();
    if (!deliveryDate) {
      return true;
    }

    return deliveryDate.includes(today) || deliveryDate.includes(today.split('-').reverse().join('/'));
  }

  private isPurgedStatusChangeTestNotification(item: OrderNotificationItem): boolean {
    return item.kind === 'status_change' && this.purgedStatusChangeTestMessages.has(String(item.message || '').trim());
  }

  private isPurgedStatusChangeTestRow(row: AdminOrderActivityNotificationRow): boolean {
    return this.purgedStatusChangeTestMessages.has(String(row.message || '').trim());
  }

  private normalizePersistedNotification(item: Partial<OrderNotificationItem>): OrderNotificationItem | null {
    const kind = item.kind ?? 'new_order';
    const createdAt = item.createdAt || new Date().toISOString();

    if (kind === 'status_change') {
      return {
        id: String(item.id || `activity:${item.activityLogId || Date.now()}`),
        kind,
        title: item.title || 'Actualizacion Operativa de Pedido',
        message: item.message || 'Se registro un cambio de estado en un pedido.',
        source: item.source ?? null,
        orderNumber: item.orderNumber ?? null,
        reference: item.reference ?? item.bsaleReceipt ?? item.orderNumber ?? null,
        total: item.total ?? null,
        actorName: item.actorName ?? null,
        actorRole: item.actorRole ?? null,
        activityLogId: item.activityLogId ?? null,
        createdAt,
        openedAt: item.openedAt ?? null,
        readAt: item.readAt ?? null,
        hiddenAt: item.hiddenAt ?? null,
      };
    }

    const source = item.source ?? 'woo';
    const reference = item.reference ?? item.bsaleReceipt ?? item.orderNumber ?? '-';
    return {
      id: String(item.id || `${item.orderKey || 'order'}:${Date.now()}`),
      kind: 'new_order',
      title: item.title || `Nuevo Pedido de ${source === 'bsale' ? 'Bsale' : 'Woo'}`,
      message: item.message || `Boleta ${reference} del ${item.orderedAt || 'Sin fecha'} por ${Number(item.total || 0).toFixed(2)}`,
      source,
      orderKey: item.orderKey ?? null,
      sourceRecordId: item.sourceRecordId ?? null,
      orderNumber: item.orderNumber ?? null,
      bsaleReceipt: item.bsaleReceipt ?? null,
      orderedAt: item.orderedAt ?? null,
      total: item.total ?? null,
      reference,
      createdAt,
      openedAt: item.openedAt ?? null,
      readAt: item.readAt ?? null,
      hiddenAt: item.hiddenAt ?? null,
    };
  }
}