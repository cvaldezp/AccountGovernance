import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuditEntries } from '../../api/auditApi';
import type { AuditEntry, AuditActionType } from '../../types/audit';
import type { RoleName } from '../../types';

export const PAGE_SIZE = 10;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useAudit() {
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [page,       setPage]       = useState(0);

  const [filterUser,     setFilterUser]     = useState('');
  const [filterAction,   setFilterAction]   = useState<AuditActionType | ''>('');
  const [filterRole,     setFilterRole]     = useState<RoleName | ''>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // targetUser no se manda al backend aquí a propósito: el filtro de texto
      // también matchea performedBy (operador), algo que el backend no soporta
      // (su LIKE solo cubre TargetUser) — se resuelve client-side más abajo.
      const data = await getAuditEntries({
        actionType: filterAction || undefined,
        roleName:   filterRole || undefined,
        dateFrom:   filterDateFrom || undefined,
        dateTo:     filterDateTo || undefined,
      });
      setAllEntries(data);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterRole, filterDateFrom, filterDateTo]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let list = allEntries;
    if (filterUser) {
      const q = filterUser.toLowerCase();
      list = list.filter(e =>
        e.targetUser.toLowerCase().includes(q) ||
        e.performedBy.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allEntries, filterUser]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const resetPage  = () => setPage(0);

  const handleClear = () => {
    setFilterUser(''); setFilterAction(''); setFilterRole('');
    setFilterDateFrom(''); setFilterDateTo('');
    setPage(0);
  };

  const hasFilters = !!(filterUser || filterAction || filterRole || filterDateFrom || filterDateTo);

  return {
    loading, loadError, reload: load,
    filtered, pageData, page, setPage, totalPages, resetPage,
    filterUser, setFilterUser,
    filterAction, setFilterAction,
    filterRole, setFilterRole,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    handleClear, hasFilters,
  };
}
