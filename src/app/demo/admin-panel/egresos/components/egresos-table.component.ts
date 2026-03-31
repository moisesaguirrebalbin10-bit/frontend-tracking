import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Egreso } from '../egreso.model';

@Component({
  selector: 'app-egresos-table',
  templateUrl: './egresos-table.component.html',
  styleUrls: ['./egresos-table.component.scss'],
  imports: [CommonModule]
})
export class EgresosTableComponent implements OnChanges {
  @Input() egresos: Egreso[] = [];
  @Input() loading = false;
  @Output() edit = new EventEmitter<Egreso>();
  @Output() viewLogs = new EventEmitter<Egreso>();

  readonly pageSize = 50;
  currentPage = 1;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['egresos']) {
      this.currentPage = 1;
    }
  }

  get paginatedEgresos(): Egreso[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.egresos.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.egresos.length / this.pageSize));
  }

  get visibleStart(): number {
    if (this.egresos.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get visibleEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.egresos.length);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
  }

  onEdit(egreso: Egreso) {
    this.edit.emit(egreso);
  }

  onViewLogs(egreso: Egreso) {
    this.viewLogs.emit(egreso);
  }

  trackByEgreso(_: number, egreso: Egreso) {
    return egreso.id;
  }
}
