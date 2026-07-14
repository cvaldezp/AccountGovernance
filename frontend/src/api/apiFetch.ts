import { authFetch } from './authFetch';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/// Shared authenticated-fetch wrapper: throws a readable Error on non-2xx responses,
/// pulling the backend's `{ error }` payload when present.
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
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
