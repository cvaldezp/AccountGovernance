import type { FieldName, PermissionAction, RoleName } from '../types';
import { canAccess, getAllowedFields, getRoleConfig } from '../skills/PermissionValidationSkill';
import { ROLES_CONFIG } from '../config/roles.config';

export class PermissionAgent {
  can(role: RoleName, field: FieldName, action: PermissionAction): boolean {
    return canAccess(role, field, action);
  }

  allowedFields(role: RoleName): FieldName[] {
    return getAllowedFields(role);
  }

  roleInfo(role: RoleName) {
    return getRoleConfig(role);
  }

  allRoles() {
    return ROLES_CONFIG;
  }

  canManageAccountStatus(role: RoleName): boolean {
    return canAccess(role, 'AccountStatus', 'write');
  }
}

export const permissionAgent = new PermissionAgent();
