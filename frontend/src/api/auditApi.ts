import { apiFetch } from './apiFetch';
import { MOCK_AUDIT_LOGS, MOCK_USERS } from './mockData';
import type { AuditEntry, AuditFilters, AuditActionType } from '../types/audit';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

// Mock data must never be a silent fallback for a broken/unreachable API — it only
// activates when explicitly opted into via this flag (same convention as
// UserSearchAgent/UserProfileAgent/attributeCatalogApi).
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

// Se pide una página grande al backend (que ya filtra server-side por los
// mismos criterios) y se pagina/filtra el resto client-side, igual que hoy —
// el backend no devuelve totalCount/totalPages, así que no hay forma de
// paginar página-a-página sin perder el conteo total en la UI.
const FETCH_PAGE_SIZE = 200;

function buildQuery(filters?: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters?.targetUser) params.set('targetUser', filters.targetUser);
  if (filters?.actionType) params.set('actionType', filters.actionType);
  if (filters?.roleName)   params.set('roleName', filters.roleName);
  if (filters?.dateFrom)   params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo)     params.set('dateTo', filters.dateTo);
  params.set('page', String(filters?.page ?? 1));
  params.set('pageSize', String(filters?.pageSize ?? FETCH_PAGE_SIZE));
  return params.toString();
}

// ── Mock fallback (solo si VITE_USE_MOCK_DATA=true) ───────────────────────────

function domainFromUsername(username: string): string {
  const user = MOCK_USERS.find(u => u.username === username);
  return user ? (user.email.split('@')[1]?.toUpperCase() ?? 'UNKNOWN') : 'UNKNOWN';
}

function mapMockActionType(action: string): AuditActionType {
  if (action === 'UPDATE_ATTRIBUTE') return 'UpdateField';
  if (action === 'ENABLE_ACCOUNT')   return 'EnableAccount';
  if (action === 'DISABLE_ACCOUNT')  return 'DisableAccount';
  return 'UpdateField';
}

function toMockEntries(filters?: AuditFilters): AuditEntry[] {
  let list: AuditEntry[] = MOCK_AUDIT_LOGS.map(log => ({
    id:          log.id,
    timestamp:   log.timestamp,
    performedBy: log.operatorName,
    roleName:    log.operatorRole,
    actionType:  mapMockActionType(log.action),
    fieldKey:    log.field,
    oldValue:    log.oldValue,
    newValue:    log.newValue,
    targetUser:  log.targetUser,
    domain:      domainFromUsername(log.targetUser),
    success:     log.success,
  }));

  if (filters?.targetUser) {
    const q = filters.targetUser.toLowerCase();
    list = list.filter(e =>
      e.targetUser.toLowerCase().includes(q) || e.performedBy.toLowerCase().includes(q));
  }
  if (filters?.actionType) list = list.filter(e => e.actionType === filters.actionType);
  if (filters?.roleName)   list = list.filter(e => e.roleName === filters.roleName);
  if (filters?.dateFrom)   list = list.filter(e => e.timestamp.slice(0, 10) >= filters.dateFrom!);
  if (filters?.dateTo)     list = list.filter(e => e.timestamp.slice(0, 10) <= filters.dateTo!);

  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAuditEntries(filters?: AuditFilters): Promise<AuditEntry[]> {
  try {
    const res = await apiFetch(`/api/audit?${buildQuery(filters)}`);
    return await (res.json() as Promise<AuditEntry[]>);
  } catch (err) {
    if (MOCK_MODE) return toMockEntries(filters);
    throw err;
  }
}

// Legacy client-side echo used by UserProfileAgent/UserStatusAgent after they perform
// a real AD mutation. It no longer feeds getAuditEntries() (that now reads
// gov.AuditEntries through the real API) — kept only so those callers keep compiling
// and behaving as before. The real audit trail for their actions is whatever their
// own backend call writes server-side, independent of this local echo.
let nextMockId = 200;

export function addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  return { ...entry, id: `ae-${nextMockId++}`, timestamp: new Date().toISOString() };
}
