import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order } from '../../../models/order.model';
import { OrderTrackingComponent } from './order-tracking.component';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, OrderTrackingComponent, FormsModule],
  template: `
    <div class="modal fade" id="orderDetailModal" tabindex="-1" [class.show]="isOpen" [style.display]="isOpen ? 'block' : 'none'">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Detalles del Pedido #{{ order?.external_id || order?.id }}</h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          <div class="modal-body" *ngIf="order">
            <!-- Tracking Timeline -->
            <div class="mb-4">
              <h6 class="text-muted mb-3">Estado del Pedido - Haz click en los círculos para cambiar estado</h6>
              <div class="alert alert-info py-2 px-3 small mb-3">
                En Proceso y Entregado sincronizan con WooCommerce. Empaquetado, Despachado y En Camino son cambios internos. Si marcas error (✕), se cancela en Woo y se registra auditoría con motivo.
              </div>
              <app-order-tracking 
                [currentStatus]="order.status" 
                [errorReason]="order.error_reason"
                [canEdit]="canEditOrderStatus(order)"
                (statusSelected)="onStatusSelected($event)">
              </app-order-tracking>

              <div class="alert alert-warning py-2 px-3 small mb-0" *ngIf="!canEditOrderStatus(order)">
                {{ order.update_status_message || 'Este pedido viene directo de WooCommerce y todavia no existe en la tabla local. Sincronizalo para poder cambiar estado.' }}
              </div>
            </div>

            <hr>

            <!-- Customer Information -->
            <div class="row mb-4">
              <div class="col-md-6">
                <h6 class="text-muted">Información del Cliente</h6>
                <p><strong>Nombre:</strong> {{ order.customer_name || order.user?.name || 'N/A' }}</p>
                <p><strong>Email:</strong> {{ order.customer_email || 'N/A' }}</p>
                <p><strong>Teléfono:</strong> {{ order.customer_phone || 'N/A' }}</p>
              </div>
              <div class="col-md-6">
                <h6 class="text-muted">Información de Entrega</h6>
                <p><strong>Ubicación:</strong> {{ order.delivery_location || 'N/A' }}</p>
                <p><strong>Coordenadas:</strong> 
                  <span *ngIf="order.delivery_coordinates">
                    {{ order.delivery_coordinates.lat }}, {{ order.delivery_coordinates.lng }}
                  </span>
                  <span *ngIf="!order.delivery_coordinates">N/A</span>
                </p>
                <p><strong>Fecha Estimada de Entrega:</strong> {{ order.estimated_delivery_date ? formatEstimated(order.estimated_delivery_date) : 'N/A' }}</p>
                <p><strong>Fecha Real de Entrega:</strong> {{ order.delivery_date ? (order.delivery_date | date: 'short') : 'N/A' }}</p>
              </div>
            </div>

            <hr>

            <!-- Products -->
            <div class="mb-4">
              <h6 class="text-muted">Productos</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio Unitario</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of order.items">
                      <td>{{ item.product_name }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>\${{ item.price | number: '1.2-2' }}</td>
                      <td>\${{ (item.price * item.quantity) | number: '1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <hr>

            <!-- Order Summary -->
            <div class="row">
              <div class="col-md-6">
                <p><strong>Nro Boleta:</strong> {{ order.id }}</p>
                <p><strong>Origen:</strong> 
                  <span class="badge" [ngClass]="getOrderSourceBadgeClass(order)">
                    {{ getOrderSource(order) }}
                  </span>
                </p>
              </div>
              <div class="col-md-6 text-end">
                <p><strong>Fecha Creación:</strong> {{ order.created_at | date }}</p>
                <h5 class="text-primary"><strong>Total: \${{ order.total | number: '1.2-2' }}</strong></h5>
              </div>
            </div>

            <!-- Error Reason Display -->
            <div *ngIf="order.status === 'ERROR' && order.error_reason" class="alert alert-danger mt-3 mb-0">
              <strong>Motivo del Error:</strong> {{ order.error_reason }}
            </div>

            <div *ngIf="statusUpdateError" class="alert alert-danger mt-3 mb-0">
              {{ statusUpdateError }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="close()" [disabled]="isLoading">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade" [class.show]="isOpen" *ngIf="isOpen"></div>
  `,
  styles: [`
    .modal.show {
      display: block;
      background-color: rgba(0, 0, 0, 0.5);
    }
  `]
})
export class OrderDetailModalComponent implements OnChanges {
  @Input() order: Order | null = null;
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  isLoading = false;
  statusUpdateError = '';

