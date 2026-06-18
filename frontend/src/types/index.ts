export type RoleName = 'DragonHelp' | 'Registro' | 'Seguridades' | 'RRHH';

export type FieldName =
  | 'Custom-External-Email-Address'
  | 'Oficina'
  | 'AccountStatus'
  | 'telephoneNumber';

export type PermissionAction = 'read' | 'write';

export interface FieldPermission {
  field: FieldName;
  actions: PermissionAction[];
}

export interface Role {
  name: RoleName;
  displayName: string;
  color: string;
  permissions: FieldPermission[];
}

export interface UserAttributes {
  'Custom-External-Email-Address': string;
  Oficina: string;
  AccountStatus: 'Enabled' | 'Disabled' | 'Locked';
  telephoneNumber?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  department: string;
  jobTitle: string;
  attributes: UserAttributes;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  operatorName: string;
  operatorRole: RoleName;
  action: string;
  targetUser: string;
  field?: FieldName;
  oldValue?: string;
  newValue?: string;
  success: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type RouteKey =
  | 'dashboard'
  | 'search'
  | 'user-detail'
  | 'audit'
  | 'attribute-catalog'
  | 'permissions-matrix';

// ── Parametric field configuration ──────────────────────────────────────────

export type FieldType = 'text' | 'email' | 'select' | 'textarea';

/**
 * Normalized catalog entry for an AD attribute.
 * Describes WHAT a field is, independent of any role.
 */
export interface ADFieldDefinition {
  fieldKey:        string;
  adAttributeName: string;
  displayName:     string;
  description:     string;
  fieldType:       FieldType;
  isSensitive:     boolean;
  isActive:        boolean;
  sortOrder:       number;
  allowedValues?:  string[];
  placeholder?:    string;
}

/**
 * Permission matrix entry linking a role to an AD field.
 * Describes WHAT a role can do with a specific field.
 */
export interface RoleADFieldPermission {
  roleName:  RoleName;
  fieldKey:  string;
  canView:   boolean;
  canEdit:   boolean;
  isActive:  boolean;
}

/**
 * Resolved view: definition + permissions joined for a specific role.
 * Produced by resolveFieldMatrix() — used throughout the UI layer.
 */
export interface FieldConfig {
  fieldKey:        string;
  adAttributeName: string;
  displayName:     string;
  description:     string;
  fieldType:       FieldType;
  isSensitive:     boolean;
  canView:         boolean;
  canEdit:         boolean;
  isActive:        boolean;
  sortOrder:       number;
  allowedValues?:  string[];
  placeholder?:    string;
}
