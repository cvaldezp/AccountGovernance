import { apiFetch } from './apiFetch';
import { buildFieldConfigForRoles } from './adFieldMatrix';
import type { FieldConfig, FieldType, RoleName } from '../types';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

// Mock data must never be a silent fallback for a broken/unreachable API — it only
// activates when explicitly opted into via this flag (same convention as
// attributeCatalogApi/auditApi/UserSearchAgent).
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

// Shape of GET /api/permissions/fields/me (FieldConfigDto, camelCase). No IsActive
// (the endpoint only ever returns active fields) and FieldType is PascalCase
// ("Text"/"Email"/...) — both adapted below to match the frontend FieldConfig shape.
interface ApiFieldConfig {
  fieldKey:        string;
  adAttributeName: string;
  displayName:     string;
  description:     string;
  fieldType:       string;
  isSensitive:     boolean;
  canView:         boolean;
  canEdit:         boolean;
  sortOrder:       number;
  allowedValues:   string[] | null;
  placeholder:     string | null;
}

function toFieldConfig(api: ApiFieldConfig): FieldConfig {
  return {
    fieldKey:        api.fieldKey,
    adAttributeName: api.adAttributeName,
    displayName:     api.displayName,
    description:     api.description,
    fieldType:       api.fieldType.toLowerCase() as FieldType,
    isSensitive:     api.isSensitive,
    canView:         api.canView,
    canEdit:         api.canEdit,
    isActive:        true, // el endpoint solo devuelve campos activos
    sortOrder:       api.sortOrder,
    allowedValues:   api.allowedValues ?? undefined,
    placeholder:     api.placeholder ?? undefined,
  };
}

/**
 * Campos visibles/editables para el rol real del usuario autenticado — resuelto
 * server-side (gov.SystemRoles + membresía AD), nunca por el `role` que se le pase
 * a esta función. Ese parámetro solo se usa para el fallback mock (VITE_USE_MOCK_DATA),
 * nunca se envía a la API.
 */
export async function fetchMyFields(mockRole: RoleName): Promise<FieldConfig[]> {
  try {
    const res = await apiFetch('/api/permissions/fields/me');
    const data = await (res.json() as Promise<ApiFieldConfig[]>);
    return data.map(toFieldConfig);
  } catch (err) {
    if (MOCK_MODE) {
      await simulateLatency();
      return buildFieldConfigForRoles(mockRole);
    }
    throw err;
  }
}

function simulateLatency() {
  return new Promise(r => setTimeout(r, 150));
}
