import { useCallback, useEffect, useState } from 'react';
import { administrativeScopesApi, mapScopeErrorToMessage } from './administrativeScopesApi';
import {
  BLANK_CREATE_SCOPE_FORM, BLANK_FILTER_FORM,
  toUpdateScopeForm, toFilterForm,
  validateCreateScopeForm, validateUpdateScopeForm, validateFilterForm,
} from './types';
import type {
  AdministrativeScope, AdministrativeScopeFilter,
  CreateScopeForm, UpdateScopeForm, FilterForm,
} from './types';

// Tras cada Create/Update/cambio de estado/Delete se recarga la lista desde la
// API (en vez de parchear el estado local a mano) — pedido explícito de
// diseño: es la fuente de verdad real y evita mantener dos copias del mismo
// dato. El Scope/Filter seleccionado se deriva del array recién cargado, no
// se guarda como copia separada.
export function useAdministrativeScopes() {
  const [scopes,    setScopes]    = useState<AdministrativeScope[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm,         setCreateForm]         = useState<CreateScopeForm>(BLANK_CREATE_SCOPE_FORM);
  const [creating,           setCreating]           = useState(false);
  const [createError,        setCreateError]        = useState<string | null>(null);

  const [editingScope,   setEditingScope]   = useState(false);
  const [scopeForm,       setScopeForm]       = useState<UpdateScopeForm | null>(null);
  const [savingScope,     setSavingScope]     = useState(false);
  const [scopeSaveError,  setScopeSaveError]  = useState<string | null>(null);

  const [togglingStatus, setTogglingStatus] = useState(false);
  const [statusError,    setStatusError]    = useState<string | null>(null);

  const [editingFilterId, setEditingFilterId] = useState<number | null>(null);
  const [filterForm,        setFilterForm]        = useState<FilterForm>(BLANK_FILTER_FORM);
  const [savingFilter,      setSavingFilter]      = useState(false);
  const [filterSaveError,   setFilterSaveError]   = useState<string | null>(null);

  const [addingFilter,    setAddingFilter]    = useState(false);
  const [addFilterForm,    setAddFilterForm]    = useState<FilterForm>(BLANK_FILTER_FORM);
  const [savingAddFilter,  setSavingAddFilter]  = useState(false);
  const [addFilterError,   setAddFilterError]   = useState<string | null>(null);

  const [confirmDeleteFilterId, setConfirmDeleteFilterId] = useState<number | null>(null);
  const [deletingFilterId,       setDeletingFilterId]       = useState<number | null>(null);

  // loading arranca en true por el useState inicial y solo se apaga en el
  // finally (nunca se vuelve a poner en true) — así una recarga en segundo
  // plano tras una mutación no vuelve a mostrar el spinner de página completa,
  // evitando parpadeo de la lista.
  const load = useCallback(async () => {
    try {
      const data = await administrativeScopesApi.getAll();
      setScopes(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(mapScopeErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // react-hooks/set-state-in-effect: falso positivo ya presente sin resolver en
  // useSystemRoles.ts/useAttributeCatalog.ts/useAudit.ts (mismo patrón exacto de
  // carga inicial al montar) — la regla no distingue que ningún setState corre
  // de forma síncrona antes del primer await dentro de load(), solo detecta que
  // la función invocada termina llamando setState en algún punto. Se suprime
  // acá de forma explícita y documentada, a diferencia de los otros archivos
  // donde el error simplemente queda sin atender.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selectedScope = scopes.find(s => s.scopeKey === selectedScopeKey) ?? null;

  const selectScope = (scopeKey: string) => {
    setSelectedScopeKey(scopeKey);
    setEditingScope(false);
    setScopeForm(null);
    setScopeSaveError(null);
    setStatusError(null);
    cancelEditFilter();
    cancelAddFilter();
  };

  // ── Crear Scope ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setCreateForm(BLANK_CREATE_SCOPE_FORM);
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating) return; // impide cerrar (y reenviar) mientras hay un POST en curso
    setIsCreateModalOpen(false);
    setCreateError(null);
  };

  const updateCreateField = <K extends keyof CreateScopeForm>(key: K, value: CreateScopeForm[K]) => {
    setCreateForm(prev => ({ ...prev, [key]: value }));
  };

  const saveCreate = async () => {
    if (creating) return; // impide doble envío (ej. doble click)
    const validationError = validateCreateScopeForm(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await administrativeScopesApi.create(createForm);
      await load();
      setSelectedScopeKey(created.scopeKey); // mantener seleccionado el ámbito recién creado
      setIsCreateModalOpen(false);
    } catch (err) {
      setCreateError(mapScopeErrorToMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // ── Editar información general ───────────────────────────────────────────

  const startEditScope = () => {
    if (!selectedScope) return;
    setScopeForm(toUpdateScopeForm(selectedScope));
    setScopeSaveError(null);
    setEditingScope(true);
  };

  const cancelEditScope = () => {
    setEditingScope(false);
    setScopeForm(null);
    setScopeSaveError(null);
  };

  const updateScopeField = <K extends keyof UpdateScopeForm>(key: K, value: UpdateScopeForm[K]) => {
    setScopeForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const saveScope = async () => {
    if (!selectedScope || !scopeForm || savingScope) return;
    const validationError = validateUpdateScopeForm(scopeForm);
    if (validationError) {
      setScopeSaveError(validationError);
      return;
    }

    setSavingScope(true);
    setScopeSaveError(null);
    try {
      await administrativeScopesApi.update(selectedScope.scopeKey, scopeForm);
      await load();
      setEditingScope(false);
      setScopeForm(null);
    } catch (err) {
      setScopeSaveError(mapScopeErrorToMessage(err));
    } finally {
      setSavingScope(false);
    }
  };

  // ── Activar / inactivar ──────────────────────────────────────────────────

  const toggleScopeStatus = async () => {
    if (!selectedScope || togglingStatus) return;
    setTogglingStatus(true);
    setStatusError(null);
    try {
      await administrativeScopesApi.setStatus(selectedScope.scopeKey, !selectedScope.isActive);
      await load();
    } catch (err) {
      setStatusError(mapScopeErrorToMessage(err));
    } finally {
      setTogglingStatus(false);
    }
  };

  // ── Editar filtro existente ──────────────────────────────────────────────

  const startEditFilter = (filter: AdministrativeScopeFilter) => {
    setEditingFilterId(filter.id);
    setFilterForm(toFilterForm(filter));
    setFilterSaveError(null);
  };

  function cancelEditFilter() {
    setEditingFilterId(null);
    setFilterForm(BLANK_FILTER_FORM);
    setFilterSaveError(null);
  }

  const updateFilterField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => {
    setFilterForm(prev => {
      const next = { ...prev, [key]: value };
      // Al elegir Exists se limpia el valor — no tiene sentido mostrarlo ni enviarlo.
      if (key === 'operator' && value === 'Exists') next.value = '';
      return next;
    });
  };

  const saveEditFilter = async () => {
    if (!selectedScope || editingFilterId === null || savingFilter) return;
    const validationError = validateFilterForm(filterForm);
    if (validationError) {
      setFilterSaveError(validationError);
      return;
    }

    setSavingFilter(true);
    setFilterSaveError(null);
    try {
      await administrativeScopesApi.updateFilter(selectedScope.scopeKey, editingFilterId, filterForm);
      await load();
      cancelEditFilter();
    } catch (err) {
      setFilterSaveError(mapScopeErrorToMessage(err));
    } finally {
      setSavingFilter(false);
    }
  };

  // ── Agregar filtro ───────────────────────────────────────────────────────

  const openAddFilter = () => {
    setAddFilterForm(BLANK_FILTER_FORM);
    setAddFilterError(null);
    setAddingFilter(true);
  };

  function cancelAddFilter() {
    setAddingFilter(false);
    setAddFilterForm(BLANK_FILTER_FORM);
    setAddFilterError(null);
  }

  const updateAddFilterField = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => {
    setAddFilterForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'operator' && value === 'Exists') next.value = '';
      return next;
    });
  };

  const saveAddFilter = async () => {
    if (!selectedScope || savingAddFilter) return;
    const validationError = validateFilterForm(addFilterForm);
    if (validationError) {
      setAddFilterError(validationError);
      return;
    }

    setSavingAddFilter(true);
    setAddFilterError(null);
    try {
      await administrativeScopesApi.createFilter(selectedScope.scopeKey, addFilterForm);
      await load();
      cancelAddFilter();
    } catch (err) {
      setAddFilterError(mapScopeErrorToMessage(err));
    } finally {
      setSavingAddFilter(false);
    }
  };

  // ── Eliminar filtro ───────────────────────────────────────────────────────

  const requestDeleteFilter = (filterId: number) => setConfirmDeleteFilterId(filterId);
  const cancelDeleteFilter  = () => setConfirmDeleteFilterId(null);

  const confirmDeleteFilter = async () => {
    if (!selectedScope || confirmDeleteFilterId === null || deletingFilterId !== null) return;
    const filterId = confirmDeleteFilterId;
    setDeletingFilterId(filterId);
    setConfirmDeleteFilterId(null);
    try {
      await administrativeScopesApi.deleteFilter(selectedScope.scopeKey, filterId);
      await load();
    } catch (err) {
      setFilterSaveError(mapScopeErrorToMessage(err));
    } finally {
      setDeletingFilterId(null);
    }
  };

  return {
    scopes, loading, loadError, selectedScope,
    selectScope,

    isCreateModalOpen, createForm, creating, createError,
    openCreateModal, closeCreateModal, updateCreateField, saveCreate,

    editingScope, scopeForm, savingScope, scopeSaveError,
    startEditScope, cancelEditScope, updateScopeField, saveScope,

    togglingStatus, statusError, toggleScopeStatus,

    editingFilterId, filterForm, savingFilter, filterSaveError,
    startEditFilter, cancelEditFilter, updateFilterField, saveEditFilter,

    addingFilter, addFilterForm, savingAddFilter, addFilterError,
    openAddFilter, cancelAddFilter, updateAddFilterField, saveAddFilter,

    confirmDeleteFilterId, deletingFilterId,
    requestDeleteFilter, cancelDeleteFilter, confirmDeleteFilter,
  };
}
