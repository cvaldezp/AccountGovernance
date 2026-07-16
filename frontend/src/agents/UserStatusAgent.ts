import type { RoleName, AgentResult } from '../types';
import { enableAccount } from '../skills/EnableAccountSkill';
import { disableAccount } from '../skills/DisableAccountSkill';
import { getUserById } from '../skills/GetUserAttributesSkill';
import { addAuditEntry } from '../api/auditApi';
import { errorMessage } from '../api/apiFetch';
import { usersApi } from '../api/usersApi';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

export class UserStatusAgent {
  async enable(userId: string, operatorName: string, role: RoleName): Promise<AgentResult<void>> {
    if (MOCK_MODE) {
      const user   = await getUserById(userId);
      const domain = user ? (user.email.split('@')[1]?.toUpperCase() ?? 'UNKNOWN') : 'UNKNOWN';
      const result = await enableAccount(userId, role);

      addAuditEntry({
        performedBy: operatorName,
        roleName:    role,
        actionType:  'EnableAccount',
        fieldKey:    'AccountStatus',
        oldValue:    result.success ? 'Disabled' : undefined,
        newValue:    result.success ? 'Enabled'  : undefined,
        targetUser:  user?.username ?? userId,
        domain,
        success:     result.success,
      });

      return result;
    }

    // Real API — el backend resuelve rol/permisos desde la sesión, hace el
    // toggle seguro de userAccountControl y audita EnableAccount él mismo.
    try {
      await usersApi.updateAccountStatus(userId, true);
      return { success: true };
    } catch (err) {
      return { success: false, error: errorMessage(err) };
    }
  }

  async disable(userId: string, operatorName: string, role: RoleName): Promise<AgentResult<void>> {
    if (MOCK_MODE) {
      const user   = await getUserById(userId);
      const domain = user ? (user.email.split('@')[1]?.toUpperCase() ?? 'UNKNOWN') : 'UNKNOWN';
      const result = await disableAccount(userId, role);

      addAuditEntry({
        performedBy: operatorName,
        roleName:    role,
        actionType:  'DisableAccount',
        fieldKey:    'AccountStatus',
        oldValue:    result.success ? 'Enabled'  : undefined,
        newValue:    result.success ? 'Disabled' : undefined,
        targetUser:  user?.username ?? userId,
        domain,
        success:     result.success,
      });

      return result;
    }

    try {
      await usersApi.updateAccountStatus(userId, false);
      return { success: true };
    } catch (err) {
      return { success: false, error: errorMessage(err) };
    }
  }
}

export const userStatusAgent = new UserStatusAgent();
