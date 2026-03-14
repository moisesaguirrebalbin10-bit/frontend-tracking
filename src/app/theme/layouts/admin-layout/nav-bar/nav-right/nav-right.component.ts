// angular import
import { Component, output, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { UserRole } from 'src/app/models/user.model';

// third party

// icon
import { IconService } from '@ant-design/icons-angular';
import {
  BellOutline,
  SettingOutline,
  GiftOutline,
  MessageOutline,
  PhoneOutline,
  CheckCircleOutline,
  LogoutOutline,
  EditOutline,
  UserOutline,
  ProfileOutline,
  WalletOutline,
  QuestionCircleOutline,
  LockOutline,
  CommentOutline,
  UnorderedListOutline,
  ArrowRightOutline,
  GithubOutline
} from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent {
  private iconService = inject(IconService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // public props
  styleSelectorToggle = input<boolean>();
  readonly Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  direction: string = 'ltr';
  currentUser = toSignal(this.authService.currentUser$, { initialValue: this.authService.getCurrentUser() });
  logoutToast = signal<{ type: 'success' | 'danger'; message: string } | null>(null);
  isLoggingOut = false;
  private toastTimeoutId: number | null = null;

  // constructor
  constructor() {
    this.windowWidth = window.innerWidth;
    this.iconService.addIcon(
      ...[
        CheckCircleOutline,
        GiftOutline,
        MessageOutline,
        SettingOutline,
        PhoneOutline,
        LogoutOutline,
        EditOutline,
        UserOutline,
        EditOutline,
        ProfileOutline,
        QuestionCircleOutline,
        LockOutline,
        CommentOutline,
        UnorderedListOutline,
        ArrowRightOutline,
        BellOutline,
        GithubOutline,
        WalletOutline
      ]
    );
  }

  profile = [
    {
      icon: 'logout',
      title: 'Logout'
    }
  ];

  setting = [
    {
      icon: 'unordered-list',
      title: 'History'
    }
  ];

  get displayName(): string {
    const user = this.currentUser();
    if (user?.name?.trim()) {
      return user.name;
    }
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0];
      if (emailPrefix) {
        return emailPrefix
          .split(/[._-]/)
          .filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }
    }
    return 'Admin User';
  }

  get displayRole(): string {
    const role = this.currentUser()?.role;
    const roleMap: Record<string, string> = {
      [UserRole.ADMIN]: 'Admin',
      [UserRole.VENDEDOR_REDES]: 'Vendedor Redes',
      [UserRole.VENTAS_WEB]: 'Ventas Web',
      [UserRole.EMPAQUETADOR]: 'Empaquetador',
      [UserRole.DESPACHADOR]: 'Despachador',
      [UserRole.DELIVERY]: 'Delivery'
    };

    return role ? roleMap[role] || role : 'Admin';
  }

  onProfileAction(action: string): void {
    if (action === 'Logout') {
      this.onLogout();
    }
  }

  onLogout(): void {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;
    this.authService.logout().subscribe({
      next: (response) => {
        this.showToast('success', response.message || 'Sesion cerrada correctamente');
        this.isLoggingOut = false;
        this.redirectToLogin();
      },
      error: () => {
        this.showToast('danger', 'No se pudo cerrar sesion en el servidor. Se cerro la sesion local.');
        this.isLoggingOut = false;
        this.redirectToLogin();
      }
    });
  }

  closeToast(): void {
    this.logoutToast.set(null);
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  private showToast(type: 'success' | 'danger', message: string): void {
    this.logoutToast.set({ type, message });
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }
    this.toastTimeoutId = window.setTimeout(() => {
      this.logoutToast.set(null);
      this.toastTimeoutId = null;
    }, 2500);
  }

  private redirectToLogin(): void {
    window.setTimeout(() => {
      this.router.navigate(['/login']);
    }, 1200);
  }
}
