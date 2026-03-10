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
            <h5 class="modal-title">Detalles del Pedido #{{ order?.id }}</h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          <div class="modal-body" *ngIf="order">
            <!-- Tracking Timeline -->
            <div class="mb-4">
              <h6 class="text-muted mb-3">Estado del Pedido - Haz click en los círculos para cambiar estado</h6>
              <app-order-tracking 
                [currentStatus]="order.status" 
                [errorReason]="order.error_reason"
                (statusSelected)="onStatusSelected($event)">
              </app-order-tracking>
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
                <p><strong>Fecha de Entrega:</strong> {{ order.delivery_date ? (order.delivery_date | date: 'short') : 'N/A' }}</p>
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
                  <span class="badge" [ngClass]="getOrderSource(order) === 'Web' ? 'bg-primary' : 'bg-info'">
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

  constructor(
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['order'] && this.order) {
      // Order updated, nothing special needed
    }
  }

  onStatusSelected(event: { status: string; confirmed: boolean; errorReason?: string }) {
    if (!event.confirmed || !this.order) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    this.orderService.updateOrderStatus(
      this.order.id,
      event.status as any,
      event.errorReason
    ).subscribe({
      next: (response) => {
        console.log(`Estado actualizado a ${this.getStatusLabel(event.status)}`);
        this.order!.status = event.status as any;
        if (event.errorReason) {
          this.order!.error_reason = event.errorReason;
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al actualizar el estado:', error);
        console.error('Status:', error.status);
        console.error('Response:', error.error);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getOrderSource(order?: Order): string {
    if (!order?.user) return 'Redes';

    const role = order.user.role?.toLowerCase();
    if (role?.includes('web')) return 'Web';
    if (role?.includes('redes')) return 'Redes';

    return 'Redes';
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

  close() {
    this.closeModal.emit();
  }
}
