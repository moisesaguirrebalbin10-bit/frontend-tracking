import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { UserRole } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid">
      <div class="row g-3">
        <div class="col-12">
          <div class="card">
            <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h5 class="mb-1">Administracion de Usuarios</h5>
                <p class="text-muted mb-0">Solo administradores pueden registrar usuarios.</p>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <span class="badge text-bg-primary">Total: {{ totalUsers() }}</span>
                <span class="badge text-bg-success">Activos ahora: {{ activeUsers() }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-4">
          <div class="card h-100">
            <div class="card-header">
              <h6 class="mb-0">Registrar Usuario</h6>
            </div>
            <div class="card-body">
              <form [formGroup]="registerForm" (ngSubmit)="registerUser()" class="d-grid gap-3">
                <div>
                  <label class="form-label" for="name">Nombre</label>
                  <input id="name" class="form-control" type="text" formControlName="name" placeholder="Nombre completo" />
                </div>

                <div>
                  <label class="form-label" for="email">Correo</label>
                  <input id="email" class="form-control" type="email" formControlName="email" placeholder="usuario@empresa.com" />
                </div>

                <div>
                  <label class="form-label" for="password">Contrasena</label>
                  <input id="password" class="form-control" type="password" formControlName="password" placeholder="Minimo 8 caracteres" />
                </div>

                <div>
                  <label class="form-label" for="role">Rol</label>
                  <select id="role" class="form-select" formControlName="role">
                    <option *ngFor="let role of roleOptions" [value]="role.value">{{ role.label }}</option>
                  </select>
                </div>

                <div *ngIf="formError()" class="alert alert-danger py-2 mb-0">{{ formError() }}</div>
                <div *ngIf="formSuccess()" class="alert alert-success py-2 mb-0">{{ formSuccess() }}</div>

                <button class="btn btn-primary" type="submit" [disabled]="isSaving() || registerForm.invalid">
                  {{ isSaving() ? 'Guardando...' : 'Crear usuario' }}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-8">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h6 class="mb-0">Usuarios Registrados</h6>
              <div class="d-flex gap-2">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  [value]="searchTerm()"
                  (input)="onSearchInput($event)"
                  placeholder="Buscar por nombre o email"
                />
                <button class="btn btn-sm btn-outline-primary" (click)="loadUsers()" [disabled]="isLoading()">Actualizar</button>
              </div>
            </div>
            <div class="card-body">
              <div *ngIf="tableError()" class="alert alert-danger">{{ tableError() }}</div>

              <div *ngIf="isLoading()" class="text-center py-4">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>

              <div class="table-responsive" *ngIf="!isLoading()">
                <table class="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Ultima actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let user of users()">
                      <td>{{ user.id }}</td>
                      <td>{{ user.name || '-' }}</td>
                      <td>{{ user.email }}</td>
                      <td><span class="badge text-bg-light text-uppercase">{{ user.role }}</span></td>
                      <td>
                        <span class="badge" [ngClass]="user.is_active ? 'text-bg-success' : 'text-bg-secondary'">
                          {{ user.is_active ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td>{{ user.last_seen_at ? (user.last_seen_at | date:'short') : '-' }}</td>
                    </tr>
                    <tr *ngIf="users().length === 0">
                      <td colspan="6" class="text-center text-muted py-4">No hay usuarios para mostrar</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="d-flex justify-content-between align-items-center mt-3" *ngIf="lastPage() > 1">
                <button class="btn btn-sm btn-outline-secondary" (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1 || isLoading()">
                  Anterior
                </button>
                <span class="small text-muted">Pagina {{ currentPage() }} de {{ lastPage() }}</span>
                <button class="btn btn-sm btn-outline-secondary" (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === lastPage() || isLoading()">
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UsersAdminComponent implements OnInit, OnDestroy {
  users = signal<Array<{ id: number; name?: string; email: string; role: string; is_active?: boolean; last_seen_at?: string | null }>>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  tableError = signal<string | null>(null);
  formError = signal<string | null>(null);
  formSuccess = signal<string | null>(null);
  activeUsers = signal(0);
  totalUsers = signal(0);
  currentPage = signal(1);
  lastPage = signal(1);
  searchTerm = signal('');

  roleOptions = [
    { value: UserRole.ADMIN, label: 'Administrador' },
    { value: UserRole.VENDEDOR_REDES, label: 'Vendedor Redes' },
    { value: UserRole.VENTAS_WEB, label: 'Ventas Web' },
    { value: UserRole.EMPAQUETADOR, label: 'Empaquetador' },
    { value: UserRole.DESPACHADOR, label: 'Despachador' },
    { value: UserRole.DELIVERY, label: 'Delivery' }
  ];

  registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: [UserRole.VENDEDOR_REDES, Validators.required]
  });

  private heartbeatSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadUsers();

    this.heartbeatSub = interval(25000).subscribe(() => {
      this.userService.heartbeat().subscribe({
        next: () => this.loadUsers(false),
        error: () => this.loadUsers(false)
      });
    });
  }

  ngOnDestroy(): void {
    this.heartbeatSub?.unsubscribe();
  }

  loadUsers(showLoader = true): void {
    if (showLoader) {
      this.isLoading.set(true);
    }
    this.tableError.set(null);

    this.userService.getUsers({ page: this.currentPage(), search: this.searchTerm() }).subscribe({
      next: (response) => {
        this.users.set(response.data || []);
        this.activeUsers.set(response.active_users ?? response.data.filter((u) => u.is_active).length);
        this.totalUsers.set(response.total_users ?? response.total ?? response.data.length);
        this.lastPage.set(response.last_page || 1);
        this.isLoading.set(false);
      },
      error: () => {
        this.tableError.set('No se pudo cargar la lista de usuarios.');
        this.isLoading.set(false);
      }
    });
  }

  registerUser(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { name, email, password, role } = this.registerForm.getRawValue();
    if (!name || !email || !password || !role) {
      return;
    }

    this.isSaving.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);

    this.userService.createUser(name, email, password, role).subscribe({
      next: () => {
        this.formSuccess.set('Usuario creado correctamente.');
        this.registerForm.reset({ role: UserRole.VENDEDOR_REDES, name: '', email: '', password: '' });
        this.isSaving.set(false);
        this.currentPage.set(1);
        this.loadUsers(false);
      },
      error: () => {
        this.formError.set('No se pudo crear el usuario. Verifica los datos e intenta nuevamente.');
        this.isSaving.set(false);
      }
    });
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.loadUsers();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.onSearch(input?.value ?? '');
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) {
      return;
    }

    this.currentPage.set(page);
    this.loadUsers();
  }
}
