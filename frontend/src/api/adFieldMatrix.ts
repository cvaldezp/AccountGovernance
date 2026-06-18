import type { ADFieldDefinition, RoleADFieldPermission, FieldConfig, RoleName } from '../types';
import { AD_FIELD_DEFINITIONS } from '../config/adFieldDefinitions';
import { ROLE_AD_FIELD_PERMISSIONS } from '../config/roleFieldPermissions';

// ── Raw config accessors ──────────────────────────────────────────────────────

export function getFieldDefinitions(): ADFieldDefinition[] {
  return AD_FIELD_DEFINITIONS;
}

export function getRoleFieldPermissions(): RoleADFieldPermission[] {
  return ROLE_AD_FIELD_PERMISSIONS;
}

// ── Role-specific query functions ─────────────────────────────────────────────

/** Fields the given role can view (canView=true), in sort order. */
export function getVisibleFieldsForRoles(role: RoleName): FieldConfig[] {
  return buildFieldConfigForRoles(role).filter(f => f.canView);
}

/** Fields the given role can both view and edit, in sort order. */
export function getEditableFieldsForRoles(role: RoleName): FieldConfig[] {
  return buildFieldConfigForRoles(role).filter(f => f.canView && f.canEdit);
}

// ── Main composition function ─────────────────────────────────────────────────
// Joins AD_FIELD_DEFINITIONS x ROLE_AD_FIELD_PERMISSIONS for one role.
// Returns ALL active fields (including canView=false) so callers have the
// full matrix. Use getVisibleFieldsForRoles() or PermissionValidationSkill
// helpers to filter for display.

export function buildFieldConfigForRoles(role: RoleName): FieldConfig[] {
  return AD_FIELD_DEFINITIONS
    .filter(def => def.isActive)
    .map(def => {
      const perm = ROLE_AD_FIELD_PERMISSIONS.find(
        p => p.roleName === role && p.fieldKey === def.fieldKey,
      );
      const permActive = perm?.isActive ?? false;
      return {
        fieldKey:        def.fieldKey,
        adAttributeName: def.adAttributeName,
        displayName:     def.displayName,
        description:     def.description,
        fieldType:       def.fieldType,
        isSensitive:     def.isSensitive,
        canView:         permActive ? perm!.canView  : false,
        canEdit:         permActive ? perm!.canEdit  : false,
        isActive:        true,
        sortOrder:       def.sortOrder,
        allowedValues:   def.allowedValues,
        placeholder:     def.placeholder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
