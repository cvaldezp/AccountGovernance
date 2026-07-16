import type { RoleName, AgentResult } from '../types';
import { enableAccount } from '../skills/EnableAccountSkill';
import { disableAccount } from '../skills/DisableAccountSkill';
import { getUserById } from '../skills/GetUserAttributesSkill';
import { addAuditEntry } from '../api/auditApi';

export class UserStatusAgent {
  async enable(userId: string, operatorName: string, role: RoleName): Promise<AgentResult<void>> {
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

  async disable(userId: string, operatorName: string, role: RoleName): Promise<AgentResult<void>> {
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
}

export const userStatusAgent = new UserStatusAgent();
