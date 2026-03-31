export interface Egreso {
  id: number;
  nombre: string;
  descripcion: string;
  banco_metodo: string;
  categoria: string;
  precio: number;
  fecha: string; // ISO string
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}
