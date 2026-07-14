import type { User, RoleName, AgentResult, FieldName, UserAttributes } from '../types';
import { getUserById, getVisibleAttributes } from '../skills/GetUserAttributesSkill';
import { updateAttribute } from '../skills/UpdateAttributeSkill';
import { addAuditEntry } from '../api/auditApi';
import { authFetch } from '../api/authFetch';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

// Relative to the current origin — resolved through the same reverse proxy (IIS/HAProxy)
// or Vite dev proxy that serves the SPA, so no host/port config is needed per environment.
const USERS_URL = '/api/users';

// Mock data must never be a silent fallback for a broken/unreachable API — it only
// activates when explicitly opted into via this flag (e.g. local dev without AD access).
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

// Shape of the real API response (GET /api/users/{samAccountName})
interface ApiUserDetailDto {
  samAccountName:              string;
  displayName:                 string;
  givenName?:                  string | null;
  sn?:                         string | null;
  mail?:                       string | null;
  userPrincipalName?:          string | null;
  company?:                    string | null;
  department?:                 string | null;
  title?:                      string | null;
  manager?:                    string | null;
  physicalDeliveryOfficeName?: string | null;
  telephoneNumber?:            string | null;
  mobile?:                     string | null;
  externalEmail?:              string | null;
  extensionAttribute1?:        string | null;
  extensionAttribute2?:        string | null;
  extensionAttribute3?:        string | null;
  userAccountControl?:         number | null;
  isEnabled:                   boolean;
  whenCreated?:                string | null;
  whenChanged?:                string | null;
  lastLogon?:                  string | null;
  distinguishedName?:          string | null;
}

function mapApiDetailToUser(dto: ApiUserDetailDto): User {
  return {
    id:          dto.samAccountName,
    username:    dto.samAccountName,
    displayName: dto.displayName,
    email:       dto.mail                   ?? '',
    department:  dto.department             ?? '',
    jobTitle:    dto.title                  ?? '',
    attributes: {
      'Custom-External-Email-Address': dto.externalEmail              ?? '',
      Oficina:                         dto.physicalDeliveryOfficeName ?? '',
      AccountStatus:                   dto.isEnabled ? 'Enabled' : 'Disabled',
      telephoneNumber:                 dto.telephoneNumber            ?? '',
    } as UserAttributes,
  };
}

export class UserProfileAgent {
  async getProfile(samAccountName: string, role: RoleName): Promise<AgentResult<User>> {
    try {
      const res = await authFetch(
        `${USERS_URL}/${encodeURIComponent(samAccountName)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (res.ok) {
        const dto: ApiUserDetailDto = await res.json();
        return { success: true, data: mapApiDetailToUser(dto) };
      }

      if (res.status === 404) {
        return {
          success: false,
          error: `Usuario '${samAccountName}' no encontrado en Active Directory.`,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: 'No tienes autorización para consultar este usuario. Verifica tu sesión e intenta de nuevo.',
        };
      }

      // Any other non-2xx response means the API was reached and answered — surface
      // the real error to the user instead of silently falling back to mock data.
      return {
        success: false,
        error: `Error del servidor al consultar el usuario (HTTP ${res.status}).`,
      };
    } catch {
      // The API itself was unreachable (network error, timeout, CORS) — mock data
      // is only used here, and only when explicitly enabled via VITE_USE_MOCK_DATA.
      if (MOCK_MODE) {
        const user = await getUserById(samAccountName);
        if (!user) return { success: false, error: 'Usuario no encontrado.' };

        const visibleAttrs = getVisibleAttributes(user, role);
        return { success: true, data: { ...user, attributes: visibleAttrs as User['attributes'] } };
      }
      return {
        success: false,
        error: 'No se pudo conectar con el servidor. Verifica tu conexión o intenta de nuevo más tarde.',
      };
    }
  }

  async updateField(
    userId: string,
    field: FieldName,
    newValue: string,
    operatorName: string,
    role: RoleName,
  ): Promise<AgentResult<void>> {
    const result = await updateAttribute(userId, field, newValue, role);
    const user   = await getUserById(userId);

    // email domain is used for audit context only — never used as account identifier
    const domain = user ? (user.email.split('@')[1]?.toUpperCase() ?? 'UNKNOWN') : 'UNKNOWN';

    addAuditEntry({
      performedBy: operatorName,
      roleName:    role,
      actionType:  'UPDATE_FIELD',
      fieldKey:    field,
      oldValue:    result.data?.oldValue,
      newValue:    result.data?.newValue,
      targetUser:  user?.username ?? userId,
      domain,
      success:     result.success,
    });

    if (!result.success) return { success: false, error: result.error };
    return { success: true };
  }
}

export const userProfileAgent = new UserProfileAgent();
