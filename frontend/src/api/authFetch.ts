import { msalInstance } from '../auth/msalInstance';
import { apiScopes } from '../auth/msalConfig';

// Shared fetch wrapper that attaches a Bearer token when an MSAL account is active.
// Falls back to an unauthenticated request if token acquisition fails — the backend
// will respond with 401, which the app handles by redirecting to the login screen.
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined ?? {}),
  };

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await msalInstance.acquireTokenSilent({
        scopes:  apiScopes,
        account: accounts[0],
      });
      headers['Authorization'] = `Bearer ${result.accessToken}`;
    } catch {
      // Silent acquisition failed — proceed without auth header
    }
  }

  return fetch(url, { ...options, headers });
}
