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
            <h5 class="modal-title">
            <span *ngIf="isBsaleOrder(order)" class="badge bg-info me-2" style="font-size:0.75rem">BSALE</span>
            Detalles del Pedido #{{ order?.external_id || order?.id }}
            </h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          <div class="modal-body" *ngIf="order">
          <!-- BSALE-->
          <ng-container *ngIf="isBsaleOrder(order); else internalSection">
 
              <!-- Aviso solo lectura -->
              <div class="alert alert-info py-2 px-3 small mb-3">
                <i class="ti ti-info-circle me-1"></i>
                Este pedido proviene de <strong>Bsale</strong> y es de solo lectura. El cambio de estado estará disponible próximamente.
              </div>
 
              <!-- Atributos Bsale destacados -->
              <div class="row mb-3 g-2">
                <div class="col-md-4">
                  <div class="card border-0 bsale-highlight-card h-100">
                    <div class="card-body py-2 px-3">
                      <p class="text-muted small mb-1">Fecha de Despacho</p>
                      <strong>{{ order.bsale_fecha_despacho || 'N/A' }}</strong>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-0 bsale-highlight-card h-100">
                    <div class="card-body py-2 px-3">
                      <p class="text-muted small mb-1">Marca / Red Social</p>
                      <strong>{{ order.bsale_marca_red_social || 'N/A' }}</strong>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-0 bsale-highlight-card h-100">
                    <div class="card-body py-2 px-3">
                      <p class="text-muted small mb-1">Estado del Pedido</p>
                      <span class="badge bg-warning text-dark">{{ order.bsale_estado_pedido || 'N/A' }}</span>
                    </div>
                  </div>
                </div>
              </div>
 
              <hr>
 
              <!-- Cliente + Vendedor -->
              <div class="row mb-4">
                <div class="col-md-6">
                  <h6 class="text-muted">Información del Cliente</h6>
                  <p><strong>Nombre:</strong> {{ order.customer_name || 'N/A' }}</p>
                  <p><strong>DNI/RUC:</strong> {{ getBsaleDni(order) }}</p>
                  <p><strong>Email:</strong> {{ order.customer_email || 'No registrado' }}</p>
                  <p><strong>Teléfono:</strong> {{ order.customer_phone || 'N/A' }}</p>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted">Información del Vendedor</h6>
                  <p><strong>Vendedor:</strong> {{ order.bsale_vendedor || 'N/A' }}</p>
                  <p><strong>Fecha Emisión:</strong> {{ order.created_at | date: 'dd/MM/yyyy' }}</p>
                  <p><strong>Boleta:</strong> {{ order.bsale_boleta || order.external_id }}</p>
                </div>
              </div>
 
              <hr>
 
              <!-- Pago -->
              <div class="mb-4">
                <h6 class="text-muted">Información de Pago</h6>
                <div class="row">
                  <div class="col-md-6">
                    <p><strong>Métodos:</strong> {{ order.bsale_pago_metodos || 'N/A' }}</p>
                  </div>
                  <div class="col-md-6 text-md-end">
                    <h5 class="text-primary"><strong>Total: {{ order.bsale_pago_monto || ('S/ ' + order.total) }}</strong></h5>
                  </div>
                </div>
              </div>
 
              <hr>
 
              <!-- Prendas / Productos -->
              <div class="mb-4">
                <h6 class="text-muted">Prendas</h6>
                <div class="table-responsive">
                  <table class="table table-sm">
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
                      <tr *ngFor="let prenda of getBsalePrendas(order)">
                        <td>{{ prenda.nombre }}</td>
                        <td><code>{{ prenda.sku }}</code></td>
                        <td>{{ prenda.cantidad }}</td>
                        <td>S/ {{ prenda.precioUnitario | number: '1.2-2' }}</td>
                        <td class="text-danger">
                          <span *ngIf="prenda.descuentoAplicado > 0">-S/ {{ prenda.descuentoAplicado | number: '1.2-2' }}</span>
                          <span *ngIf="prenda.descuentoAplicado === 0">—</span>
                        </td>
                        <td><strong>S/ {{ prenda.totalAPagar | number: '1.2-2' }}</strong></td>
                      </tr>
                      <tr *ngIf="getBsalePrendas(order).length === 0">
                        <td colspan="6" class="text-muted text-center">No hay prendas registradas.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
 
            </ng-container>
          <!-- FIN BSALE -->
           <ng-template #internalSection>
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
                <p><strong>DNI:</strong> {{ getCustomerDocument(order) }}</p>
                <p><strong>Email:</strong> {{ getCustomerEmail(order) }}</p>
                <p><strong>Teléfono:</strong> {{ getCustomerPhone(order) }}</p>
              </div>
              <div class="col-md-6">
                <h6 class="text-muted">Información de Entrega</h6>
                <p><strong>Ubicación:</strong> {{ getDeliveryLocation(order) }}</p>
                <p><strong>Coordenadas:</strong> 
                  <span *ngIf="getDeliveryCoordinates(order) as coords">
                    {{ coords.lat }}, {{ coords.lng }}
                  </span>
                  <span *ngIf="!getDeliveryCoordinates(order)">N/A</span>
                </p>
                <p><strong>Fecha Estimada de Entrega:</strong> {{ getEstimatedDelivery(order) }}</p>
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
                    <tr *ngFor="let item of getOrderItems(order)">
                      <td>{{ item.product_name }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>\${{ item.price | number: '1.2-2' }}</td>
                      <td>\${{ (item.price * item.quantity) | number: '1.2-2' }}</td>
                    </tr>
                    <tr *ngIf="getOrderItems(order).length === 0">
                      <td colspan="4" class="text-muted">No hay productos disponibles para este pedido.</td>
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
                        </ng-template>
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

    .bsale-highlight-card {
      background-color: #f6f8fb;
      border: 1px solid #e9edf3 !important;
    }

    :host-context(body.dark-mode) .bsale-highlight-card {
      background-color: #23272f;
      border-color: #343b46 !important;
      color: #e5e7eb;
    }

    :host-context(body.dark-mode) .bsale-highlight-card .text-muted {
      color: #aeb8c6 !important;
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

  //==============INICIO BSALE ====================
  isBsaleOrder(order: Order | null): boolean {
    return order?.source === 'bsale';
  }
 
  getBsaleDni(order: Order): string {
    const raw = order.bsale_raw ?? order.meta;
    return raw?.cliente?.dni_ruc || 'N/A';
  }
 
  getBsalePrendas(order: Order): any[] {
    const raw = order.bsale_raw ?? order.meta;
    return raw?.prendas || [];
  }
  //===============FIN BSALE =====================
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

  getCustomerEmail(order: Order): string {
    return order.customer_email || (order.meta as any)?.billing?.email || 'N/A';
  }

  getCustomerPhone(order: Order): string {
    return order.customer_phone || (order.meta as any)?.billing?.phone || 'N/A';
  }

  getCustomerDocument(order: Order): string {
    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const direct =
        this.findMetaValue(meta.meta_data, 'dni_ce') ||
        this.findMetaValue(meta.meta_data, '_billing_dni_ce') ||
        this.findMetaValue(meta.meta_data, 'billing_documento') ||
        this.findMetaValue(meta.meta_data, '_billing_documento') ||
        this.findMetaValue(meta.meta_data, 'document_number') ||
        this.findMetaValue(meta.meta_data, 'dni');

      if (direct) {
        return direct;
      }
    }

    return 'N/A';
  }

  getDeliveryLocation(order: Order): string {
    if (order.delivery_location && order.delivery_location.trim()) {
      return order.delivery_location;
    }

    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const mapAddress = this.findMetaValue(meta.meta_data, '_billing_direccion_mapa');
      if (mapAddress) return mapAddress;

      const shippingAddress = `${meta.shipping?.address_1 || ''} ${meta.shipping?.city || ''}`.trim();
      if (shippingAddress) return shippingAddress;

      const billingAddress = `${meta.billing?.address_1 || ''} ${meta.billing?.city || ''}`.trim();
      if (billingAddress) return billingAddress;
    }

    return 'N/A';
  }

  getDeliveryCoordinates(order: Order): { lat: number; lng: number } | null {
    if (order.delivery_coordinates) {
      return order.delivery_coordinates;
    }

    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const latRaw = this.findMetaValue(meta.meta_data, '_billing_cordenada_latitud') || this.findMetaValue(meta.meta_data, '_shipping_latitude');
      const lngRaw = this.findMetaValue(meta.meta_data, '_billing_cordenada_longitud') || this.findMetaValue(meta.meta_data, '_shipping_longitude');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }

  getEstimatedDelivery(order: Order): string {
    if (order.estimated_delivery_date) {
      return this.formatEstimated(order.estimated_delivery_date);
    }

    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const direct =
        this.findMetaValue(meta.meta_data, '_delivery_date') ||
        this.findMetaValue(meta.meta_data, 'delivery_date') ||
        this.findMetaValue(meta.meta_data, 'estimated_delivery_date') ||
        this.findMetaValue(meta.meta_data, '_estimated_delivery_date') ||
        this.findMetaValue(meta.meta_data, '_billing_fecha_entrega');

      if (direct) {
        return this.formatEstimated(String(direct));
      }

      const f1 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_1');
      const f2 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_2');
      if (f1 && f2) return `${f1} y ${f2}`;
      if (f1) return String(f1);
    }

    return 'N/A';
  }

  getOrderItems(order: Order): Array<{ product_name: string; quantity: number; price: number }> {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      }));
    }

    const meta = order.meta as any;
    const lineItems = meta?.line_items;
    if (Array.isArray(lineItems)) {
      return lineItems.map((item: any) => {
        const quantity = Number(item?.quantity) || 0;
        const total = Number(item?.total);
        const unitFromPrice = Number(item?.price);
        const unitPrice = !Number.isNaN(unitFromPrice)
          ? unitFromPrice
          : (quantity > 0 && !Number.isNaN(total) ? total / quantity : 0);

        return {
          product_name: item?.name || item?.parent_name || 'Producto',
          quantity,
          price: Number.isNaN(unitPrice) ? 0 : unitPrice
        };
      });
    }

    return [];
  }

  private findMetaValue(metaData: any, key: string): string | null {
    if (!Array.isArray(metaData)) {
      return null;
    }
    const entry = metaData.find((m: any) => m?.key === key);
    return entry?.value != null ? String(entry.value) : null;
  }



  close() {
    this.closeModal.emit();
  }
}
