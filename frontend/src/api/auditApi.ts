import { MOCK_AUDIT_LOGS, MOCK_USERS } from './mockData';
import type { AuditEntry, AuditFilters, AuditActionType } from '../types/audit';

// ── Helpers ───────────────────────────────────────────────────────────────────

function domainFromUsername(username: string): string {
  const user = MOCK_USERS.find(u => u.username === username);
  return user ? (user.email.split('@')[1]?.toUpperCase() ?? 'UNKNOWN') : 'UNKNOWN';
}

function mapActionType(action: string): AuditActionType {
  if (action === 'UPDATE_ATTRIBUTE') return 'UPDATE_FIELD';
  if (action === 'ENABLE_ACCOUNT')   return 'ENABLE_ACCOUNT';
  if (action === 'DISABLE_ACCOUNT')  return 'DISABLE_ACCOUNT';
  return 'UPDATE_FIELD';
}

// ── In-memory store — seeded from MOCK_AUDIT_LOGS ─────────────────────────────
// New entries are prepended so the list stays sorted newest-first.

const AUDIT_STORE: AuditEntry[] = MOCK_AUDIT_LOGS.map(log => ({
  id:          log.id,
  timestamp:   log.timestamp,
  performedBy: log.operatorName,
  roleName:    log.operatorRole,
  actionType:  mapActionType(log.action),
  fieldKey:    log.field,
  oldValue:    log.oldValue,
  newValue:    log.newValue,
  targetUser:  log.targetUser,
  domain:      domainFromUsername(log.targetUser),
  success:     log.success,
}));

let nextId = 200;

// ── Public API ────────────────────────────────────────────────────────────────

export function addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const auditEntry: AuditEntry = {
    ...entry,
    id:        `ae-${nextId++}`,
    timestamp: new Date().toISOString(),
  };
  AUDIT_STORE.unshift(auditEntry);
  return auditEntry;
}

export async function getAuditEntries(filters?: AuditFilters): Promise<AuditEntry[]> {
  await simulateLatency();
  let list = [...AUDIT_STORE];

  if (filters?.targetUser) {
    const q = filters.targetUser.toLowerCase();
    list = list.filter(e => e.targetUser.toLowerCase().includes(q));
  }
  if (filters?.actionType) {
    list = list.filter(e => e.actionType === filters.actionType);
  }
  if (filters?.roleName) {
    list = list.filter(e => e.roleName === filters.roleName);
  }
  if (filters?.dateFrom) {
    list = list.filter(e => e.timestamp.slice(0, 10) >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    list = list.filter(e => e.timestamp.slice(0, 10) <= filters.dateTo!);
  }

  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function simulateLatency(): Promise<void> {
  return new Promise(r => setTimeout(r, 200));
}
