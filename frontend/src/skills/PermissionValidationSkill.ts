import { ROLES_CONFIG } from '../config/roles.config';
import type { FieldConfig, FieldName, PermissionAction, RoleName } from '../types';

const ALL_FIELDS: FieldName[] =
  ['Custom-External-Email-Address', 'Oficina', 'AccountStatus', 'telephoneNumber'];

// ── Legacy functions (roles.config.ts) — used by agents and PermissionAgent ─

export function canAccess(role: RoleName, field: FieldName, action: PermissionAction): boolean {
  if (role === 'SystemAdmin') return true; // SystemAdmin puede ver y editar todo.
  const roleConfig = ROLES_CONFIG.find(r => r.name === role);
  if (!roleConfig) return false;
  const fieldPerm = roleConfig.permissions.find(p => p.field === field);
  if (!fieldPerm) return false;
  return fieldPerm.actions.includes(action);
}

export function getAllowedFields(role: RoleName): FieldName[] {
  if (role === 'SystemAdmin') return ALL_FIELDS;
  const roleConfig = ROLES_CONFIG.find(r => r.name === role);
  if (!roleConfig) return [];
  return roleConfig.permissions.map(p => p.field);
}

export function getRoleConfig(role: RoleName) {
  return ROLES_CONFIG.find(r => r.name === role) ?? null;
}

// ── Dynamic functions (FieldConfig[]) — used by the UI rendering layer ────────
// These operate on the role-resolved list returned by fetchMyFields().

/** All fields with canView=true, sorted by sortOrder. */
export function getViewableFields(fieldConfigs: FieldConfig[]): FieldConfig[] {
  return fieldConfigs.filter(f => f.isActive && f.canView);
}

/** Fields the current role can both view AND edit. */
export function getEditableFields(fieldConfigs: FieldConfig[]): FieldConfig[] {
  return fieldConfigs.filter(f => f.isActive && f.canView && f.canEdit);
}

/** Fields visible to the current role that are read-only (canView but not canEdit). */
export function getReadOnlyFields(fieldConfigs: FieldConfig[]): FieldConfig[] {
  return fieldConfigs.filter(f => f.isActive && f.canView && !f.canEdit);
}

/** True when the field exists in the config and canView is set. */
export function canViewField(fieldConfigs: FieldConfig[], adAttributeName: string): boolean {
  const cfg = findByAttr(fieldConfigs, adAttributeName);
  return !!cfg && cfg.isActive && cfg.canView;
}

/** True when the field exists, canView=true, and canEdit=true. */
export function canEditField(fieldConfigs: FieldConfig[], adAttributeName: string): boolean {
  const cfg = findByAttr(fieldConfigs, adAttributeName);
  return !!cfg && cfg.isActive && cfg.canView && cfg.canEdit;
}

/** True when the field is flagged as sensitive in its AD definition. */
export function isSensitiveField(fieldConfigs: FieldConfig[], adAttributeName: string): boolean {
  return !!(findByAttr(fieldConfigs, adAttributeName)?.isSensitive);
}

/** Returns the full FieldConfig for a given AD attribute name, or null. */
export function getFieldConfig(fieldConfigs: FieldConfig[], adAttributeName: string): FieldConfig | null {
  return findByAttr(fieldConfigs, adAttributeName);
}

function findByAttr(fieldConfigs: FieldConfig[], adAttributeName: string): FieldConfig | null {
  return fieldConfigs.find(f => f.adAttributeName === adAttributeName) ?? null;
}
