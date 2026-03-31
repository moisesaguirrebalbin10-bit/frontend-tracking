import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Egreso } from '../egreso.model';

@Component({
  selector: 'app-egreso-form',
  templateUrl: './egreso-form.component.html',
  styleUrls: ['./egreso-form.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class EgresoFormComponent {
  @Input() egreso: Egreso | null = null;
  @Output() save = new EventEmitter<Partial<Egreso>>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  maxDate: string;

  constructor(private fb: FormBuilder) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    this.maxDate = today.toISOString().split('T')[0];
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      banco_metodo: ['', Validators.required],
      categoria: ['', Validators.required],
      precio: [null, [Validators.required, Validators.min(0)]],
      fecha: ['', [Validators.required, this.fechaValidator.bind(this)]]
    });
  }

  ngOnChanges() {
    if (this.egreso) {
      this.form.patchValue(this.egreso);
    }
  }

  fechaValidator(control: any) {
    if (!control.value) return null;
    const inputDate = new Date(control.value);
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    if (inputDate > today || inputDate < weekAgo) {
      return { invalidDate: true };
    }
    return null;
  }

  submit() {
    if (this.form.valid) {
      this.save.emit(this.form.value);
    } else {
      this.form.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