  constructor(
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {}

  onStatusSelected(event: { status: string; confirmed: boolean; errorReason?: string; evidenceImage?: File }) {
    if (!event.confirmed || !this.order) return;
    if (!this.canEditOrderStatus(this.order)) {
      this.statusUpdateError = this.order.update_status_message || 'Este pedido no se puede actualizar hasta sincronizarse con la base local.';
      return;
    }

    this.statusUpdateError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    const resolvedOrderId = this.getOrderIdForStatusUpdate(this.order);

    if (!resolvedOrderId && this.isWooOrder(this.order)) {
      const lookupKey = this.order.external_id || this.order.woo_order_id || this.order.id;
      this.orderService.findInternalOrderIdByExternalId(lookupKey).subscribe({
        next: (internalId) => {
          if (!internalId) {
            this.statusUpdateError = 'No se encontro el pedido en la tabla local. Ejecuta sincronizacion y vuelve a intentar.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
          }

          this.order = {
            ...this.order!,
            internal_order_id: internalId
          };

          this.executeStatusUpdate(internalId, event);
        },
        error: () => {
          this.statusUpdateError = 'No se pudo validar el id interno del pedido antes de actualizar estado.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    if (!resolvedOrderId) {
      this.statusUpdateError = 'No hay id interno para actualizar estado. Sincroniza el pedido Woo con la base local.';
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.executeStatusUpdate(resolvedOrderId, event);
  }

  private executeStatusUpdate(updateOrderId: number, event: { status: string; confirmed: boolean; errorReason?: string; evidenceImage?: File }) {

    this.orderService.updateOrderStatus(
      updateOrderId,
      event.status as any,
      {
        errorReason: event.errorReason,
        evidenceImage: event.evidenceImage
      }
    ).subscribe({
      next: (response) => {
        console.log(`Estado actualizado a ${this.getStatusLabel(event.status)}`);
        this.order = {
          ...this.order!,
          ...response,
          status: (response?.status || event.status) as any
        };

        if (event.status !== 'ERROR') {
          this.order.error_reason = response?.error_reason || '';
        }

        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al actualizar el estado:', error);
        console.error('Status:', error.status);
        console.error('Response:', error.error);

        if (error.status === 404) {
          this.statusUpdateError = 'No se encontro el pedido en la tabla local. Sincroniza pedidos con el backend y vuelve a intentar.';
        } else {
          this.statusUpdateError = error?.error?.message || 'No se pudo actualizar el estado del pedido.';
        }

        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private getOrderIdForStatusUpdate(order: Order): number | null {
    if (order.internal_order_id) {
      return order.internal_order_id;
    }

    const idValue = Number(order.id);
    const externalNumeric = Number(order.external_id);
    const looksLikeWooDirectId = !Number.isNaN(idValue) && !Number.isNaN(externalNumeric) && idValue === externalNumeric;

    // When data comes from local DB, id is local and typically differs from external_id.
    if (!looksLikeWooDirectId && idValue > 0) {
      return idValue;
    }

    if (this.isWooOrder(order)) {
      return null;
    }

    return null;
  }

  private isWooOrder(order: Order): boolean {
    return order.source === 'woocommerce' || !!order.store_slug || !!order.woo_order_id;
  }

  canEditOrderStatus(order: Order | null): boolean {
    if (!order) return false;
    return this.getOrderIdForStatusUpdate(order) !== null;
  }

  getOrderSource(order?: Order): string {
    if (!order) return 'Desconocido';

    if (order.store_slug) {
      return order.store_slug;
    }

    if (order.woo_source || order.source === 'woocommerce' || order.store_slug) {
      return order.woo_source || 'WooCommerce';
    }

    const role = order.user.role?.toLowerCase();
    if (role?.includes('web')) return 'Web';
    if (role?.includes('redes')) return 'Redes';

    return 'Redes';
  }

  getOrderSourceBadgeClass(order?: Order): string {
    if (!order) return 'bg-secondary';
    if (order.woo_source || order.source === 'woocommerce' || order.store_slug) return 'bg-warning';

    const role = order.user?.role?.toLowerCase();
    if (role?.includes('web')) return 'bg-primary';
    if (role?.includes('redes')) return 'bg-info';

    return 'bg-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'EN_PROCESO': 'En Proceso',
      'EMPAQUETADO': 'Empaquetado',
      'DESPACHADO': 'Despachado',
      'EN_CAMINO': 'En Camino',
      'ENTREGADO': 'Entregado',
      'ERROR': 'Error',
      'CANCELADO': 'Cancelado'
    };
    return labels[status] || status;
  }

  // helper para fechas estimadas en modal
  formatEstimated(date: string): string {
    if (!date) return 'N/A';
    if (date.includes(' y ')) return date;
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(d);
    }
    return date;
  }



  close() {
    this.closeModal.emit();
  }
}
