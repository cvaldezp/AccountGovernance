import type { User, RoleName, UserAttributes } from '../types';
import { searchUser } from '../skills/SearchUserSkill';

const API_BASE = (import.meta as { env?: Record<string, string | undefined> }).env?.['VITE_API_URL']
  ?? 'http://localhost:5000';

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

export class UserSearchAgent {
  async execute(query: string, _role: RoleName): Promise<UserSearchAgentResult> {
    const q = query.trim();
    if (!q) return { success: false, error: 'La búsqueda no puede estar vacía' };

    // ── Try real API ──────────────────────────────────────────────────────────
    try {
      const res = await fetch(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (res.ok) {
        const data: ApiSearchResultDto[] = await res.json();
        return { success: true, data: data.map(mapApiUser) };
      }

      if (res.status === 400) {
        const err: ApiErrorDto = await res.json();
        return { success: false, error: err.error, errorCode: err.code };
      }
    } catch {
      // Network error or timeout — fall through to mock
    }

    // ── Fallback: mock data ───────────────────────────────────────────────────
    const users = await searchUser(q);
    return { success: true, data: users, fromMock: true };
  }
}

export const userSearchAgent = new UserSearchAgent();
