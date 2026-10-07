import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/apiFetch';
import { roleAccessApi } from './roleAccessApi';
import type { RoleAccessMatrix } from './roleAccessApi';

function cellKey(roleKey: string, resourceKey: string): string {
  return `${roleKey}::${resourceKey}`;
}

/** Mismo patrón que useMatrixEditor: actualización optimista por celda, rollback si falla. */
export function useRoleAccess() {
  const [matrix,     setMatrix]     = useState<RoleAccessMatrix | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setMatrix(await roleAccessApi.getMatrix());
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isGranted = (roleKey: string, resourceKey: string): boolean =>
    matrix?.grants.some(g => g.roleKey === roleKey && g.resourceKey === resourceKey) ?? false;

  function applyGrant(roleKey: string, resourceKey: string, granted: boolean) {
    setMatrix(prev => {
      if (!prev) return prev;
      const others = prev.grants.filter(g => !(g.roleKey === roleKey && g.resourceKey === resourceKey));
      return { ...prev, grants: granted ? [...others, { roleKey, resourceKey }] : others };
    });
  }

  const toggle = async (roleKey: string, resourceKey: string) => {
    if (!matrix) return;
    const key = cellKey(roleKey, resourceKey);
    if (savingCell === key) return; // evita doble click mientras guarda

    const previous = isGranted(roleKey, resourceKey);
    setCellErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    setSavingCell(key);
    applyGrant(roleKey, resourceKey, !previous);

    try {
      const confirmed = await roleAccessApi.setAccess(roleKey, resourceKey, !previous);
      applyGrant(roleKey, resourceKey, confirmed.granted);
    } catch (err) {
      applyGrant(roleKey, resourceKey, previous); // rollback visual
      setCellErrors(prev => ({ ...prev, [key]: errorMessage(err) }));
    } finally {
      setSavingCell(null);
    }
  };

  const isSaving  = (roleKey: string, resourceKey: string) => savingCell === cellKey(roleKey, resourceKey);
  const cellError = (roleKey: string, resourceKey: string): string | undefined => cellErrors[cellKey(roleKey, resourceKey)];

  return { matrix, loading, loadError, reload: load, isGranted, toggle, isSaving, cellError };
}
