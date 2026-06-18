import { MOCK_USERS } from '../api/mockData';
import type { User } from '../types';

export async function searchUser(query: string): Promise<User[]> {
  await delay(200);
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MOCK_USERS.filter(
    u =>
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q),
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
