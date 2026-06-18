import type { AuditFilters } from '../types/audit';
import { getAuditEntries } from '../api/auditApi';

export type { AuditEntry } from '../types/audit';
export { addAuditEntry } from '../api/auditApi';

// Thin wrapper kept for AuditAgent backward compat.
export async function getAuditLogs(filters?: AuditFilters) {
  return getAuditEntries(filters);
}
