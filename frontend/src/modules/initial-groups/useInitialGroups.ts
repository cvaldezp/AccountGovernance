import { useState, useEffect, useCallback } from 'react';
import { initialGroupsApi } from './initialGroupsApi';
import type { InitialGroup, CreateGroupForm, AdGroupValidation } from './types';
import { BLANK_GROUP_FORM } from './types';

type ScopeKey = string; // "{typeKey}" or "{typeKey}|{subTypeKey}"

export function useInitialGroups() {
  const [groups,  setGroups]  = useState<InitialGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope,   setScope]   = useState<{ typeKey: string; subTypeKey?: string } | null>(null);

  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editForm,    setEditForm]    = useState<CreateGroupForm>(BLANK_GROUP_FORM);
  const [addForm,     setAddForm]     = useState<CreateGroupForm>(BLANK_GROUP_FORM);
  const [showAddForm, setShowAddForm] = useState(false);

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [adValidation, setAdValidation]   = useState<AdGroupValidation | null>(null);
  const [validating,   setValidating]     = useState(false);
  const [addAdValidation, setAddAdValidation] = useState<AdGroupValidation | null>(null);
  const [addValidating,   setAddValidating]   = useState(false);

  const loadGroups = useCallback(async (typeKey: string, subTypeKey?: string) => {
    setLoading(true);
    try {
      const data = await initialGroupsApi.getGroups(typeKey, subTypeKey);
      setGroups(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectScope = useCallback((typeKey: string, subTypeKey?: string) => {
    setScope({ typeKey, subTypeKey });
    setEditingId(null);
    setShowAddForm(false);
    setAdValidation(null);
    setAddAdValidation(null);
    setSaveError(null);
    loadGroups(typeKey, subTypeKey);
  }, [loadGroups]);

  const startEdit = (group: InitialGroup) => {
    setEditingId(group.id);
    setEditForm({
      groupName:       group.groupName,
      groupDn:         group.groupDn,
      groupObjectGuid: group.groupObjectGuid ?? '',
      groupSid:        group.groupSid ?? '',
      isCritical:      group.isCritical,
      isActive:        group.isActive,
      sortOrder:       group.sortOrder,
    });
    setAdValidation(null);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAdValidation(null);
    setSaveError(null);
  };

  const updateEditField = <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => {
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const validateEditGroup = async () => {
    if (!editForm.groupDn.trim() && !editForm.groupName.trim()) return;
    setValidating(true);
    setAdValidation(null);
    try {
      const result = await initialGroupsApi.validateAdGroup(editForm.groupDn.trim() || editForm.groupName.trim());
      setAdValidation(result);
      if (result.isValid && result.groupName && !editForm.groupName) {
        setEditForm(prev => ({
          ...prev,
          groupName:       result.groupName ?? prev.groupName,
          groupObjectGuid: result.objectGuid ?? prev.groupObjectGuid,
          groupSid:        result.sid ?? prev.groupSid,
        }));
      }
    } finally {
      setValidating(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || !scope) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await initialGroupsApi.updateGroup(editingId, editForm);
      setGroups(prev => prev.map(g => g.id === editingId ? updated : g));
      setEditingId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (id: number) => {
    if (!scope) return;
    try {
      await initialGroupsApi.deleteGroup(id);
      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  // ── Add form ──────────────────────────────────────────────────────────────

  const openAddForm = () => {
    setAddForm(BLANK_GROUP_FORM);
    setAddAdValidation(null);
    setShowAddForm(true);
    setSaveError(null);
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setAddAdValidation(null);
    setSaveError(null);
  };

  const updateAddField = <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => {
    setAddForm(prev => ({ ...prev, [key]: value }));
  };

  const validateAddGroup = async () => {
    if (!addForm.groupDn.trim() && !addForm.groupName.trim()) return;
    setAddValidating(true);
    setAddAdValidation(null);
    try {
      const result = await initialGroupsApi.validateAdGroup(addForm.groupDn.trim() || addForm.groupName.trim());
      setAddAdValidation(result);
      if (result.isValid) {
        setAddForm(prev => ({
          ...prev,
          groupName:       result.groupName ?? prev.groupName,
          groupDn:         result.dn ?? prev.groupDn,
          groupObjectGuid: result.objectGuid ?? prev.groupObjectGuid,
          groupSid:        result.sid ?? prev.groupSid,
        }));
      }
    } finally {
      setAddValidating(false);
    }
  };

  const saveAdd = async () => {
    if (!scope) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await initialGroupsApi.createGroup(scope.typeKey, scope.subTypeKey, addForm);
      setGroups(prev => [...prev, created]);
      setShowAddForm(false);
      setAddForm(BLANK_GROUP_FORM);
      setAddAdValidation(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return {
    groups, loading, scope, selectScope,
    editingId, editForm, saving, saveError,
    adValidation, validating,
    startEdit, cancelEdit, updateEditField, validateEditGroup, saveEdit, deleteGroup,
    showAddForm, addForm, addAdValidation, addValidating,
    openAddForm, cancelAdd, updateAddField, validateAddGroup, saveAdd,
  };
}
