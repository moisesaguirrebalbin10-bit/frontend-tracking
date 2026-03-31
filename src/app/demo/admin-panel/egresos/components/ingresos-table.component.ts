import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface IngresoPedido {
  id: number | string;
  boleta: string;
  fecha: string;
  precio: number;
  tienda: string;
  vendedor: string;
}

@Component({
  selector: 'app-ingresos-table',
  templateUrl: './ingresos-table.component.html',
  styleUrls: ['./ingresos-table.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class IngresosTableComponent implements OnChanges {
  @Input() ingresos: IngresoPedido[] = [];
  @Input() loading = false;

  readonly pageSize = 50;
  currentPage = 1;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ingresos']) {
      this.currentPage = 1;
    }
  }

  get paginatedIngresos(): IngresoPedido[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.ingresos.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.ingresos.length / this.pageSize));
  }

  get visibleStart(): number {
    if (this.ingresos.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get visibleEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.ingresos.length);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
  }

  trackByIngreso(_: number, ingreso: IngresoPedido) {
    return ingreso.id;
  }
}
