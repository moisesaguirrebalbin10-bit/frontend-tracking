import { Component, EventEmitter, Input, Output } from '@angular/core';
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
export class IngresosTableComponent {
  @Input() ingresos: IngresoPedido[] = [];
  @Input() loading = false;
  @Input() currentPage = 1;
  @Input() pageSize = 20;
  @Input() totalItems = 0;
  @Output() pageChange = new EventEmitter<number>();

  get visibleIngresos(): IngresoPedido[] {
    return this.ingresos;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get visibleStart(): number {
    if (this.totalItems === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get visibleEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.pageChange.emit(page);
  }

  trackByIngreso(_: number, ingreso: IngresoPedido) {
    return ingreso.id;
  }
}
