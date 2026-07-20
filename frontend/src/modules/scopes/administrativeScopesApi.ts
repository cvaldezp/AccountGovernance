import { authFetch } from '../../api/authFetch';
import type {
  AdministrativeScope, AdministrativeScopeFilter,
  CreateScopeForm, UpdateScopeForm, FilterForm,
} from './types';

/** Error enriquecido con el `code` de negocio del backend (VALIDATION,
 * DUPLICATE, DUPLICATE_FILTER, NOT_FOUND…) y el status HTTP real — permite
 * mapear a mensajes específicos en la UI sin parsear texto. */
export class ScopeApiError extends Error {
  code?:   string;
  status:  number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name   = 'ScopeApiError';
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
    throw new ScopeApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function createScopeBody(form: CreateScopeForm) {
  return {
    scopeKey:          form.scopeKey.trim(),
    name:              form.name.trim(),
    description:       form.description.trim() || null,
    category:          form.category.trim() || null,
    baseDn:            form.baseDn.trim(),
    connectionProfile: form.connectionProfile.trim() || 'default',
    priority:          form.priority,
    // Un Scope siempre se crea inactivo — activar es una acción de estado
    // separada (ver setStatus), nunca parte de la creación.
    isActive:          false,
  };
}

function updateScopeBody(form: UpdateScopeForm) {
  return {
    name:              form.name.trim(),
    description:       form.description.trim() || null,
    category:          form.category.trim() || null,
    baseDn:            form.baseDn.trim(),
    connectionProfile: form.connectionProfile.trim() || 'default',
    priority:          form.priority,
  };
}

function filterBody(form: FilterForm) {
  return {
    filterType:    form.filterType.trim(),
    attributeName: form.attributeName.trim(),
    operator:      form.operator,
    // El backend ya normaliza Value=null para Exists, pero lo limpiamos acá
    // también para que el payload enviado sea coherente con lo que se muestra.
    value:         form.operator === 'Exists' ? null : form.value.trim(),
    isActive:      form.isActive,
  };
}

export const administrativeScopesApi = {
  async getAll(): Promise<AdministrativeScope[]> {
    return request('/api/administrative-scopes');
  },

  async getByKey(scopeKey: string): Promise<AdministrativeScope> {
    return request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}`);
  },

  async create(form: CreateScopeForm): Promise<AdministrativeScope> {
    return request('/api/administrative-scopes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(createScopeBody(form)),
    });
  },

  async update(scopeKey: string, form: UpdateScopeForm): Promise<AdministrativeScope> {
    return request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updateScopeBody(form)),
    });
  },

  async setStatus(scopeKey: string, isActive: boolean): Promise<AdministrativeScope> {
    return request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive }),
    });
  },

  async createFilter(scopeKey: string, form: FilterForm): Promise<AdministrativeScopeFilter> {
    return request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}/filters`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(filterBody(form)),
    });
  },

  async updateFilter(scopeKey: string, filterId: number, form: FilterForm): Promise<AdministrativeScopeFilter> {
    return request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}/filters/${filterId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(filterBody(form)),
    });
  },

  async deleteFilter(scopeKey: string, filterId: number): Promise<void> {
    await request(`/api/administrative-scopes/${encodeURIComponent(scopeKey)}/filters/${filterId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Mapea un error a un mensaje seguro para mostrar en pantalla. Los mensajes
 * 400 del backend ya son texto legible pensado para el usuario final (ver
 * AdministrativeScopeService) — se muestran tal cual. Los casos explícitos
 * pedidos (duplicado de filtro, acceso denegado) tienen copy propio; todo lo
 * demás (errores de red, 5xx) usa un mensaje genérico que nunca expone stack
 * traces ni detalles internos del servidor.
 */
export function mapScopeErrorToMessage(err: unknown): string {
  if (err instanceof ScopeApiError) {
    if (err.code === 'DUPLICATE_FILTER') return 'Ya existe un filtro activo con la misma configuración.';
    if (err.status === 403) return 'Acceso denegado. No tienes permiso para realizar esta acción.';
    if (err.status === 401) return 'Tu sesión expiró. Recarga la página e inicia sesión nuevamente.';
    if (err.status === 404) return err.message || 'No se encontró el recurso solicitado.';
    if (err.status >= 400 && err.status < 500) return err.message;
    return 'Ocurrió un error inesperado en el servidor. Intenta nuevamente más tarde.';
  }
  if (err instanceof Error) return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  return 'Ocurrió un error inesperado.';
}
