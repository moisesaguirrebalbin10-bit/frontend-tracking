export interface User {
  id: number;
  name?: string;
  email: string;
  role: UserRole;
  is_admin: boolean;
  is_active?: boolean;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsersListResponse {
  data: User[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  active_users?: number;
  total_users?: number;
}

export enum UserRole {
  ADMIN = 'admin',
  VENDEDOR_REDES = 'vendedor_redes',
  VENTAS_WEB = 'ventas_web',
  EMPAQUETADOR = 'empaquetador',
  DESPACHADOR = 'despachador',
  DELIVERY = 'delivery'
}