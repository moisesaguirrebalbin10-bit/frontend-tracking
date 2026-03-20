import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import { OrderTrackingComponent } from 'src/app/demo/dashboard/orders-dashboard/order-tracking.component';
import { Order } from 'src/app/models/order.model';
import { OrderService } from 'src/app/services/order.service';

@Component({
  selector: 'app-sample-page',
  imports: [CommonModule, FormsModule, OrderTrackingComponent],
  templateUrl: './sample-page.component.html',
  styleUrls: ['./sample-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SamplePageComponent {
  bsaleInput = '';
  dniInput = '';
  loading = false;
  searched = false;
  errorMessage = '';
  foundOrder: Order | null = null;
  private readonly itemsCache = new WeakMap<Order, Array<{ name: string; quantity: number; price: number }>>();
  private readonly documentCache = new WeakMap<Order, string>();
  private readonly locationCache = new WeakMap<Order, string>();
  private readonly estimatedCache = new WeakMap<Order, string>();

  constructor(
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    const bsale = this.normalize(this.bsaleInput);
    const dni = this.normalizeDigits(this.dniInput);

    if (!bsale || !dni) {
      this.errorMessage = 'Ingresa Boleta Bsale y DNI para consultar tu pedido.';
      this.foundOrder = null;
      this.searched = true;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.searched = true;
    this.errorMessage = '';
    this.foundOrder = null;
    this.cdr.markForCheck();

    this.orderService.lookupPublicOrder(this.bsaleInput.trim(), this.dniInput.trim()).pipe(
      map((response) => this.mapPublicLookupResponseToOrder(response)),
      catchError(() => of(null))
    ).subscribe({
      next: (order) => {
        this.foundOrder = order;
        if (!order) {
          this.errorMessage = 'No encontramos un pedido con esa Boleta Bsale y DNI. Verifica los datos e intenta nuevamente.';
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'No se pudo consultar el pedido en este momento. Intenta nuevamente.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getOrderStatusLabel(order: Order): string {
    if (order.woo_status_label && this.normalize(order.status) === 'en_proceso') {
      return order.woo_status_label;
    }

    const labels: Record<string, string> = {
      en_proceso: 'En Proceso',
      empaquetado: 'Empaquetado',
      despachado: 'Despachado',
      en_camino: 'En Camino',
      entregado: 'Entregado',
      error: 'Error',
      error_en_pedido: 'Error en Pedido',
      cancelado: 'Cancelado'
    };

    const key = this.normalize(order.status);
    return labels[key] ?? String(order.status || 'Estado desconocido');
  }

  getOrderStatusClass(order: Order): string {
    const key = this.normalize(order.status);
    if (key === 'entregado') return 'bg-success';
    if (key === 'error' || key === 'error_en_pedido') return 'bg-danger';
    if (key === 'cancelado') return 'bg-secondary';
    if (key === 'en_camino') return 'bg-info';
    if (key === 'despachado') return 'bg-primary';
    return 'bg-warning';
  }

  getTimelineStatus(order: Order): string {
    const normalized = this.normalize(order.status);
    const mapping: Record<string, string> = {
      en_proceso: 'EN_PROCESO',
      empaquetado: 'EMPAQUETADO',
      despachado: 'DESPACHADO',
      en_camino: 'EN_CAMINO',
      entregado: 'ENTREGADO',
      error: 'ERROR',
      error_en_pedido: 'ERROR',
      cancelado: 'ERROR'
    };

    return mapping[normalized] ?? 'EN_PROCESO';
  }

  getBsaleSerieDisplay(order: Order | null): string {
    if (!order) return '-';
    const bsale = this.getBsaleBlock(order);
    const serie = String(bsale?.serie || '').trim();
    const numero = String(bsale?.numero || '').trim();

    if (serie) {
      if (numero && !serie.includes(numero)) {
        return `${serie}-${numero}`;
      }
      return serie;
    }

    if (numero) return numero;
    return '-';
  }

  getCustomerDocument(order: Order | null): string {
    if (!order) return 'N/A';
    const cached = this.documentCache.get(order);
    if (cached) return cached;

    const directDocument = String((order.meta as any)?.customer_document || '').trim();
    if (directDocument) {
      this.documentCache.set(order, directDocument);
      return directDocument;
    }

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
        this.documentCache.set(order, direct);
        return direct;
      }
    }
    this.documentCache.set(order, 'N/A');
    return 'N/A';
  }

  getDeliveryLocation(order: Order): string {
    const cached = this.locationCache.get(order);
    if (cached) return cached;

    if (order.delivery_location && order.delivery_location.trim()) return order.delivery_location;
    const meta = order.meta as any;
    if (meta && !Array.isArray(meta)) {
      const mapAddress = this.findMetaValue(meta.meta_data, '_billing_direccion_mapa');
      if (mapAddress) {
        this.locationCache.set(order, mapAddress);
        return mapAddress;
      }
      const shipping = `${meta.shipping?.address_1 || ''} ${meta.shipping?.city || ''}`.trim();
      if (shipping) {
        this.locationCache.set(order, shipping);
        return shipping;
      }
      const billing = `${meta.billing?.address_1 || ''} ${meta.billing?.city || ''}`.trim();
      if (billing) {
        this.locationCache.set(order, billing);
        return billing;
      }
    }
    this.locationCache.set(order, 'N/A');
    return 'N/A';
  }

  getEstimatedDelivery(order: Order): string {
    const cached = this.estimatedCache.get(order);
    if (cached) return cached;

    if (order.estimated_delivery_date) {
      const formatted = this.formatEstimated(order.estimated_delivery_date);
      this.estimatedCache.set(order, formatted);
      return formatted;
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
        const formatted = this.formatEstimated(String(direct));
        this.estimatedCache.set(order, formatted);
        return formatted;
      }

      const f1 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_1');
      const f2 = this.findMetaValue(meta.meta_data, '_billing_fecha_entrega_2');
      if (f1 && f2) {
        const range = `${f1} y ${f2}`;
        this.estimatedCache.set(order, range);
        return range;
      }
      if (f1) {
        const single = String(f1);
        this.estimatedCache.set(order, single);
        return single;
      }
    }
    this.estimatedCache.set(order, 'N/A');
    return 'N/A';
  }

  getOrderItems(order: Order): Array<{ name: string; quantity: number; price: number }> {
    const cached = this.itemsCache.get(order);
    if (cached) return cached;

    if (Array.isArray(order.items) && order.items.length > 0) {
      const items = order.items.map((item) => ({
        name: item.product_name,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      }));
      this.itemsCache.set(order, items);
      return items;
    }

    const meta = order.meta as any;
    const lineItems = meta?.line_items;
    if (Array.isArray(lineItems)) {
      const items = lineItems.map((item: any) => {
        const quantity = Number(item?.quantity) || 0;
        const unitPrice = Number(item?.price);
        const total = Number(item?.total);
        const resolvedPrice = !Number.isNaN(unitPrice) ? unitPrice : (quantity > 0 && !Number.isNaN(total) ? total / quantity : 0);
        return {
          name: item?.name || item?.parent_name || 'Producto',
          quantity,
          price: Number.isNaN(resolvedPrice) ? 0 : resolvedPrice
        };
      });
      this.itemsCache.set(order, items);
      return items;
    }

    this.itemsCache.set(order, []);
    return [];
  }

  private mapPublicLookupResponseToOrder(response: any): Order | null {
    const payload = response?.order ?? response?.data ?? response;
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const customer = payload.cliente ?? payload.customer ?? {};
    const delivery = payload.entrega ?? payload.delivery ?? {};
    const bsale = payload.boleta ?? payload.bsale ?? {};
    const dates = payload.fechas ?? payload.dates ?? {};
    const rawItems = payload.products ?? payload.productos ?? payload.items ?? [];

    const statusValue = String(payload.estado ?? payload.status ?? 'en_proceso');
    const createdAt = String(dates.creacion ?? payload.created_at ?? payload.updated_at ?? new Date().toISOString());
    const updatedAt = String(payload.updated_at ?? createdAt);

    const items = Array.isArray(rawItems)
      ? rawItems.map((item: any, index: number) => {
          const quantity = Number(item?.cantidad ?? item?.quantity ?? 0) || 0;
          const unitPriceRaw = Number(item?.precio_unitario ?? item?.unit_price ?? item?.price);
          const subtotalRaw = Number(item?.subtotal ?? item?.total);
          const unitPrice = !Number.isNaN(unitPriceRaw)
            ? unitPriceRaw
            : (quantity > 0 && !Number.isNaN(subtotalRaw) ? subtotalRaw / quantity : 0);

          return {
            id: Number(item?.id ?? index + 1),
            product_name: String(item?.nombre ?? item?.name ?? item?.product_name ?? 'Producto'),
            quantity,
            price: Number.isNaN(unitPrice) ? 0 : unitPrice
          };
        })
      : [];

    const coordinates = delivery.coordenadas ?? delivery.coordinates;
    const normalizedCoordinates = coordinates && typeof coordinates === 'object'
      ? {
          lat: Number(coordinates.lat ?? coordinates.latitude ?? 0),
          lng: Number(coordinates.lng ?? coordinates.longitude ?? 0)
        }
      : null;

    const metaData = Array.isArray(payload.meta_data)
      ? payload.meta_data
      : (Array.isArray(payload.meta?.meta_data) ? payload.meta.meta_data : []);

    const mapped: Order = {
      id: Number(payload.id ?? payload.order_id ?? payload.internal_order_id ?? 0),
      external_id: String(payload.external_id ?? payload.id_woo ?? bsale.numero ?? bsale.boleta_id ?? payload.id ?? ''),
      status: statusValue as any,
      total: Number(payload.total ?? payload.monto_total ?? payload.amount ?? 0) || 0,
      customer_name: String(customer.name ?? customer.nombre ?? payload.customer_name ?? 'Sin nombre'),
      customer_email: customer.email ?? customer.correo ?? payload.customer_email,
      customer_phone: customer.telefono ?? customer.phone ?? payload.customer_phone,
      delivery_location: delivery.direccion ?? delivery.address ?? payload.delivery_location,
      delivery_coordinates: normalizedCoordinates && !Number.isNaN(normalizedCoordinates.lat) && !Number.isNaN(normalizedCoordinates.lng)
        ? normalizedCoordinates
        : undefined,
      delivery_date: dates.entrega_real ?? delivery.real_delivery_date ?? payload.delivery_date ?? null,
      estimated_delivery_date:
        dates.entrega_estimada ??
        delivery.fecha_estimada ??
        (delivery.estimated_date_from && delivery.estimated_date_to
          ? `${delivery.estimated_date_from} y ${delivery.estimated_date_to}`
          : delivery.estimated_date_from || delivery.estimated_date_to || payload.estimated_delivery_date || null),
      items,
      created_at: createdAt,
      updated_at: updatedAt,
      woo_status_label: payload.woo_status_label ?? payload.status_label ?? payload.estado_label,
      store_slug: payload.origen ?? payload.store_slug,
      bsale: {
        boleta_id: bsale.boleta_id != null ? Number(bsale.boleta_id) : undefined,
        numero: bsale.numero != null ? String(bsale.numero) : undefined,
        serie: bsale.serie != null ? String(bsale.serie) : undefined
      },
      meta: {
        ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
        bsale,
        meta_data: metaData,
        customer_document: customer.dni ?? payload.dni
      }
    };

    return mapped;
  }

  private getBsaleBlock(order: Order): any {
    return order.bsale || (order.meta as any)?.bsale || null;
  }

  private findMetaValue(metaData: any, key: string): string | null {
    if (!Array.isArray(metaData)) return null;
    const entry = metaData.find((m: any) => m?.key === key);
    return entry?.value != null ? String(entry.value) : null;
  }

  private formatEstimated(date: string): string {
    if (!date) return 'N/A';
    if (date.includes(' y ')) return date;
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(parsed);
    }
    return date;
  }

  private normalize(value: unknown): string {
    return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }

  private normalizeDigits(value: unknown): string {
    return String(value || '').replace(/\D/g, '');
  }
}
