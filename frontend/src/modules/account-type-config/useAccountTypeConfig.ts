import { useState, useEffect } from 'react';
import { accountTypeConfigApi } from './accountTypeConfigApi';
import type { AccountTypeConfigItem, AccountSubTypeConfigItem, UpdateConfigPayload, UpdateSubTypePayload } from './accountTypeConfigApi';

export interface EditForm {
  samPrefix:             string;
  extensionAttribute14:  string;
  targetOU:              string;
  defaultPasswordLength: number;
  descriptionTemplate:   string;
  isActive:              boolean;
}

export interface EditSubTypeForm {
  samPrefix:            string;
  extensionAttribute14: string;
  targetOU:             string;
  isActive:             boolean;
}

function toEditForm(item: AccountTypeConfigItem): EditForm {
  return {
    samPrefix:             item.samPrefix ?? '',
    extensionAttribute14:  item.extensionAttribute14,
    targetOU:              item.targetOU ?? '',
    defaultPasswordLength: item.defaultPasswordLength,
    descriptionTemplate:   item.descriptionTemplate,
    isActive:              item.isActive,
  };
}

function toPayload(form: EditForm): UpdateConfigPayload {
  return {
    samPrefix:             form.samPrefix.trim() || null,
    extensionAttribute14:  form.extensionAttribute14.trim(),
    targetOU:              form.targetOU.trim() || null,
    defaultPasswordLength: form.defaultPasswordLength,
    descriptionTemplate:   form.descriptionTemplate.trim(),
    isActive:              form.isActive,
  };
}

function toSubTypeForm(item: AccountSubTypeConfigItem): EditSubTypeForm {
  return {
    samPrefix:            item.samPrefix,
    extensionAttribute14: item.extensionAttribute14,
    targetOU:             item.targetOU ?? '',
    isActive:             item.isActive,
  };
}

function toSubTypePayload(form: EditSubTypeForm): UpdateSubTypePayload {
  return {
    samPrefix:            form.samPrefix.trim(),
    extensionAttribute14: form.extensionAttribute14.trim(),
    targetOU:             form.targetOU.trim() || null,
    isActive:             form.isActive,
  };
}

export function useAccountTypeConfig() {
  const [configs,           setConfigs]           = useState<AccountTypeConfigItem[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [editingKey,        setEditingKey]        = useState<string | null>(null);
  const [editForm,          setEditForm]          = useState<EditForm | null>(null);
  const [saving,            setSaving]            = useState(false);
  const [saveError,         setSaveError]         = useState<string | null>(null);
  const [editingSubTypeKey, setEditingSubTypeKey] = useState<string | null>(null);
  const [editSubTypeForm,   setEditSubTypeForm]   = useState<EditSubTypeForm | null>(null);
  const [savingSubType,     setSavingSubType]     = useState(false);

  useEffect(() => {
    accountTypeConfigApi.getAll()
      .then(data => setConfigs(data))
      .finally(() => setLoading(false));
  }, []);

  // ── Type config editing ───────────────────────────────────────────────────

  function startEdit(typeKey: string) {
    const item = configs.find(c => c.typeKey === typeKey);
    if (!item) return;
    setEditingKey(typeKey);
    setEditForm(toEditForm(item));
    setSaveError(null);
    setEditingSubTypeKey(null);
    setEditSubTypeForm(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditForm(null);
    setSaveError(null);
  }

  function updateEditField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEditForm(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function saveEdit() {
    if (!editingKey || !editForm) return;

    if (!editForm.extensionAttribute14.trim()) {
      setSaveError('El campo extensionAttribute14 es obligatorio.');
      return;
    }
    if (editForm.defaultPasswordLength < 8 || editForm.defaultPasswordLength > 64) {
      setSaveError('La longitud de contraseña debe estar entre 8 y 64.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await accountTypeConfigApi.update(editingKey, toPayload(editForm));
      setConfigs(prev => prev.map(c => c.typeKey === editingKey ? updated : c));
      setEditingKey(null);
      setEditForm(null);
    } catch {
      setSaveError('Error al guardar los cambios. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // ── Sub-type editing ──────────────────────────────────────────────────────

  function startEditSubType(subTypeKey: string) {
    const privileged = configs.find(c => c.isPrivileged);
    const sub = privileged?.subTypes.find(s => s.subTypeKey === subTypeKey);
    if (!sub) return;
    setEditingSubTypeKey(subTypeKey);
    setEditSubTypeForm(toSubTypeForm(sub));
    setSaveError(null);
    setEditingKey(null);
    setEditForm(null);
  }

  function cancelEditSubType() {
    setEditingSubTypeKey(null);
    setEditSubTypeForm(null);
    setSaveError(null);
  }

  function updateSubTypeField<K extends keyof EditSubTypeForm>(key: K, value: EditSubTypeForm[K]) {
    setEditSubTypeForm(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function saveSubType() {
    if (!editingSubTypeKey || !editSubTypeForm) return;

    if (!editSubTypeForm.samPrefix.trim()) {
      setSaveError('El prefijo SAM es obligatorio para sub-tipos.');
      return;
    }
    if (!editSubTypeForm.extensionAttribute14.trim()) {
      setSaveError('El campo extensionAttribute14 es obligatorio.');
      return;
    }

    setSavingSubType(true);
    setSaveError(null);
    try {
      const updated = await accountTypeConfigApi.updateSubType(
        'PRIVILEGED', editingSubTypeKey, toSubTypePayload(editSubTypeForm),
      );
      setConfigs(prev => prev.map(c =>
        c.isPrivileged
          ? { ...c, subTypes: c.subTypes.map(s => s.subTypeKey === editingSubTypeKey ? updated : s) }
          : c,
      ));
      setEditingSubTypeKey(null);
      setEditSubTypeForm(null);
    } catch {
      setSaveError('Error al guardar el sub-tipo. Intenta de nuevo.');
    } finally {
      setSavingSubType(false);
    }
  }

  return {
    configs,
    loading,
    editingKey,
    editForm,
    saving,
    saveError,
    editingSubTypeKey,
    editSubTypeForm,
    savingSubType,
    startEdit,
    cancelEdit,
    updateEditField,
    saveEdit,
    startEditSubType,
    cancelEditSubType,
    updateSubTypeField,
    saveSubType,
  };
}
