export interface EgresoLog {
  id: number;
  egreso_id: number;
  usuario: string;
  accion: string; // edit, delete, create
  cambios: Record<string, { anterior: any; nuevo: any }>;
  fecha: string; // ISO string
}
