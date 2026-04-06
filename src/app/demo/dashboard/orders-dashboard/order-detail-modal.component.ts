import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardOrderAllowedTransition, DashboardOrderDetail, DashboardOrderRow } from '../../../models/dashboard-order.model';
import { OrderStatus } from '../../../models/order.model';
import { User } from '../../../models/user.model';
import { DashboardOrdersService } from '../../../services/dashboard-orders.service';
import { OrderService } from '../../../services/order.service';
import { UserService } from '../../../services/user.service';
import {
  fallbackText,
  formatDashboardCurrency,
  formatDashboardDate,
  getAssignedDeliveryName,
  getDashboardOrderTitle,
  getDashboardStatusClass,
  normalizeDashboardPaymentMethods,
  normalizeDashboardProducts,
  resolveDashboardDetailStatus
} from '../../../utils/dashboard-order-ui.utils';
import { OrderTrackingComponent } from './order-tracking.component';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderTrackingComponent],
  template: `
    <div class="modal fade" tabindex="-1" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <span *ngIf="order?.readonly" class="badge bg-info text-dark me-2">BSALE</span>
              Detalles del Pedido #{{ orderTitle }}
            </h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>

          <div class="modal-body">
            <div *ngIf="loading" class="text-center py-5">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Cargando...</span>
              </div>
            </div>

            <div *ngIf="!loading && errorMessage" class="alert mb-0" [ngClass]="errorMessageClass">
              {{ errorMessage }}
            </div>

            <ng-container *ngIf="!loading && !errorMessage && detail as currentDetail">
              <ng-container *ngIf="currentDetail.readonly; else editableDetail">
                <div class="alert alert-info py-2 px-3 small mb-3">
                  Este pedido proviene de Bsale y es de solo lectura.
                </div>

                <div class="alert alert-secondary py-2 px-3 small mb-3" *ngIf="readonlyFallbackNotice">
                  {{ readonlyFallbackNotice }}
                </div>

                <div class="row mb-3 g-2">
                  <div class="col-md-4">
                    <div class="card border-0 highlight-card h-100">
                      <div class="card-body py-2 px-3">
                        <p class="text-muted small mb-1">Fecha de Despacho</p>
                        <strong>{{ formatDate(currentDetail.dispatch_date, 'Sin fecha', false) }}</strong>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="card border-0 highlight-card h-100">
                      <div class="card-body py-2 px-3">
                        <p class="text-muted small mb-1">Marca / Red Social</p>
                        <strong>{{ text(currentDetail.location, 'No registrado') }}</strong>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="card border-0 highlight-card h-100">
                      <div class="card-body py-2 px-3">
                        <p class="text-muted small mb-1">Estado del Pedido</p>
                        <span class="badge" [ngClass]="statusBadgeClass(currentDetail)">{{ detailStatusLabel(currentDetail) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <hr>

                <div class="row mb-4">
                  <div class="col-md-6">
                    <h6 class="text-muted">Informacion del Cliente</h6>
                    <p><strong>Nombre:</strong> {{ text(currentDetail.customer?.name, 'No registrado') }}</p>
                    <p><strong>DNI/RUC:</strong> {{ text(currentDetail.customer?.document, 'No registrado') }}</p>
                    <p><strong>Email:</strong> {{ text(currentDetail.customer?.email, 'No registrado') }}</p>
                    <p><strong>Telefono:</strong> {{ text(currentDetail.customer?.phone, 'No registrado') }}</p>
                  </div>
                  <div class="col-md-6">
                    <h6 class="text-muted">Informacion del Vendedor</h6>
                    <p><strong>Vendedor:</strong> {{ text(currentDetail.seller?.name, 'No registrado') }}</p>
                    <p><strong>Fecha Emision:</strong> {{ formatDate(currentDetail.seller?.issue_date, 'Sin fecha', false) }}</p>
                    <p><strong>Boleta:</strong> {{ text(currentDetail.seller?.receipt || currentDetail.bsale_receipt, 'No registrado') }}</p>
                  </div>
                </div>

                <hr>

                <div class="mb-4">
                  <h6 class="text-muted">Informacion de Pago</h6>
                  <div class="row">
                    <div class="col-md-8">
                      <p><strong>Metodos:</strong> {{ paymentMethods(currentDetail) }}</p>
                    </div>
                    <div class="col-md-4 text-md-end">
                      <h5 class="text-primary mb-0"><strong>Total: {{ paymentTotal(currentDetail) }}</strong></h5>
                    </div>
                  </div>
                </div>

                <hr>

                <div class="mb-2">
                  <h6 class="text-muted">Prendas</h6>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>SKU</th>
                          <th>Cantidad</th>
                          <th>Precio Unit.</th>
                          <th>Descuento</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let product of products(currentDetail)">
                          <td>{{ text(product.name, '-') }}</td>
                          <td>{{ text(product.sku, '-') }}</td>
                          <td>{{ text(product.quantity, '-') }}</td>
                          <td>{{ money(product.unit_price) }}</td>
                          <td>{{ money(product.discount) }}</td>
                          <td><strong>{{ money(product.total) }}</strong></td>
                        </tr>
                        <tr *ngIf="products(currentDetail).length === 0">
                          <td colspan="6" class="text-center text-muted py-4">No hay prendas registradas.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </ng-container>

              <ng-template #editableDetail>
                <div class="mb-4">
                  <h6 class="text-muted mb-3">Estado del Pedido</h6>
                  <div class="alert alert-info py-2 px-3 small mb-3">
                    En Proceso y Entregado sincronizan con WooCommerce. Empaquetado, Despachado y En Camino siguen el flujo interno.
                  </div>
                  <app-order-tracking
                    [currentStatus]="trackingStatus(currentDetail)"
                    [errorReason]="statusUpdateError"
                    [canEdit]="canEditOrderStatus(currentDetail)"
                    [allowedTransitions]="allowedTransitions(currentDetail)"
                    (statusSelected)="onStatusSelected($event)">
                  </app-order-tracking>
                  <div class="alert alert-secondary py-2 px-3 small mb-0" *ngIf="transitionsHelpMessage(currentDetail)">
                    {{ transitionsHelpMessage(currentDetail) }}
                  </div>
                </div>

                <hr>

                <div class="row mb-4">
                  <div class="col-md-6">
                    <h6 class="text-muted">Informacion del Cliente</h6>
                    <p><strong>Nombre:</strong> {{ text(currentDetail.customer?.name, 'No registrado') }}</p>
                    <p><strong>DNI:</strong> {{ text(currentDetail.customer?.document, 'No registrado') }}</p>
                    <p><strong>Email:</strong> {{ text(currentDetail.customer?.email, 'No registrado') }}</p>
                    <p><strong>Telefono:</strong> {{ text(currentDetail.customer?.phone, 'No registrado') }}</p>
                  </div>
                  <div class="col-md-6">
                    <h6 class="text-muted">Informacion de Entrega</h6>
                    <p><strong>Ubicacion:</strong> {{ text(currentDetail.location, 'No registrado') }}</p>
                    <p><strong>Fecha de Despacho:</strong> {{ formatDate(currentDetail.dispatch_date, 'Sin fecha', false) }}</p>
                    <p><strong>Estado:</strong> <span class="badge" [ngClass]="statusBadgeClass(currentDetail)">{{ detailStatusLabel(currentDetail) }}</span></p>
                    <p><strong>Numero Pedido:</strong> {{ text(currentDetail.order_number, '-') }}</p>
                    <p *ngIf="assignedDeliveryName(currentDetail)"><strong>Delivery Asignado:</strong> {{ assignedDeliveryName(currentDetail) }}</p>
                  </div>
                </div>

                <hr>

                <div class="mb-4">
                  <h6 class="text-muted">Productos</h6>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th>Cantidad</th>
                          <th>Precio Unitario</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let product of products(currentDetail)">
                          <td>{{ text(product.name, '-') }}</td>
                          <td>{{ text(product.sku, '-') }}</td>
                          <td>{{ text(product.quantity, '-') }}</td>
                          <td>{{ money(product.unit_price) }}</td>
                          <td><strong>{{ money(product.total) }}</strong></td>
                        </tr>
                        <tr *ngIf="products(currentDetail).length === 0">
                          <td colspan="5" class="text-center text-muted py-4">No hay productos disponibles para este pedido.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr>

                <div class="row">
                  <div class="col-md-6">
                    <p><strong>Origen:</strong> WooCommerce</p>
                    <p><strong>ID Local:</strong> {{ currentDetail.id }}</p>
                  </div>
                  <div class="col-md-6 text-md-end">
                    <p><strong>Referencia Externa:</strong> {{ text(currentDetail.external_id, '-') }}</p>
                    <h5 class="text-primary mb-0"><strong>Total: {{ paymentTotal(currentDetail) }}</strong></h5>
                  </div>
                </div>

                <div *ngIf="statusUpdateError" class="alert alert-danger mt-3 mb-0">
                  {{ statusUpdateError }}
                </div>
              </ng-template>
            </ng-container>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="close()" [disabled]="loading">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" tabindex="-1" [class.show]="showDeliveryAssignmentModal" [style.display]="showDeliveryAssignmentModal ? 'block' : 'none'">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Asignar Delivery</h5>
            <button type="button" class="btn-close" (click)="closeDeliveryAssignmentModal()"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted small mb-3">Selecciona el delivery responsable antes de marcar el pedido como Despachado.</p>
            <div *ngIf="deliveryUsersLoading" class="text-center py-3">
              <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Cargando...</span>
              </div>
            </div>
            <div *ngIf="!deliveryUsersLoading">
              <select class="form-select" [(ngModel)]="selectedDeliveryUserId">
                <option [ngValue]="null">Seleccionar delivery</option>
                <option *ngFor="let user of deliveryUsers" [ngValue]="user.id">
                  {{ user.name || user.email }}{{ user.is_active === false ? ' (inactivo)' : '' }}
                </option>
              </select>
            </div>
            <div *ngIf="deliveryAssignmentError" class="alert alert-danger mt-3 mb-0">{{ deliveryAssignmentError }}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDeliveryAssignmentModal()" [disabled]="loading">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="confirmDeliveryAssignment()" [disabled]="loading || !selectedDeliveryUserId">Confirmar Despacho</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-backdrop fade" [class.show]="isOpen" *ngIf="isOpen"></div>
    <div class="modal-backdrop fade" [class.show]="showDeliveryAssignmentModal" *ngIf="showDeliveryAssignmentModal"></div>
  `,
  styles: [`
    .modal.show {
      display: block;
      background-color: rgba(0, 0, 0, 0.5);
    }

    .highlight-card {
      background-color: #f6f8fb;
      border: 1px solid #e9edf3 !important;
    }
  `]
})
export class OrderDetailModalComponent implements OnChanges {
  @Input() order: DashboardOrderRow | null = null;
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() orderChanged = new EventEmitter<void>();

