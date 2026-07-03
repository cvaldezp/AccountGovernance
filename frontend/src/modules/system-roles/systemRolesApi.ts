import { authFetch } from '../../api/authFetch';
import type { AdGroupValidation, CreateGroupForm, SystemRole, UpdateRoleForm } from './types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg += ` — ${(JSON.parse(body) as { error?: string }).error ?? body}`; }
    catch { if (body) msg += ` — ${body}`; }
    throw new Error(msg);
  }
  return res;
}

// No mock fallback here, unlike account-type-config — this screen controls who can
// access the whole app, so a silent fallback to fake data would be actively dangerous.
export const systemRolesApi = {
  async getAll(): Promise<SystemRole[]> {
    const res = await apiFetch('/api/system-roles');
    return res.json() as Promise<SystemRole[]>;
  },

  async updateRole(roleKey: string, form: UpdateRoleForm): Promise<SystemRole> {
    const res = await apiFetch(`/api/system-roles/${roleKey}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        displayName: form.displayName,
        description: form.description || null,
        priority:    form.priority,
        isActive:    form.isActive,
      }),
    });
    return res.json() as Promise<SystemRole>;
  },

  async createGroup(roleKey: string, form: CreateGroupForm) {
    const res = await apiFetch(`/api/system-roles/${roleKey}/groups`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        groupName:       form.groupName,
        groupDn:         form.groupDn,
        groupObjectGuid: form.groupObjectGuid || null,
        groupSid:        form.groupSid || null,
        isActive:        form.isActive,
      }),
    });
    return res.json();
  },

  async updateGroup(roleKey: string, id: number, form: CreateGroupForm) {
    const res = await apiFetch(`/api/system-roles/${roleKey}/groups/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        groupName:       form.groupName,
        groupDn:         form.groupDn,
        groupObjectGuid: form.groupObjectGuid || null,
        groupSid:        form.groupSid || null,
        isActive:        form.isActive,
      }),
    });
    return res.json();
  },

  async deleteGroup(roleKey: string, id: number): Promise<void> {
    await apiFetch(`/api/system-roles/${roleKey}/groups/${id}`, { method: 'DELETE' });
  },

  async validateAdGroup(query: string): Promise<AdGroupValidation> {
    try {
      const res = await apiFetch('/api/ad/groups/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query }),
      });
      return res.json() as Promise<AdGroupValidation>;
    } catch (err) {
      return {
        isValid: false, groupName: null, dn: null, objectGuid: null, sid: null,
        isSecurity: false,
        error: `No se pudo validar en AD: ${errorMessage(err)}`,
      };
    }
  },
};
