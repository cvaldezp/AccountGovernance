import { MOCK_USERS } from '../api/mockData';
import type { RoleName, AgentResult } from '../types';
import { canAccess } from './PermissionValidationSkill';

export async function disableAccount(userId: string, role: RoleName): Promise<AgentResult<void>> {
  await delay(300);

  if (!canAccess(role, 'AccountStatus', 'write')) {
    return { success: false, error: `El rol ${role} no tiene permiso para deshabilitar cuentas` };
  }

  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) return { success: false, error: 'Usuario no encontrado' };
  if (user.attributes.AccountStatus === 'Disabled') {
    return { success: false, error: 'La cuenta ya está deshabilitada' };
  }

  user.attributes.AccountStatus = 'Disabled';
  return { success: true };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
