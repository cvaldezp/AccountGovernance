import { authFetch } from '../../api/authFetch';
import type { RoleScopeAssignment, CreateAssignmentForm } from './types';

/** Error enriquecido con el `code` de negocio del backend (DUPLICATE_ASSIGNMENT,
 * ASSIGNMENT_EXISTS_INACTIVE, ROLE_INACTIVE, SCOPE_INACTIVE…) y el status HTTP
 * real — permite mapear a mensajes específicos en la UI sin parsear texto. */
export class RoleScopeAssignmentApiError extends Error {
  code?:   string;
  status:  number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name   = 'RoleScopeAssignmentApiError';
    this.status = status;
    this.code   = code;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, options);

  if (!res.ok) {
    let message = `Error HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json() as { error?: string; code?: string };
      if (body.error) message = body.error;
      code = body.code;
    } catch {
      // Respuesta sin cuerpo JSON (ej. caída de red antes de llegar al backend) —
      // se usa el mensaje genérico, nunca se expone detalle interno.
    }
    throw new RoleScopeAssignmentApiError(message, res.status, code);
  }

  return res.json() as Promise<T>;
}

export const roleScopeAssignmentsApi = {
  async getAll(filters?: { roleKey?: string; scopeKey?: string }): Promise<RoleScopeAssignment[]> {
    const params = new URLSearchParams();
    if (filters?.roleKey)  params.set('roleKey', filters.roleKey);
    if (filters?.scopeKey) params.set('scopeKey', filters.scopeKey);
    const qs = params.toString();
    return request(`/api/role-scope-assignments${qs ? `?${qs}` : ''}`);
  },

  async create(form: CreateAssignmentForm): Promise<RoleScopeAssignment> {
    return request('/api/role-scope-assignments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
  },

  async setStatus(id: number, isActive: boolean): Promise<RoleScopeAssignment> {
    return request(`/api/role-scope-assignments/${id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive }),
    });
  },
};

/**
 * Mapea un error a un mensaje seguro para mostrar en pantalla. Los mensajes
 * 400 del backend ya son texto legible pensado para el usuario final (ver
 * RoleScopeAssignmentService) — se muestran tal cual salvo los dos códigos de
 * negocio explícitos (duplicado activo / inactivo) que tienen copy propio
 * para guiar la acción correcta (reactivar en vez de crear).
 */
export function mapAssignmentErrorToMessage(err: unknown): string {
  if (err instanceof RoleScopeAssignmentApiError) {
    if (err.code === 'DUPLICATE_ASSIGNMENT') return 'Este rol ya tiene asignado este ámbito.';
    if (err.code === 'ASSIGNMENT_EXISTS_INACTIVE') return 'Ya existe una asignación inactiva entre este rol y este ámbito — reactívala en vez de crear una nueva.';
    if (err.status === 403) return 'Acceso denegado. No tienes permiso para realizar esta acción.';
    if (err.status === 401) return 'Tu sesión expiró. Recarga la página e inicia sesión nuevamente.';
    if (err.status === 404) return err.message || 'No se encontró el recurso solicitado.';
    if (err.status >= 400 && err.status < 500) return err.message;
    return 'Ocurrió un error inesperado en el servidor. Intenta nuevamente más tarde.';
  }
  if (err instanceof Error) return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  return 'Ocurrió un error inesperado.';
}
