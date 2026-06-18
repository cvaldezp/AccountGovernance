import { MOCK_USERS } from '../api/mockData';
import type { User, FieldName, RoleName } from '../types';
import { getAllowedFields } from './PermissionValidationSkill';

export async function getUserById(userId: string): Promise<User | null> {
  await delay(150);
  return MOCK_USERS.find(u => u.id === userId) ?? null;
}

export function getVisibleAttributes(user: User, role: RoleName): Partial<User['attributes']> {
  const allowed = getAllowedFields(role);
  const result: Partial<User['attributes']> = {};
  for (const field of allowed) {
    if (field in user.attributes) {
      (result as Record<FieldName, string>)[field] = user.attributes[field as keyof User['attributes']] ?? '';
    }
  }
  return result;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
