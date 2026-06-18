import { MOCK_USERS } from '../api/mockData';
import type { FieldName, RoleName, AgentResult } from '../types';
import { canAccess } from './PermissionValidationSkill';

export async function updateAttribute(
  userId: string,
  field: FieldName,
  newValue: string,
  role: RoleName,
): Promise<AgentResult<{ oldValue: string; newValue: string }>> {
  await delay(300);

  if (!canAccess(role, field, 'write')) {
    return { success: false, error: `El rol ${role} no tiene permiso para modificar ${field}` };
  }

  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) return { success: false, error: 'Usuario no encontrado' };

  const oldValue = user.attributes[field as keyof typeof user.attributes];
  (user.attributes as Record<FieldName, string>)[field] = newValue;

  return { success: true, data: { oldValue: String(oldValue), newValue } };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
