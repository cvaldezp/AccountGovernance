export type RoleName = 'DragonHelp' | 'Registro' | 'Seguridades' | 'RRHH' | 'SystemAdmin';

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
  id:               string;
  name:             string;
  email:            string;
  role:             RoleName;    // primary role — for backward compatibility with permission checks
  roles:            RoleName[];  // all system roles derived from on-premises AD group memberships
  upn:              string;
  objectId:         string | null;
  primaryRole:      RoleName;    // same value as `role`, exposed under the name /api/auth/me uses
  permissions:      string[];    // reserved for future action-level grants — always empty for now
  isAuthorized:     boolean;
  profileLoadedAt:  string;      // ISO timestamp — when this profile was fetched from /api/auth/me
}

// Three-state auth lifecycle — distinct from technical errors (network/API failures),
// which are surfaced separately via AuthContextType.meError.
export type AuthStatus = 'authenticating' | 'authorized' | 'unauthorized';

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
  | 'account-creation'
  | 'attribute-catalog'
  | 'permissions-matrix'
  | 'account-type-config'
  | 'initial-groups'
  | 'system-roles-config'
  | 'distribution-lists';

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
