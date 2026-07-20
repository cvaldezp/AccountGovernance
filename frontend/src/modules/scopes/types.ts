// Ámbitos Administrativos (Scope) — Incremento 2. Consume el CRUD del
// Incremento 1 (gov.AdministrativeScopes / gov.AdministrativeScopeFilters).
// Sin enforcement todavía: estos ámbitos no restringen ninguna operación real.

export const FILTER_OPERATORS = ['Equals', 'NotEquals', 'In', 'Exists'] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

// ScopeKey: identificador técnico estable, mismo criterio que FieldKey/RoleKey
// en el resto del proyecto — se define una sola vez, nunca se renombra.
export const SCOPE_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

export interface AdministrativeScopeFilter {
  id:            number;
  filterType:    string;
  attributeName: string;
  operator:      string;
  value:         string | null;
  isActive:      boolean;
}

export interface AdministrativeScope {
  id:                number;
  scopeKey:          string;
  name:              string;
  description:       string | null;
  category:          string | null;
  baseDn:            string;
  connectionProfile: string;
  isActive:          boolean;
  priority:          number;
  createdBy:         string | null;
  updatedBy:         string | null;
  createdAt:         string;
  updatedAt:         string;
  filters:           AdministrativeScopeFilter[];
}

// ── Forms ────────────────────────────────────────────────────────────────────

// Sin isActive: un Scope siempre se crea como borrador inactivo — activarlo es
// una acción de estado separada y explícita (PATCH .../status), nunca parte
// de la creación. Pedido explícito de diseño, no una omisión.
export interface CreateScopeForm {
  scopeKey:          string;
  name:              string;
  description:       string;
  category:          string;
  baseDn:            string;
  connectionProfile: string;
  priority:          number;
}

// Sin scopeKey: es inmutable después de crear el Scope — este tipo existe
// específicamente para que sea estructuralmente imposible enviarlo en un PUT.
export interface UpdateScopeForm {
  name:              string;
  description:       string;
  category:          string;
  baseDn:            string;
  connectionProfile: string;
  priority:          number;
}

export interface FilterForm {
  filterType:    string;
  attributeName: string;
  operator:      FilterOperator;
  value:         string;
  isActive:      boolean;
}

export const BLANK_CREATE_SCOPE_FORM: CreateScopeForm = {
  scopeKey:          '',
  name:              '',
  description:       '',
  category:          '',
  baseDn:            '',
  connectionProfile: 'default',
  priority:          100,
};

export const BLANK_FILTER_FORM: FilterForm = {
  filterType:    '',
  attributeName: '',
  operator:      'Equals',
  value:         '',
  isActive:      true,
};

export function toUpdateScopeForm(scope: AdministrativeScope): UpdateScopeForm {
  return {
    name:              scope.name,
    description:       scope.description ?? '',
    category:          scope.category ?? '',
    baseDn:            scope.baseDn,
    connectionProfile: scope.connectionProfile,
    priority:          scope.priority,
  };
}

export function toFilterForm(filter: AdministrativeScopeFilter): FilterForm {
  return {
    filterType:    filter.filterType,
    attributeName: filter.attributeName,
    operator:      filter.operator as FilterOperator,
    value:         filter.value ?? '',
    isActive:      filter.isActive,
  };
}

// ── Validación de cliente — solo UX, el backend sigue siendo la autoridad ──

export function validateCreateScopeForm(form: CreateScopeForm): string | null {
  const scopeKey = form.scopeKey.trim();
  if (!scopeKey) return 'La clave del ámbito (ScopeKey) es obligatoria.';
  if (!SCOPE_KEY_PATTERN.test(scopeKey))
    return 'ScopeKey debe empezar con una letra minúscula y contener solo minúsculas, números y guiones (ej. empleados-usfq).';
  if (!form.name.trim()) return 'El nombre es obligatorio.';
  if (!form.baseDn.trim()) return 'El Base DN es obligatorio.';
  if (!Number.isInteger(form.priority) || form.priority < 0)
    return 'La prioridad debe ser un número entero no negativo.';
  return null;
}

export function validateUpdateScopeForm(form: UpdateScopeForm): string | null {
  if (!form.name.trim()) return 'El nombre es obligatorio.';
  if (!form.baseDn.trim()) return 'El Base DN es obligatorio.';
  if (!Number.isInteger(form.priority) || form.priority < 0)
    return 'La prioridad debe ser un número entero no negativo.';
  return null;
}

export function validateFilterForm(form: FilterForm): string | null {
  if (!form.filterType.trim()) return 'El tipo de filtro es obligatorio.';
  if (!form.attributeName.trim()) return 'El atributo AD es obligatorio.';
  if (!form.operator) return 'El operador es obligatorio.';
  if (form.operator !== 'Exists' && !form.value.trim())
    return `El operador ${form.operator} requiere un valor.`;
  return null;
}
