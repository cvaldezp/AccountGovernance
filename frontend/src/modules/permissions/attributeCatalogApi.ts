import { apiFetch } from '../../api/apiFetch';
import { AD_ATTRIBUTE_CATALOG } from '../../config/adAttributeCatalog';
import type { Attribute, AttributeForm } from './types';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

// Mock data must never be a silent fallback for a broken/unreachable API — it only
// activates when explicitly opted into via this flag (same convention as
// UserSearchAgent/UserProfileAgent). Any other failure (network down, SQL down,
// a real HTTP error from the API) must surface as a real error to the user.
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

function toMockAttributes(): Attribute[] {
  return AD_ATTRIBUTE_CATALOG.map((entry, index) => ({
    fieldKey:        entry.key,
    adAttributeName: entry.adAttributeName,
    displayName:     entry.displayName,
    description:     entry.description,
    fieldType:       'Text',
    category:        entry.category,
    dataType:        entry.dataType,
    isSensitive:     entry.isSensitive,
    requiresAudit:   entry.requiresAudit,
    isActive:        true,
    sortOrder:       index,
    allowedValues:   null,
    placeholder:     null,
    createdBy:       null,
    updatedBy:       null,
    createdAt:       new Date(0).toISOString(),
    updatedAt:       new Date(0).toISOString(),
  }));
}

function toPayload(form: AttributeForm) {
  return {
    adAttributeName: form.adAttributeName.trim(),
    displayName:     form.displayName.trim(),
    description:     form.description.trim() || null,
    fieldType:       form.fieldType,
    category:        form.category.trim() || null,
    dataType:        form.dataType.trim() || null,
    isSensitive:     form.isSensitive,
    requiresAudit:   form.requiresAudit,
    sortOrder:       form.sortOrder,
    allowedValues:   form.allowedValues.trim()
      ? form.allowedValues.split(',').map(v => v.trim()).filter(Boolean)
      : null,
    placeholder:     form.placeholder.trim() || null,
  };
}

export const attributeCatalogApi = {
  async getAll(): Promise<Attribute[]> {
    try {
      const res = await apiFetch('/api/permissions/attributes');
      return await (res.json() as Promise<Attribute[]>);
    } catch (err) {
      if (MOCK_MODE) return toMockAttributes();
      throw err;
    }
  },

  async create(form: AttributeForm): Promise<Attribute> {
    const res = await apiFetch('/api/permissions/attributes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fieldKey: form.fieldKey.trim(), ...toPayload(form) }),
    });
    return res.json() as Promise<Attribute>;
  },

  async update(fieldKey: string, form: AttributeForm): Promise<Attribute> {
    const res = await apiFetch(`/api/permissions/attributes/${fieldKey}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(toPayload(form)),
    });
    return res.json() as Promise<Attribute>;
  },

  async setStatus(fieldKey: string, isActive: boolean): Promise<Attribute> {
    const res = await apiFetch(`/api/permissions/attributes/${fieldKey}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive }),
    });
    return res.json() as Promise<Attribute>;
  },
};
