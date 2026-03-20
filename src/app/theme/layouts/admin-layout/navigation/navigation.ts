import { UserRole } from 'src/app/models/user.model';

export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
  allowedRoles?: UserRole[];
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'default',
        title: 'Métricas de Pedidos',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'dashboard',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'orders',
    title: 'Orders',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'orders-list',
        title: 'Orders List',
        type: 'item',
        classes: 'nav-item',
        url: '/orders',
        icon: 'list',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'administration',
    title: 'Administracion',
    type: 'group',
    icon: 'icon-navigation',
    allowedRoles: [UserRole.ADMIN],
    children: [
      {
        id: 'admin-users',
        title: 'Usuarios',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/users',
        icon: 'team',
        breadcrumbs: false
      },
      {
        id: 'admin-tracking-analytics',
        title: 'Analitica Tracking',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/tracking-analytics',
        icon: 'bar-chart',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'other',
    title: 'Other',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'sample-page',
        title: 'Consultar Pedido',
        type: 'item',
        url: '/consultar-pedido',
        classes: 'nav-item',
        icon: 'search',
        target: true
      },
      {
        id: 'document',
        title: 'Document',
        type: 'item',
        classes: 'nav-item',
        url: 'https://github.com/',
        icon: 'question',
        target: true,
        external: true
      }
    ]
  }
];
