import { useCallback, useEffect, useState } from 'react';
import { permissionsMatrixApi } from './permissionsMatrixApi';
import { accessFromCell, nextAccess } from './types';
import type { PermissionsMatrix } from './types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function cellKey(roleKey: string, fieldKey: string): string {
  return `${roleKey}::${fieldKey}`;
}

export function useMatrixEditor() {
  const [matrix,     setMatrix]     = useState<PermissionsMatrix | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  // Celda actualmente guardándose (bloquea solo esa celda, no la página).
  const [savingCell, setSavingCell] = useState<string | null>(null);
  // Último error de guardado por celda, para mostrarlo junto a esa celda puntual.
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await permissionsMatrixApi.getMatrix();
      setMatrix(data);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cycleCell = async (roleKey: string, fieldKey: string) => {
    if (!matrix) return;
    // SystemAdmin siempre tiene acceso total por regla del backend — el PUT lo
    // rechazaría igual, pero ni siquiera se intenta desde la UI.
    if (roleKey.toLowerCase() === 'systemadmin') return;

    const key = cellKey(roleKey, fieldKey);
    if (savingCell === key) return; // evita doble-click mientras guarda

    const row = matrix.fields.find(f => f.fieldKey === fieldKey);
    if (!row) return;

    const previousCell   = row.byRole[roleKey];
    const previousAccess = accessFromCell(previousCell);
    const optimisticAccess = nextAccess(previousAccess);
    const optimisticCell = {
      canView: optimisticAccess !== 'None',
      canEdit: optimisticAccess === 'Edit',
    };

    setCellErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    setSavingCell(key);
    applyCell(fieldKey, roleKey, optimisticCell);

    try {
      const confirmed = await permissionsMatrixApi.updateCell(roleKey, fieldKey, optimisticAccess);
      applyCell(fieldKey, roleKey, confirmed);
    } catch (err) {
      applyCell(fieldKey, roleKey, previousCell ?? { canView: false, canEdit: false }); // rollback visual
      setCellErrors(prev => ({ ...prev, [key]: errorMessage(err) }));
    } finally {
      setSavingCell(null);
    }
  };

  function applyCell(fieldKey: string, roleKey: string, access: { canView: boolean; canEdit: boolean }) {
    setMatrix(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map(row =>
          row.fieldKey === fieldKey
            ? { ...row, byRole: { ...row.byRole, [roleKey]: access } }
            : row,
        ),
      };
    });
  }

  const isSaving = (roleKey: string, fieldKey: string) => savingCell === cellKey(roleKey, fieldKey);
  const cellError = (roleKey: string, fieldKey: string): string | undefined => cellErrors[cellKey(roleKey, fieldKey)];

  return { matrix, loading, loadError, reload: load, cycleCell, isSaving, cellError };
}
