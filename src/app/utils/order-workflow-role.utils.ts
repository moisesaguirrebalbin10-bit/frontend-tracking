import { DashboardOrderDetail, DashboardOrderRow, DashboardOrderStatusValue } from '../models/dashboard-order.model';
import { OrderStatus } from '../models/order.model';
import { UserRole } from '../models/user.model';

const IN_PROGRESS_STATUSES = new Set<DashboardOrderStatusValue>(['en_proceso', 'empaquetado', 'despachado', 'en_camino']);

export function getDefaultWorkflowStatusForRole(role: UserRole | null | undefined, isAdmin: boolean): DashboardOrderStatusValue | '' {
  if (isAdmin) {
    return '';
  }

  if (role === UserRole.EMPAQUETADOR) {
    return 'en_proceso';
  }

  if (role === UserRole.DESPACHADOR) {
    return 'empaquetado';
  }

  return '';
}

export function getAllowedWorkflowTransitions(
  role: UserRole | null | undefined,
  currentStatus: DashboardOrderStatusValue | string | null | undefined,
  isAdmin: boolean
): OrderStatus[] {
  const normalized = normalizeWorkflowStatus(currentStatus);

  if (isAdmin) {
    return [
      OrderStatus.EN_PROCESO,
      OrderStatus.EMPAQUETADO,
      OrderStatus.DESPACHADO,
      OrderStatus.EN_CAMINO,
      OrderStatus.ENTREGADO
    ].filter((status) => status.toLowerCase() !== normalized);
  }

  if (role === UserRole.EMPAQUETADOR && normalized === 'en_proceso') {
    return [OrderStatus.EMPAQUETADO];
  }

  if (role === UserRole.DESPACHADOR && normalized === 'empaquetado') {
    return [OrderStatus.DESPACHADO];
  }

  if (role === UserRole.DELIVERY && normalized === 'despachado') {
    return [OrderStatus.EN_CAMINO];
  }

  if (role === UserRole.DELIVERY && normalized === 'en_camino') {
    return [OrderStatus.ENTREGADO];
  }

  return [];
}

export function canRoleManageWorkflow(
  role: UserRole | null | undefined,
  currentStatus: DashboardOrderStatusValue | string | null | undefined,
  isAdmin: boolean
): boolean {
  return getAllowedWorkflowTransitions(role, currentStatus, isAdmin).length > 0;
}

export function isOrderVisibleForWorkflowRole(
  row: Pick<DashboardOrderRow, 'status' | 'assigned_delivery_user_id'>,
  role: UserRole | null | undefined,
  currentUserId: number | null | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) {
    return true;
  }

  const status = normalizeWorkflowStatus(row.status?.value);

  if (role === UserRole.EMPAQUETADOR) {
    return status === 'en_proceso';
  }

  if (role === UserRole.DESPACHADOR) {
    return status === 'empaquetado';
  }

  if (role === UserRole.DELIVERY) {
    return !!currentUserId && row.assigned_delivery_user_id === currentUserId && (status === 'despachado' || status === 'en_camino');
  }

  return true;
}

export function requiresDeliveryAssignment(
  nextStatus: OrderStatus | string,
  role: UserRole | null | undefined,
  isAdmin: boolean
): boolean {
  return String(nextStatus).toUpperCase() === OrderStatus.DESPACHADO && (isAdmin || role === UserRole.DESPACHADOR);
}

export function normalizeWorkflowStatus(status: DashboardOrderStatusValue | string | null | undefined): DashboardOrderStatusValue | '' {
  const normalized = String(status || '').trim().toLowerCase();
  if (IN_PROGRESS_STATUSES.has(normalized as DashboardOrderStatusValue) || normalized === 'entregado' || normalized === 'error_en_pedido' || normalized === 'cancelado') {
    return normalized as DashboardOrderStatusValue;
  }
  return '';
}

export function getWorkflowRoleMessage(role: UserRole | null | undefined, isAdmin: boolean): string {
  if (isAdmin) {
    return 'Administrador: puedes ejecutar cualquier transicion del flujo operativo.';
  }

  if (role === UserRole.EMPAQUETADOR) {
    return 'Empaquetador: solo puedes confirmar pedidos En Proceso como Empaquetado o marcar un error con motivo.';
  }

  if (role === UserRole.DESPACHADOR) {
    return 'Despachador: solo puedes confirmar pedidos Empaquetados como Despachados y asignar un delivery, o registrar un error.';
  }

  if (role === UserRole.DELIVERY) {
    return 'Delivery: solo puedes gestionar los pedidos asignados a tu cuenta, marcandolos En Camino o Entregados, o registrar un error.';
  }

  return 'Solo puedes consultar el detalle del pedido.';
}

export function getAssignedDeliveryName(detail: Pick<DashboardOrderDetail, 'assigned_delivery_name' | 'assigned_delivery'>): string {
  return String(detail.assigned_delivery_name || detail.assigned_delivery?.name || '').trim();
}