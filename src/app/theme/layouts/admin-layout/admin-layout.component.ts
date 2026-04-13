// Angular import
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Project import
import { SharedModule } from '../../shared/shared.module';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { OrderNotificationsService } from 'src/app/services/order-notifications.service';
import { IconService } from '@ant-design/icons-angular';
import { CheckCircleOutline, ExclamationCircleOutline, InboxOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, SharedModule, NavigationComponent, NavBarComponent, RouterModule, BreadcrumbComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayout {
  private layoutState = inject(LayoutStateService);
  private iconService = inject(IconService);
  protected readonly notificationsService = inject(OrderNotificationsService);

  // public props
  navCollapsed: boolean;
  windowWidth: number;

  // Constructor
  constructor() {
    this.iconService.addIcon(InboxOutline, CheckCircleOutline, ExclamationCircleOutline);
    this.notificationsService.start();
    this.windowWidth = window.innerWidth;
  }

  adminToastIconType(tone: 'success' | 'danger'): string {
    return tone === 'danger' ? 'exclamation-circle' : 'check-circle';
  }

  get navCollapsedMob(): boolean {
    return this.layoutState.navCollapsedMob();
  }

  // public method
  navMobClick() {
    this.layoutState.toggleNavCollapsedMob();
    if (document.querySelector('app-navigation.pc-sidebar')?.classList.contains('navbar-collapsed')) {
      document.querySelector('app-navigation.pc-sidebar')?.classList.remove('navbar-collapsed');
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.layoutState.closeNavCollapsedMob();
  }
}
