import { apiFetch } from './apiFetch';

export interface UpdateUserAttributeResult {
  adAttributeName: string;
  oldValue:        string | null;
  newValue:        string | null;
  changed:         boolean;
}

export interface UpdateAccountStatusResult {
  enabled: boolean;
  changed: boolean;
}

// Cliente real de escritura del módulo de usuarios (actualización de atributos AD
// y cambio de estado de cuenta). Sin fallback a mock — bajo VITE_USE_MOCK_DATA=false
// cualquier fallo de red/API se relanza tal cual (vía apiFetch) y llega al caller
// como un error real; el modo mock vive exclusivamente en los skills legacy
// (UpdateAttributeSkill/EnableAccountSkill/DisableAccountSkill), nunca acá.
export const usersApi = {
  async updateUserAttribute(
    samAccountName: string,
    adAttributeName: string,
    value: string | null,
    previousValue: string | null,
  ): Promise<UpdateUserAttributeResult> {
    const res = await apiFetch(
      `/api/users/${encodeURIComponent(samAccountName)}/attributes/${encodeURIComponent(adAttributeName)}`,
      {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ value, previousValue }),
      },
    );
    return res.json() as Promise<UpdateUserAttributeResult>;
  },

  async updateAccountStatus(
    samAccountName: string,
    enabled: boolean,
  ): Promise<UpdateAccountStatusResult> {
    const res = await apiFetch(`/api/users/${encodeURIComponent(samAccountName)}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled }),
    });
    return res.json() as Promise<UpdateAccountStatusResult>;
  },
};
