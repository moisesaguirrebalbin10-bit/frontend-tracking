import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tracking-timeline">
      <div class="tracking-step" 
        *ngFor="let step of trackingSteps"
        [ngClass]="{ 'completed': isCompleted(step), 'active': isActive(step), 'error': step === 'ERROR', 'clickable': canEdit, 'disabled': !canEdit }"
        (click)="selectStatus(step)">
        <div class="tracking-circle">
          <i [ngClass]="getIcon(step)"></i>
          <div class="status-actions" *ngIf="selectedEditStatus === step">
            <button type="button" class="btn-action btn-success" (click)="confirmStatus(step, $event)" title="Completado">✓</button>
            <button type="button" class="btn-action btn-danger" (click)="markAsError(step, $event)" title="Error">✕</button>
          </div>
        </div>
        <div class="tracking-label">{{ getLabel(step) }}</div>
      </div>
    </div>

    <!-- Delivered Form Modal -->
    <div class="error-form-overlay" *ngIf="showDeliveryForm" (click)="cancelDelivered()">
      <div class="error-form-content" (click)="$event.stopPropagation()">
        <h6>Confirmar Entrega</h6>
        <p class="text-muted small mb-3">Este cambio actualizara WooCommerce como <strong>Completado</strong>. Puedes adjuntar evidencia (opcional).</p>
        <div class="mb-3">
          <label class="form-label small mb-1">Imagen de evidencia (opcional)</label>
          <input class="form-control form-control-sm" type="file" accept="image/*" (change)="onFileSelected($event)">
          <div class="selected-file" *ngIf="selectedImageName">Archivo: {{ selectedImageName }}</div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-secondary btn-sm" (click)="cancelDelivered()">Cancelar</button>
          <button type="button" class="btn btn-success btn-sm" (click)="submitDelivered()">Confirmar Entrega</button>
        </div>
      </div>
    </div>
    
    <!-- Error Form Modal -->
    <div class="error-form-overlay" *ngIf="showErrorForm" (click)="cancelError()">
      <div class="error-form-content" (click)="$event.stopPropagation()">
        <h6>Registrar Error en: <span class="text-danger">{{ getLabel(selectedEditStatus) }}</span></h6>
        <p class="text-muted small mb-3">¿Cuál es el motivo del error?</p>
        <textarea 
          class="form-control form-control-sm mb-3"
          placeholder="Describa el motivo del error aquí..."
          [(ngModel)]="formErrorReason"
          rows="4"></textarea>
        <div class="mb-3">
          <label class="form-label small mb-1">Imagen de evidencia (opcional)</label>
          <input class="form-control form-control-sm" type="file" accept="image/*" (change)="onFileSelected($event)">
          <div class="selected-file" *ngIf="selectedImageName">Archivo: {{ selectedImageName }}</div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-secondary btn-sm" (click)="cancelError()">Cancelar</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="submitError()" [disabled]="!formErrorReason.trim()">Registrar Error</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tracking-timeline {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      padding: 20px 0;
      flex-wrap: wrap;
    }

    .tracking-step {
      flex: 1;
      min-width: 100px;
      text-align: center;
      position: relative;
    }

    .tracking-step.clickable {
      cursor: pointer;
    }

    .tracking-step.disabled {
      cursor: not-allowed;
      opacity: 0.75;
    }

    .tracking-step:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 20px;
      left: 50%;
      width: 100%;
      height: 2px;
      background: #e5e7eb;
      z-index: 0;
    }

    .tracking-step.completed:not(:last-child)::after {
      background: #10b981;
    }

    .tracking-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #f3f4f6;
      border: 2px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 8px;
      z-index: 1;
      position: relative;
      font-size: 18px;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    .tracking-step:hover .tracking-circle {
      transform: scale(1.1);
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    }

    .tracking-step.completed .tracking-circle {
      background: #10b981;
      border-color: #10b981;
      color: white;
    }

    .tracking-step.active .tracking-circle {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: white;
      box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.2);
    }

    .tracking-step.error .tracking-circle {
      background: #ef4444;
      border-color: #ef4444;
      color: white;
    }

    .status-actions {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 5px;
      background: white;
      border-radius: 4px;
      padding: 5px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 10;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .btn-action {
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-action:hover {
      opacity: 0.8;
    }

    .btn-success {
      background: #10b981;
    }

    .btn-danger {
      background: #ef4444;
    }

    .btn-secondary {
      background: #6b7280;
    }

    .tracking-label {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      word-break: break-word;
    }

    .tracking-step.completed .tracking-label {
      color: #10b981;
    }

    .tracking-step.active .tracking-label {
      color: #0ea5e9;
      font-weight: 600;
    }

    .error-form-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .error-form-content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      min-width: 350px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 90vw;
    }

    .error-form-content h6 {
      margin-bottom: 10px;
      color: #1f2937;
    }

    .selected-file {
      margin-top: 6px;
      font-size: 12px;
      color: #6b7280;
    }

    textarea.form-control {
      resize: vertical;
      font-family: inherit;
    }
  `]
})
export class OrderTrackingComponent {
  @Input() currentStatus!: string;
  @Input() errorReason?: string;
  @Input() canEdit = true;
  @Output() statusSelected = new EventEmitter<{ status: string; confirmed: boolean; errorReason?: string; evidenceImage?: File }>();

  trackingSteps: string[] = [
    'EN_PROCESO',
    'EMPAQUETADO',
    'DESPACHADO',
    'EN_CAMINO',
    'ENTREGADO'
  ];

  selectedEditStatus: string | null = null;
  showErrorForm = false;
  showDeliveryForm = false;
  selectedImageFile: File | null = null;
  selectedImageName = '';
  formErrorReason = '';

  selectStatus(step: string) {
    if (!this.canEdit) return;
    this.selectedEditStatus = this.selectedEditStatus === step ? null : step;
  }

  confirmStatus(status: string, event: Event) {
    event.stopPropagation();

    if (status === 'ENTREGADO') {
      this.showDeliveryForm = true;
      this.selectedImageFile = null;
      this.selectedImageName = '';
      return;
    }

    this.statusSelected.emit({ status, confirmed: true });
    this.selectedEditStatus = null;
  }

  markAsError(status: string, event: Event) {
    event.stopPropagation();
    this.showErrorForm = true;
    this.selectedEditStatus = status;
    this.selectedImageFile = null;
    this.selectedImageName = '';
    this.formErrorReason = '';
  }

  submitError() {
    if (!this.formErrorReason.trim()) return;

    this.statusSelected.emit({ 
      status: 'ERROR', 
      confirmed: true, 
      errorReason: this.formErrorReason,
      evidenceImage: this.selectedImageFile || undefined
    });
    this.showErrorForm = false;
    this.selectedEditStatus = null;
    this.selectedImageFile = null;
    this.selectedImageName = '';
    this.formErrorReason = '';
  }

  cancelError() {
    this.showErrorForm = false;
    this.selectedEditStatus = null;
    this.selectedImageFile = null;
    this.selectedImageName = '';
    this.formErrorReason = '';
  }

  submitDelivered() {
    this.statusSelected.emit({
      status: 'ENTREGADO',
      confirmed: true,
      evidenceImage: this.selectedImageFile || undefined
    });

    this.showDeliveryForm = false;
    this.selectedEditStatus = null;
    this.selectedImageFile = null;
    this.selectedImageName = '';
  }

  cancelDelivered() {
    this.showDeliveryForm = false;
    this.selectedEditStatus = null;
    this.selectedImageFile = null;
    this.selectedImageName = '';
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] || null;
    this.selectedImageFile = file;
    this.selectedImageName = file?.name || '';
  }

  isCompleted(step: string): boolean {
    const order = [
      'EN_PROCESO',
      'EMPAQUETADO',
      'DESPACHADO',
      'EN_CAMINO',
      'ENTREGADO'
    ];

    const current = order.indexOf(this.currentStatus?.toUpperCase() || '');
    const target = order.indexOf(step);

    return target < current;
  }

  isActive(step: string): boolean {
    return step === (this.currentStatus?.toUpperCase() || '');
  }

  getLabel(step: string): string {
    const labels: { [key: string]: string } = {
      'EN_PROCESO': 'En Proceso',
      'EMPAQUETADO': 'Empaquetado',
      'DESPACHADO': 'Despachado',
      'EN_CAMINO': 'En Camino',
      'ENTREGADO': 'Entregado',
      'ERROR': 'Error',
      'CANCELADO': 'Cancelado'
    };
    return labels[step];
  }

  getIcon(step: string): string {
    const icons: { [key: string]: string } = {
      'EN_PROCESO': 'flaticon-bag',
      'EMPAQUETADO': 'flaticon-box',
      'DESPACHADO': 'flaticon-send',
      'EN_CAMINO': 'flaticon-car',
      'ENTREGADO': 'flaticon-check',
      'ERROR': 'flaticon-close',
      'CANCELADO': 'flaticon-x'
    };
    return icons[step];
  }
}

