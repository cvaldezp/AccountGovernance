import { apiFetch } from '../../api/apiFetch';

// Shapes 1:1 con RoleAccessDto.cs (JSON camelCase).

export interface RoleAccessRole {
  roleKey:       string;
  displayName:   string;
  isSystemAdmin: boolean;
}

export interface RoleAccessResource {
  resourceKey:     string;
  parentKey:       string | null;
  resourceType:    'Module' | 'Action' | 'Tab';
  displayName:     string;
  description:     string | null;
  sortOrder:       number;
  systemAdminOnly: boolean;
}

export interface RoleAccessGrant {
  roleKey:     string;
  resourceKey: string;
}

export interface RoleAccessMatrix {
  roles:     RoleAccessRole[];
  resources: RoleAccessResource[];
  grants:    RoleAccessGrant[];
}

export interface RoleAccessCell {
  roleKey:     string;
  resourceKey: string;
  granted:     boolean;
}

export const roleAccessApi = {
  async getMatrix(): Promise<RoleAccessMatrix> {
    const res = await apiFetch('/api/role-access');
    return res.json() as Promise<RoleAccessMatrix>;
  },

  async setAccess(roleKey: string, resourceKey: string, granted: boolean): Promise<RoleAccessCell> {
    const res = await apiFetch(
      `/api/role-access/${encodeURIComponent(roleKey)}/${encodeURIComponent(resourceKey)}`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ granted }),
      },
    );
    return res.json() as Promise<RoleAccessCell>;
  },
};
