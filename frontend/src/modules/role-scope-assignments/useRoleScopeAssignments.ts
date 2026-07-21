import { useCallback, useEffect, useState } from 'react';
import { roleScopeAssignmentsApi, mapAssignmentErrorToMessage } from './roleScopeAssignmentsApi';
import type { RoleScopeAssignment } from './types';

// Fuente única de datos para RoleScopeAssignment — consumida desde dos
// superficies: administración primaria en "Roles y Grupos"
// (SystemRolesConfigPage) y referencia cruzada de solo lectura en "Ámbitos
// Administrativos" (AdministrativeScopesPage). Un solo hook evita mantener
// dos copias de la misma lógica de mutación — pedido explícito de diseño.
export function useRoleScopeAssignments() {
  const [assignments, setAssignments] = useState<RoleScopeAssignment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  const [creatingForRole, setCreatingForRole] = useState<string | null>(null);
  const [createScopeKey,   setCreateScopeKey]   = useState('');
  const [saving,            setSaving]            = useState(false);
  const [createError,       setCreateError]       = useState<string | null>(null);

  const [togglingId,  setTogglingId]  = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // loading arranca en true por el useState inicial y solo se apaga en el
  // finally (nunca se vuelve a poner en true) — así una recarga en segundo
  // plano tras una mutación no vuelve a mostrar el spinner de página completa.
  const load = useCallback(async () => {
    try {
      const data = await roleScopeAssignmentsApi.getAll();
      setAssignments(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(mapAssignmentErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // react-hooks/set-state-in-effect: mismo falso positivo documentado en
  // useAdministrativeScopes.ts — se suprime acá de forma explícita.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const assignmentsByRole  = (roleKey: string) => assignments.filter(a => a.roleKey === roleKey);
  const scopesByRole       = (scopeKey: string) => assignments.filter(a => a.scopeKey === scopeKey);

  // ── Crear asignación ─────────────────────────────────────────────────────

  const openCreate = (roleKey: string) => {
    setCreatingForRole(roleKey);
    setCreateScopeKey('');
    setCreateError(null);
  };

  const cancelCreate = () => {
    if (saving) return; // impide cerrar (y reenviar) mientras hay un POST en curso
    setCreatingForRole(null);
    setCreateScopeKey('');
    setCreateError(null);
  };

  const saveCreate = async () => {
    if (!creatingForRole || saving) return; // impide doble envío (ej. doble click)
    if (!createScopeKey) {
      setCreateError('Selecciona un ámbito.');
      return;
    }

    setSaving(true);
    setCreateError(null);
    try {
      await roleScopeAssignmentsApi.create({ roleKey: creatingForRole, scopeKey: createScopeKey });
      await load();
      setCreatingForRole(null);
      setCreateScopeKey('');
    } catch (err) {
      setCreateError(mapAssignmentErrorToMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Activar / inactivar ──────────────────────────────────────────────────

  const toggleStatus = async (assignment: RoleScopeAssignment) => {
    if (togglingId !== null) return;
    setTogglingId(assignment.id);
    setToggleError(null);
    try {
      await roleScopeAssignmentsApi.setStatus(assignment.id, !assignment.isActive);
      await load();
    } catch (err) {
      setToggleError(mapAssignmentErrorToMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  return {
    assignments, loading, loadError,
    assignmentsByRole, scopesByRole,

    creatingForRole, createScopeKey, setCreateScopeKey, saving, createError,
    openCreate, cancelCreate, saveCreate,

    togglingId, toggleError, toggleStatus,
  };
}
