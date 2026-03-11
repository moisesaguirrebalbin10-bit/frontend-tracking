/**
 * Configuración de tiendas WooCommerce
 * 
 * Este archivo centraliza la configuración de las 5 tiendas WooCommerce
 * Para facilitar la gestión de múltiples fuentes de datos
 */

export interface WooCommerceStore {
  id: string;
  name: string;
  baseUrl: string;
  color: string; // Color para identificar visualmente la tienda
  icon?: string;
  enabled: boolean;
}

export const WOOCOMMERCE_STORES: WooCommerceStore[] = [
  {
    id: 'tienda-1',
    name: 'Tienda Principal',
    baseUrl: 'https://example1.com',
    color: '#FF6B6B',
    icon: 'shopping-bag',
    enabled: true
  },
  {
    id: 'tienda-2',
    name: 'Tienda 2',
    baseUrl: 'https://example2.com',
    color: '#4ECDC4',
    icon: 'shopping-bag',
    enabled: true
  },
  {
    id: 'tienda-3',
    name: 'Tienda 3',
    baseUrl: 'https://example3.com',
    color: '#45B7D1',
    icon: 'shopping-bag',
    enabled: true
  },
  {
    id: 'tienda-4',
    name: 'Tienda 4',
    baseUrl: 'https://example4.com',
    color: '#96CEB4',
    icon: 'shopping-bag',
    enabled: true
  },
  {
    id: 'tienda-5',
    name: 'Tienda 5',
    baseUrl: 'https://example5.com',
    color: '#FFEAA7',
    icon: 'shopping-bag',
    enabled: true
  }
];

/**
 * Obtén una tienda por ID
 */
export function getStoreById(id: string): WooCommerceStore | undefined {
  return WOOCOMMERCE_STORES.find(store => store.id === id);
}

/**
 * Obtén todas las tiendas habilitadas
 */
export function getEnabledStores(): WooCommerceStore[] {
  return WOOCOMMERCE_STORES.filter(store => store.enabled);
}

/**
 * Obtén el nombre de la tienda por ID
 */
export function getStoreName(id: string): string {
  return getStoreById(id)?.name || 'Desconocida';
}

/**
 * Obtén el color de la tienda por ID
 */
export function getStoreColor(id: string): string {
  return getStoreById(id)?.color || '#999999';
}
