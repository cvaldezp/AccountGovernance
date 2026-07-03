import { useCallback, useEffect, useState } from 'react';
import { systemRolesApi } from './systemRolesApi';
import type { AdGroupValidation, CreateGroupForm, SystemRole, UpdateRoleForm } from './types';
import { BLANK_GROUP_FORM } from './types';

function toRoleForm(role: SystemRole): UpdateRoleForm {
  return {
    displayName: role.displayName,
    description: role.description ?? '',
    priority:    role.priority,
    isActive:    role.isActive,
  };
}

export function useSystemRoles() {
  const [roles,     setRoles]     = useState<SystemRole[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [roleForm,        setRoleForm]        = useState<UpdateRoleForm | null>(null);
  const [savingRole,      setSavingRole]      = useState(false);
  const [roleSaveError,   setRoleSaveError]   = useState<string | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupForm,       setGroupForm]       = useState<CreateGroupForm>(BLANK_GROUP_FORM);
  const [groupValidation, setGroupValidation] = useState<AdGroupValidation | null>(null);
  const [validatingGroup, setValidatingGroup] = useState(false);
  const [savingGroup,     setSavingGroup]     = useState(false);
  const [groupSaveError,  setGroupSaveError]  = useState<string | null>(null);

  const [addingGroupForRole, setAddingGroupForRole] = useState<string | null>(null);
  const [addGroupForm,        setAddGroupForm]        = useState<CreateGroupForm>(BLANK_GROUP_FORM);
  const [addGroupValidation,  setAddGroupValidation]  = useState<AdGroupValidation | null>(null);
  const [addValidatingGroup,  setAddValidatingGroup]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await systemRolesApi.getAll();
      setRoles(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Role fields ──────────────────────────────────────────────────────────

  const startEditRole = (role: SystemRole) => {
    setEditingRoleKey(role.roleKey);
    setRoleForm(toRoleForm(role));
    setRoleSaveError(null);
  };

  const cancelEditRole = () => {
    setEditingRoleKey(null);
    setRoleForm(null);
    setRoleSaveError(null);
  };

  const updateRoleField = <K extends keyof UpdateRoleForm>(key: K, value: UpdateRoleForm[K]) => {
    setRoleForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const saveRole = async () => {
    if (!editingRoleKey || !roleForm) return;
    setSavingRole(true);
    setRoleSaveError(null);
    try {
      const updated = await systemRolesApi.updateRole(editingRoleKey, roleForm);
      setRoles(prev => prev.map(r => r.roleKey === editingRoleKey ? updated : r));
      setEditingRoleKey(null);
      setRoleForm(null);
    } catch (err) {
      setRoleSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingRole(false);
    }
  };

  // ── Group edit ───────────────────────────────────────────────────────────

  const startEditGroup = (group: SystemRole['groups'][number]) => {
    setEditingGroupId(group.id);
    setGroupForm({
      query:           group.groupName,
      groupName:       group.groupName,
      groupDn:         group.groupDn,
      groupObjectGuid: group.groupObjectGuid ?? '',
      groupSid:        group.groupSid ?? '',
      isActive:        group.isActive,
    });
    // This group was already validated against AD when it was created — show its
    // known-good data immediately instead of forcing a redundant re-validation.
    // Changing the search box (updateGroupQuery) clears this and requires re-validating.
    setGroupValidation({
      isValid: true, groupName: group.groupName, dn: group.groupDn,
      objectGuid: group.groupObjectGuid, sid: group.groupSid, isSecurity: true, error: null,
    });
    setGroupSaveError(null);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setGroupValidation(null);
    setGroupSaveError(null);
  };

  // The "Grupo AD" search box is the only manually-typed field — editing it invalidates
  // whatever was previously confirmed, so Guardar stays disabled until Validar succeeds again.
  const updateGroupQuery = (value: string) => {
    setGroupForm(prev => ({
      ...prev, query: value, groupName: '', groupDn: '', groupObjectGuid: '', groupSid: '',
    }));
    setGroupValidation(null);
  };

  const updateGroupField = <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => {
    setGroupForm(prev => ({ ...prev, [key]: value }));
  };

  const validateEditGroup = async () => {
    const query = groupForm.query.trim();
    if (!query) return;
    setValidatingGroup(true);
    setGroupValidation(null);
    try {
      const result = await systemRolesApi.validateAdGroup(query);
      setGroupValidation(result);
      if (result.isValid) {
        setGroupForm(prev => ({
          ...prev,
          groupName:       result.groupName ?? prev.groupName,
          groupDn:         result.dn ?? prev.groupDn,
          groupObjectGuid: result.objectGuid ?? prev.groupObjectGuid,
          groupSid:        result.sid ?? prev.groupSid,
        }));
      }
    } finally {
      setValidatingGroup(false);
    }
  };

  const saveEditGroup = async (roleKey: string) => {
    if (editingGroupId === null || !groupValidation?.isValid) return;
    setSavingGroup(true);
    setGroupSaveError(null);
    try {
      const updated = await systemRolesApi.updateGroup(roleKey, editingGroupId, groupForm);
      setRoles(prev => prev.map(r => r.roleKey === roleKey
        ? { ...r, groups: r.groups.map(g => g.id === editingGroupId ? updated as typeof g : g) }
        : r));
      setEditingGroupId(null);
    } catch (err) {
      setGroupSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (roleKey: string, id: number) => {
    try {
      await systemRolesApi.deleteGroup(roleKey, id);
      setRoles(prev => prev.map(r => r.roleKey === roleKey
        ? { ...r, groups: r.groups.filter(g => g.id !== id) }
        : r));
    } catch (err) {
      setGroupSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  // ── Group add ────────────────────────────────────────────────────────────

  const openAddGroup = (roleKey: string) => {
    setAddingGroupForRole(roleKey);
    setAddGroupForm(BLANK_GROUP_FORM);
    setAddGroupValidation(null);
    setGroupSaveError(null);
  };

  const cancelAddGroup = () => {
    setAddingGroupForRole(null);
    setAddGroupValidation(null);
  };

  const updateAddGroupQuery = (value: string) => {
    setAddGroupForm(prev => ({
      ...prev, query: value, groupName: '', groupDn: '', groupObjectGuid: '', groupSid: '',
    }));
    setAddGroupValidation(null);
  };

  const updateAddGroupField = <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => {
    setAddGroupForm(prev => ({ ...prev, [key]: value }));
  };

  const validateAddGroup = async () => {
    const query = addGroupForm.query.trim();
    if (!query) return;
    setAddValidatingGroup(true);
    setAddGroupValidation(null);
    try {
      const result = await systemRolesApi.validateAdGroup(query);
      setAddGroupValidation(result);
      if (result.isValid) {
        setAddGroupForm(prev => ({
          ...prev,
          groupName:       result.groupName ?? prev.groupName,
          groupDn:         result.dn ?? prev.groupDn,
          groupObjectGuid: result.objectGuid ?? prev.groupObjectGuid,
          groupSid:        result.sid ?? prev.groupSid,
        }));
      }
    } finally {
      setAddValidatingGroup(false);
    }
  };

  const saveAddGroup = async () => {
    if (!addingGroupForRole || !addGroupValidation?.isValid) return;
    setSavingGroup(true);
    setGroupSaveError(null);
    try {
      const created = await systemRolesApi.createGroup(addingGroupForRole, addGroupForm);
      setRoles(prev => prev.map(r => r.roleKey === addingGroupForRole
        ? { ...r, groups: [...r.groups, created as SystemRole['groups'][number]] }
        : r));
      setAddingGroupForRole(null);
      setAddGroupForm(BLANK_GROUP_FORM);
    } catch (err) {
      setGroupSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingGroup(false);
    }
  };

  return {
    roles, loading, loadError, reload: load,
    editingRoleKey, roleForm, savingRole, roleSaveError,
    startEditRole, cancelEditRole, updateRoleField, saveRole,
    editingGroupId, groupForm, groupValidation, validatingGroup, savingGroup, groupSaveError,
    startEditGroup, cancelEditGroup, updateGroupField, updateGroupQuery, validateEditGroup, saveEditGroup, deleteGroup,
    addingGroupForRole, addGroupForm, addGroupValidation, addValidatingGroup,
    openAddGroup, cancelAddGroup, updateAddGroupField, updateAddGroupQuery, validateAddGroup, saveAddGroup,
  };
}
