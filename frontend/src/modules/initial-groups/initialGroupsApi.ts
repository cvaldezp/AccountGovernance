import type { InitialGroup, CreateGroupForm, AdGroupValidation } from './types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg += ` — ${(JSON.parse(body) as { error?: string }).error ?? body}`; }
    catch { if (body) msg += ` — ${body}`; }
    throw new Error(msg);
  }
  return res;
}

export const initialGroupsApi = {
  async getGroups(typeKey: string, subTypeKey?: string): Promise<InitialGroup[]> {
    const url = subTypeKey
      ? `/api/account-type-configs/${typeKey}/subtypes/${subTypeKey}/groups`
      : `/api/account-type-configs/${typeKey}/groups`;
    try {
      const res = await apiFetch(url);
      return res.json() as Promise<InitialGroup[]>;
    } catch { return []; }
  },

  async createGroup(
    typeKey:    string,
    subTypeKey: string | undefined,
    form:       CreateGroupForm,
  ): Promise<InitialGroup> {
    const url = subTypeKey
      ? `/api/account-type-configs/${typeKey}/subtypes/${subTypeKey}/groups`
      : `/api/account-type-configs/${typeKey}/groups`;
    const res = await apiFetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        groupName:         form.groupName,
        groupDn:           form.groupDn,
        groupObjectGuid:   form.groupObjectGuid || null,
        groupSid:          form.groupSid || null,
        isCritical:        form.isCritical,
        continueOnFailure: form.continueOnFailure,
        isActive:          form.isActive,
        sortOrder:         form.sortOrder,
      }),
    });
    return res.json() as Promise<InitialGroup>;
  },

  async updateGroup(id: number, form: CreateGroupForm): Promise<InitialGroup> {
    const res = await apiFetch(`/api/account-type-configs/groups/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        groupName:         form.groupName,
        groupDn:           form.groupDn,
        groupObjectGuid:   form.groupObjectGuid || null,
        groupSid:          form.groupSid || null,
        isCritical:        form.isCritical,
        continueOnFailure: form.continueOnFailure,
        isActive:          form.isActive,
        sortOrder:         form.sortOrder,
      }),
    });
    return res.json() as Promise<InitialGroup>;
  },

  async deleteGroup(id: number): Promise<void> {
    await apiFetch(`/api/account-type-configs/groups/${id}`, { method: 'DELETE' });
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
