export interface User {
  id: number;
  name?: string;
  email: string;
  role: UserRole;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export enum UserRole {
  ADMIN = 'admin',
  VENDEDOR_REDES = 'vendedor_redes',
  VENTAS_WEB = 'ventas_web',
  EMPAQUETADOR = 'empaquetador',
  DESPACHADOR = 'despachador',
  DELIVERY = 'delivery'
}