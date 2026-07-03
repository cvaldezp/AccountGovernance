import type { IPublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { apiScopes } from './msalConfig';

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
 * Calls GET /api/auth/me with the current MSAL access token.
 * Returns null on any failure (network error, 401, etc.).
 */
export async function fetchMe(
  instance: IPublicClientApplication,
  account:  AccountInfo,
): Promise<MeDto | null> {
  try {
    const tokenResult = await instance.acquireTokenSilent({ scopes: apiScopes, account });
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<MeDto>;
  } catch {
    return null;
  }
}
