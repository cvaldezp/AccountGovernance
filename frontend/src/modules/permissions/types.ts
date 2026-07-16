export interface Attribute {
  fieldKey:        string;
  adAttributeName: string;
  displayName:     string;
  description:     string;
  fieldType:       string;
  category:        string | null;
  dataType:        string | null;
  isSensitive:     boolean;
  requiresAudit:   boolean;
  isActive:        boolean;
  sortOrder:       number;
  allowedValues:   string[] | null;
  placeholder:     string | null;
  createdBy:       string | null;
  updatedBy:       string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface AttributeForm {
  fieldKey:        string;
  adAttributeName: string;
  displayName:     string;
  description:     string;
  fieldType:       string;
  category:        string;
  dataType:        string;
  isSensitive:     boolean;
  requiresAudit:   boolean;
  sortOrder:       number;
  allowedValues:   string;
  placeholder:     string;
}

export const BLANK_ATTRIBUTE_FORM: AttributeForm = {
  fieldKey:        '',
  adAttributeName: '',
  displayName:     '',
  description:     '',
  fieldType:       'Text',
  category:        '',
  dataType:        '',
  isSensitive:     false,
  requiresAudit:   false,
  sortOrder:       0,
  allowedValues:   '',
  placeholder:     '',
};

/**
 * Validación de formulario en el cliente — feedback inmediato antes del round-trip.
 * El backend sigue siendo la fuente de verdad (duplicados, existencia, etc.); esto
 * solo cubre lo que se puede saber sin llamar a la API.
 */
export function validateAttributeForm(form: AttributeForm, mode: 'create' | 'edit'): string | null {
  if (mode === 'create' && !form.fieldKey.trim())
    return 'FieldKey es obligatorio.';
  if (!form.adAttributeName.trim())
    return 'El atributo LDAP (AdAttributeName) es obligatorio.';
  if (!form.displayName.trim())
    return 'El nombre visible es obligatorio.';
  if (!form.category.trim())
    return 'La categoría es obligatoria.';
  if (!form.dataType.trim())
    return 'El tipo de dato es obligatorio.';
  return null;
}

export function toAttributeForm(attribute: Attribute): AttributeForm {
  return {
    fieldKey:        attribute.fieldKey,
    adAttributeName: attribute.adAttributeName,
    displayName:     attribute.displayName,
    description:     attribute.description,
    fieldType:       attribute.fieldType,
    category:        attribute.category ?? '',
    dataType:        attribute.dataType ?? '',
    isSensitive:     attribute.isSensitive,
    requiresAudit:   attribute.requiresAudit,
    sortOrder:       attribute.sortOrder,
    allowedValues:   attribute.allowedValues?.join(', ') ?? '',
    placeholder:     attribute.placeholder ?? '',
  };
}

// ── Permissions matrix (Fase 2) ───────────────────────────────────────────────

export interface MatrixFieldAccess {
  canView: boolean;
  canEdit: boolean;
}

export interface MatrixRow {
  fieldKey:        string;
  displayName:     string;
  adAttributeName: string;
  isSensitive:     boolean;
  byRole:          Record<string, MatrixFieldAccess>;
}

export interface PermissionsMatrix {
  fields: MatrixRow[];
  roles:  string[]; // RoleKey de gov.SystemRoles, activos, en orden de Priority
}

// Tri-estado explícito — evita representar combinaciones inválidas como
// canEdit=true + canView=false en el cliente.
export type CellAccess = 'None' | 'View' | 'Edit';

export function accessFromCell(cell: MatrixFieldAccess | undefined): CellAccess {
  if (!cell) return 'None';
  if (cell.canEdit) return 'Edit';
  if (cell.canView) return 'View';
  return 'None';
}

export function nextAccess(current: CellAccess): CellAccess {
  if (current === 'None') return 'View';
  if (current === 'View') return 'Edit';
  return 'None';
}