  detail: DashboardOrderDetail | null = null;
  loading = false;
  errorMessage = '';
  errorMessageClass = 'alert-danger';
  statusUpdateError = '';
  readonlyFallbackNotice = '';
  deliveryUsers: User[] = [];
  deliveryUsersLoading = false;
  showDeliveryAssignmentModal = false;
  selectedDeliveryUserId: number | null = null;
  pendingWorkflowStatus: OrderStatus | null = null;
  deliveryAssignmentError = '';
  private postUpdateMessage = '';

  constructor(
    private readonly dashboardOrdersService: DashboardOrdersService,
    private readonly orderService: OrderService,
    private readonly userService: UserService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] || changes['order']) && this.isOpen && this.order) {
      this.loadDetail();
      return;
    }

    if (changes['isOpen'] && !this.isOpen) {
      this.detail = null;
      this.errorMessage = '';
      this.errorMessageClass = 'alert-danger';
      this.statusUpdateError = '';
      this.postUpdateMessage = '';
      this.readonlyFallbackNotice = '';
      this.closeDeliveryAssignmentModal();
    }
  }

  get orderTitle(): string {
    return this.detail ? getDashboardOrderTitle(this.detail) : (this.order ? getDashboardOrderTitle(this.order) : '-');
  }

  close(): void {
    this.closeModal.emit();
  }

  loadDetail(): void {
    if (!this.order) {
      return;
    }

    const resolved = this.dashboardOrdersService.parseDetailEndpoint(this.order.detail_endpoint) ?? {
      source: this.order.source,
      id: this.order.source_record_id
    };

    this.loading = true;
    this.errorMessage = '';
    this.errorMessageClass = 'alert-danger';
    this.statusUpdateError = '';
    this.readonlyFallbackNotice = '';
    this.cdr.markForCheck();

    this.dashboardOrdersService.fetchDashboardOrderDetail(resolved.source, resolved.id).subscribe({
      next: ({ order }) => {
        this.detail = order;
        this.loading = false;
        this.postUpdateMessage = '';
        this.readonlyFallbackNotice = '';
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (error?.status === 403 && this.order?.readonly) {
          this.detail = this.buildReadonlyFallbackDetail(this.order);
          this.loading = false;
          this.errorMessage = '';
          this.errorMessageClass = 'alert-info';
          this.readonlyFallbackNotice = 'El backend no habilito el detalle ampliado para este pedido Bsale en tu rol actual. Se muestra un resumen de solo lectura con la informacion disponible en la tabla.';
          this.cdr.markForCheck();
          return;
        }

        this.detail = null;
        this.loading = false;
        if (error?.status === 403 && this.postUpdateMessage) {
          this.errorMessage = this.postUpdateMessage;
          this.errorMessageClass = 'alert-info';
        } else if (error?.status === 403) {
          this.errorMessage = 'Este pedido ya no forma parte de tu cola activa o ya no tienes permisos para verlo en detalle.';
          this.errorMessageClass = 'alert-warning';
        } else {
          this.errorMessage = 'No se pudo cargar el detalle del pedido.';
          this.errorMessageClass = 'alert-danger';
        }
        this.cdr.markForCheck();
      }
    });
  }

  canEditOrderStatus(detail: DashboardOrderDetail | null): boolean {
    return !!detail && !detail.readonly && detail.id > 0 && this.allowedTransitions(detail).length > 0;
  }

  trackingStatus(detail: DashboardOrderDetail | null): string {
    const resolved = resolveDashboardDetailStatus(detail);
    const map: Record<string, string> = {
      en_proceso: OrderStatus.EN_PROCESO,
      empaquetado: OrderStatus.EMPAQUETADO,
      despachado: OrderStatus.DESPACHADO,
      en_camino: OrderStatus.EN_CAMINO,
      entregado: OrderStatus.ENTREGADO,
      error_en_pedido: OrderStatus.ERROR_EN_PEDIDO,
      cancelado: OrderStatus.CANCELADO
    };
    return map[resolved.value] || OrderStatus.EN_PROCESO;
  }

  allowedTransitions(detail: DashboardOrderDetail | null): DashboardOrderAllowedTransition[] {
    return detail?.allowed_transitions ?? [];
  }

  transitionsHelpMessage(detail: DashboardOrderDetail | null): string {
    if (!detail || detail.readonly) {
      return '';
    }

    const transitions = this.allowedTransitions(detail);
    if (transitions.length === 0) {
      return 'No hay acciones disponibles para este pedido en este momento.';
    }

    const labels = transitions.map((transition) => transition.label);
    const message = `Acciones disponibles: ${labels.join(', ')}.`;

    return transitions.some((transition) => transition.requires_delivery_user_id)
      ? `${message} Algunas transiciones requieren asignar un delivery antes de confirmar.`
      : message;
  }

  assignedDeliveryName(detail: DashboardOrderDetail): string {
    return getAssignedDeliveryName(detail);
  }

  onStatusSelected(event: { status: string; confirmed: boolean; errorReason?: string; evidenceImage?: File }): void {
    if (!event.confirmed || !this.detail || !this.canEditOrderStatus(this.detail)) {
      return;
    }

    if (this.transitionRequiresDeliveryUser(this.detail, event.status)) {
      this.pendingWorkflowStatus = event.status as OrderStatus;
      this.openDeliveryAssignmentModal();
      return;
    }

    this.submitStatusUpdate(event.status as OrderStatus, event.errorReason, event.evidenceImage);
  }

  confirmDeliveryAssignment(): void {
    if (!this.pendingWorkflowStatus || !this.selectedDeliveryUserId) {
      return;
    }

    this.submitStatusUpdate(this.pendingWorkflowStatus, undefined, undefined, this.selectedDeliveryUserId);
  }

  closeDeliveryAssignmentModal(): void {
    this.showDeliveryAssignmentModal = false;
    this.selectedDeliveryUserId = null;
    this.pendingWorkflowStatus = null;
    this.deliveryAssignmentError = '';
  }

  private openDeliveryAssignmentModal(): void {
    this.showDeliveryAssignmentModal = true;
    this.deliveryAssignmentError = '';
    this.selectedDeliveryUserId = this.detail?.assigned_delivery_user_id ?? null;
    if (this.deliveryUsers.length > 0) {
      return;
    }

    this.deliveryUsersLoading = true;
    this.userService.getAllUsers(undefined, 'delivery').subscribe({
      next: (users) => {
        this.deliveryUsers = [...users].sort((left, right) => Number(right.is_active !== false) - Number(left.is_active !== false));
        this.deliveryUsersLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.deliveryUsers = [];
        this.deliveryUsersLoading = false;
        this.deliveryAssignmentError = 'No se pudo cargar la lista de deliverys.';
        this.cdr.markForCheck();
      }
    });
  }

  private submitStatusUpdate(status: OrderStatus, errorReason?: string, evidenceImage?: File, deliveryUserId?: number): void {
    if (!this.detail) {
      return;
    }

    this.loading = true;
    this.statusUpdateError = '';
    this.deliveryAssignmentError = '';
    this.cdr.markForCheck();

    this.orderService.updateOrderStatus(this.detail.id, status, {
      errorReason,
      evidenceImage,
      deliveryUserId
    }).subscribe({
      next: () => {
        this.postUpdateMessage = this.buildPostUpdateMessage(status);
        this.closeDeliveryAssignmentModal();
        this.orderChanged.emit();
        this.loadDetail();
      },
      error: (error) => {
        this.loading = false;
        const statusCode = error?.status;
        const message = error?.error?.message || 'No se pudo actualizar el estado del pedido.';

        if (statusCode === 403 || statusCode === 422) {
          this.orderChanged.emit();
          this.loadDetail();
        }

        if (this.showDeliveryAssignmentModal) {
          this.deliveryAssignmentError = message;
        } else {
          this.statusUpdateError = message;
        }
        this.cdr.markForCheck();
      }
    });
  }

  private buildPostUpdateMessage(status: OrderStatus): string {
    if (status === OrderStatus.ERROR_EN_PEDIDO) {
      return 'Error recibido. Sera adjuntado al nuevo estado del pedido y notificado al Despachador para cancelar o solucionar el error.';
    }

    if (status === OrderStatus.ENTREGADO) {
      return 'Entrega registrada correctamente. El pedido saldra de tu cola activa cuando el backend confirme el nuevo estado.';
    }

    if (status === OrderStatus.EN_CAMINO) {
      return 'El pedido fue actualizado correctamente y la cola operativa se recargara con el nuevo estado.';
    }

    return '';
  }

  private transitionRequiresDeliveryUser(detail: DashboardOrderDetail | null, status: string): boolean {
    return this.allowedTransitions(detail).some(
      (transition) => transition.value === this.normalizeTransitionValue(status) && transition.requires_delivery_user_id
    );
  }

  private normalizeTransitionValue(status: string): DashboardOrderAllowedTransition['value'] {
    return status.toLowerCase() as DashboardOrderAllowedTransition['value'];
  }

  private buildReadonlyFallbackDetail(order: DashboardOrderRow): DashboardOrderDetail {
    return {
      source: order.source,
      readonly: true,
      id: order.source_record_id,
      external_id: order.bsale_receipt || order.order_number,
      order_number: order.order_number,
      bsale_receipt: order.bsale_receipt,
      status: order.status,
      dispatch_date: order.dispatch_date ?? order.delivery_date,
      location: order.location,
      customer: order.customer ?? {
        name: order.customer_name
      },
      seller: order.seller ?? {
        name: order.vendor_name,
        receipt: order.bsale_receipt
      },
      payment: order.payment ?? {
        total: order.total
      },
      products: order.products ?? []
    };
  }

  text(value: unknown, fallback: string): string {
    return fallbackText(value, fallback);
  }

  formatDate(value: string | null | undefined, fallback: string, includeTime: boolean): string {
    return formatDashboardDate(value, fallback, includeTime);
  }

  money(value: number | string | null | undefined): string {
    return formatDashboardCurrency(value);
  }

  products(detail: DashboardOrderDetail) {
    return normalizeDashboardProducts(detail.products);
  }

  paymentMethods(detail: DashboardOrderDetail): string {
    const methods = normalizeDashboardPaymentMethods(detail.payment?.methods);
    return methods.length ? methods.join(', ') : 'No registrado';
  }

  paymentTotal(detail: DashboardOrderDetail): string {
    return formatDashboardCurrency(detail.payment?.total ?? this.order?.total ?? 0);
  }

  detailStatusLabel(detail: DashboardOrderDetail): string {
    return resolveDashboardDetailStatus(detail).label;
  }

  statusBadgeClass(detail: DashboardOrderDetail): string {
    return getDashboardStatusClass(resolveDashboardDetailStatus(detail).value);
  }
}