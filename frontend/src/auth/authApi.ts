import { authFetch } from '../api/authFetch';

export interface MeDto {
  upn:          string;
  displayName:  string | null;
  email:        string | null;
  objectId:     string | null;
  roles:        string[];
  /** Highest-priority role, resolved server-side. The frontend must not re-derive this. */
  primaryRole:  string | null;
  permissions:  string[];
  isAuthorized: boolean;
}

/**
 * Calls GET /api/auth/me with the current MSAL access token (attached by authFetch).
 * Returns null on any failure (network error, 401, etc.).
 */
export async function fetchMe(): Promise<MeDto | null> {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    return res.json() as Promise<MeDto>;
  } catch {
    return null;
  }
}
