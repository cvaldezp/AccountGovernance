import type { User, RoleName, UserAttributes } from '../types';
import { searchUser } from '../skills/SearchUserSkill';
import { authFetch } from '../api/authFetch';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

// Relative to the current origin — resolved through the same reverse proxy (IIS/HAProxy)
// or Vite dev proxy that serves the SPA, so no host/port config is needed per environment.
const SEARCH_URL = '/api/users/search';

// Mock data must never be a silent fallback for a broken/unreachable API — it only
// activates when explicitly opted into via this flag (e.g. local dev without AD access).
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

interface ApiSearchResultDto {
  samAccountName: string;
  displayName:    string;
  email:          string | null;
  department:     string | null;
  isEnabled:      boolean;
  customBannerID?: string | null;
}

interface ApiErrorDto {
  error: string;
  code:  string;
}

export interface UserSearchAgentResult {
  success:    boolean;
  data?:      User[];
  error?:     string;
  errorCode?: string;
  fromMock?:  boolean;
}

function mapApiUser(dto: ApiSearchResultDto): User {
  return {
    id:          dto.samAccountName,
    username:    dto.samAccountName,
    displayName: dto.displayName,
    email:       dto.email       ?? '',
    department:  dto.department  ?? '',
    jobTitle:    '',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina:       '',
      AccountStatus: dto.isEnabled ? 'Enabled' : 'Disabled',
    } as UserAttributes,
  };
}

/// Builds a UserSearchAgentResult for any non-2xx response — the API answered,
/// so this is a real error and must never fall through to mock data.
async function buildErrorResult(res: Response): Promise<UserSearchAgentResult> {
  if (res.status === 401 || res.status === 403) {
    return {
      success:   false,
      error:     'No tienes autorización para buscar usuarios. Verifica tu sesión e intenta de nuevo.',
      errorCode: 'UNAUTHORIZED',
    };
  }

  try {
    const err: ApiErrorDto = await res.json();
    return { success: false, error: err.error, errorCode: err.code };
  } catch {
    return {
      success:   false,
      error:     `Error del servidor al buscar usuarios (HTTP ${res.status}).`,
      errorCode: 'SERVER_ERROR',
    };
  }
}

export class UserSearchAgent {
  async execute(query: string, _role: RoleName): Promise<UserSearchAgentResult> {
    const q = query.trim();
    if (!q) return { success: false, error: 'La búsqueda no puede estar vacía' };

    try {
      const res = await authFetch(
        `${SEARCH_URL}?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (res.ok) {
        const data: ApiSearchResultDto[] = await res.json();
        return { success: true, data: data.map(mapApiUser) };
      }

      // Any non-2xx response means the API was reached and answered — surface the
      // real error to the user instead of silently falling back to mock data.
      return await buildErrorResult(res);
    } catch {
      // The API itself was unreachable (network error, timeout, CORS) — mock data
      // is only used here, and only when explicitly enabled via VITE_USE_MOCK_DATA.
      if (MOCK_MODE) {
        const users = await searchUser(q);
        return { success: true, data: users, fromMock: true };
      }
      return {
        success:   false,
        error:     'No se pudo conectar con el servidor de búsqueda. Verifica tu conexión o intenta de nuevo más tarde.',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}

export const userSearchAgent = new UserSearchAgent();
