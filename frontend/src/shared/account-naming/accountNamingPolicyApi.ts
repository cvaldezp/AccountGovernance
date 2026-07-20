import { authFetch } from '../../api/authFetch';
import type { AccountNamingPolicy, UpdateAccountNamingPolicy } from './types';

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

// Sin fallback a mock — el backend es la autoridad definitiva de la política.
// Si no se puede cargar, el formulario de creación de cuentas debe mostrarlo
// como error real, nunca inventar una política local.
export const accountNamingPolicyApi = {
  async get(): Promise<AccountNamingPolicy> {
    const res = await apiFetch('/api/account-naming-policy');
    return res.json() as Promise<AccountNamingPolicy>;
  },

  async update(policy: UpdateAccountNamingPolicy): Promise<AccountNamingPolicy> {
    const res = await apiFetch('/api/account-naming-policy', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(policy),
    });
    return res.json() as Promise<AccountNamingPolicy>;
  },
};
