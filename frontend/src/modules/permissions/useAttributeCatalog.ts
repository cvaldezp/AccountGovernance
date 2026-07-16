import { useCallback, useEffect, useState } from 'react';
import { attributeCatalogApi } from './attributeCatalogApi';
import { BLANK_ATTRIBUTE_FORM, toAttributeForm, validateAttributeForm } from './types';
import type { Attribute, AttributeForm } from './types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useAttributeCatalog() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode,         setMode]        = useState<'create' | 'edit'>('create');
  const [editingKey,   setEditingKey]   = useState<string | null>(null);
  const [form,         setForm]         = useState<AttributeForm>(BLANK_ATTRIBUTE_FORM);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);

  const [statusUpdatingKey, setStatusUpdatingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await attributeCatalogApi.getAll();
      setAttributes(data);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setMode('create');
    setEditingKey(null);
    setForm(BLANK_ATTRIBUTE_FORM);
    setSaveError(null);
    setIsModalOpen(true);
  };

  const openEdit = (attribute: Attribute) => {
    setMode('edit');
    setEditingKey(attribute.fieldKey);
    setForm(toAttributeForm(attribute));
    setSaveError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setSaveError(null);
  };

  const updateField = <K extends keyof AttributeForm>(key: K, value: AttributeForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    const validationError = validateAttributeForm(form, mode);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = mode === 'create'
        ? await attributeCatalogApi.create(form)
        : await attributeCatalogApi.update(editingKey!, form);

      setAttributes(prev => mode === 'create'
        ? [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder)
        : prev.map(a => a.fieldKey === saved.fieldKey ? saved : a));

      setIsModalOpen(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (attribute: Attribute) => {
    setStatusUpdatingKey(attribute.fieldKey);
    try {
      const updated = await attributeCatalogApi.setStatus(attribute.fieldKey, !attribute.isActive);
      setAttributes(prev => prev.map(a => a.fieldKey === updated.fieldKey ? updated : a));
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setStatusUpdatingKey(null);
    }
  };

  return {
    attributes, loading, loadError,
    isModalOpen, mode, form, saving, saveError,
    statusUpdatingKey,
    openCreate, openEdit, closeModal, updateField, save, toggleStatus,
  };
}
