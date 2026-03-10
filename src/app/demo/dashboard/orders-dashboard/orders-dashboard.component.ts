import { Component, OnInit, signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-orders-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <div class="container-fluid">
      <!-- Filters -->
      <div class="row mb-3">
        <div class="col-md-4">
          <div class="btn-group w-100" role="group">
            <button type="button" 
              class="btn" 
              [ngClass]="timeframe() === 'day' ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setTimeframe('day')">Por Día</button>
            <button type="button" 
              class="btn" 
              [ngClass]="timeframe() === 'week' ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setTimeframe('week')">Por Semana</button>
            <button type="button" 
              class="btn" 
              [ngClass]="timeframe() === 'month' ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setTimeframe('month')">Por Mes</button>
          </div>
        </div>
        <div class="col-md-4">
          <div class="btn-group w-100" role="group">
            <button type="button" 
              class="btn" 
              [ngClass]="sourceFilter() === null ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setSourceFilter(null)">Todos</button>
            <button type="button" 
              class="btn" 
              [ngClass]="sourceFilter() === 'web' ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setSourceFilter('web')">Web</button>
            <button type="button" 
              class="btn" 
              [ngClass]="sourceFilter() === 'redes' ? 'btn-primary' : 'btn-outline-primary'"
              (click)="setSourceFilter('redes')">Redes</button>
          </div>
        </div>
      </div>

      <!-- Metrics Cards -->
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <h6 class="text-muted">Total Pedidos</h6>
              <h3>{{ totalOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <h6 class="text-muted">Entregados</h6>
              <h3 class="text-success">{{ deliveredOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <h6 class="text-muted">En Proceso</h6>
              <h3 class="text-warning">{{ inProgressOrders() }}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <h6 class="text-muted">Errores</h6>
              <h3 class="text-danger">{{ errorOrders() }}</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5>Pedidos {{ timeframeLabel() }}</h5>
              <apx-chart 
                *ngIf="chartOptions()"
                [options]="chartOptions()"
                [series]="chartSeries()"
                type="column"
                height="350">
              </apx-chart>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .btn-group-vertical {
      gap: 0.5rem;
    }
    .card {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  `]
})
export class OrdersDashboardComponent implements OnInit {
  timeframe = signal<'day' | 'week' | 'month'>('day');
  sourceFilter = signal<'web' | 'redes' | null>(null);
  
  totalOrders = signal(0);
  deliveredOrders = signal(0);
  inProgressOrders = signal(0);
  errorOrders = signal(0);

  chartOptions = signal<any>(null);
  chartSeries = signal<any[]>([]);

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadDashboard();
  }

  setTimeframe(tf: 'day' | 'week' | 'month') {
    this.timeframe.set(tf);
    this.loadDashboard();
  }

  setSourceFilter(source: 'web' | 'redes' | null) {
    this.sourceFilter.set(source);
    this.loadDashboard();
  }

  timeframeLabel(): string {
    const labels = { day: 'por Día', week: 'por Semana', month: 'por Mes' };
    return labels[this.timeframe()];
  }

  loadDashboard() {
    this.orderService.getOrders(1, 1000).subscribe({
      next: (response) => {
        let orders = response.data;

        // Filter by source derived from user role
        if (this.sourceFilter()) {
          orders = orders.filter(o => {
            const src = this.getOrderSource(o);
            return src === this.sourceFilter();
          });
        }

        // Calculate metrics
        this.totalOrders.set(orders.length);
        this.deliveredOrders.set(orders.filter(o => o.status === OrderStatus.ENTREGADO).length);
        this.inProgressOrders.set(
          orders.filter(o => [OrderStatus.EN_PROCESO, OrderStatus.EMPAQUETADO, OrderStatus.DESPACHADO, OrderStatus.EN_CAMINO].includes(o.status)).length
        );
        this.errorOrders.set(orders.filter(o => o.status === OrderStatus.ERROR).length);

        // Group by timeframe
        const grouped = this.groupByTimeframe(orders);
        this.updateChart(grouped);
      }
    });
  }

  groupByTimeframe(orders: Order[]): { [key: string]: number } {
    const grouped: { [key: string]: number } = {};

    orders.forEach(order => {
      const date = new Date(order.created_at);
      let key = '';

      if (this.timeframe() === 'day') {
        key = date.toLocaleDateString('es-ES');
      } else if (this.timeframe() === 'week') {
        const weekNum = this.getWeekNumber(date);
        key = `Sem ${weekNum}`;
      } else {
        key = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return grouped;
  }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  }

  getOrderSource(order: Order): 'web' | 'redes' | null {
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
    if (!order.user) {
      return 'redes';
    }
    return null;
  }

  updateChart(grouped: { [key: string]: number }) {
    const keys = Object.keys(grouped);
    const values = Object.values(grouped);

    this.chartSeries.set([
      {
        name: 'Pedidos',
        data: values
      }
    ]);

    this.chartOptions.set({
      chart: {
        type: 'column',
        toolbar: { show: false }
      },
      xaxis: {
        categories: keys,
        labels: { style: { fontSize: '12px' } }
      },
      yaxis: {
        title: { text: 'Cantidad de Pedidos' }
      },
      colors: ['#0ea5e9'],
      dataLabels: { enabled: true }
    });
  }
}
