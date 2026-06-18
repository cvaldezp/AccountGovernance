import type { ADFieldDefinition, FieldType } from '../types';
import { AD_ATTRIBUTE_CATALOG } from './adAttributeCatalog';

// ── App-alias → real LDAP attribute name ─────────────────────────────────────
// The portal uses short aliases as keys in UserAttributes (e.g. 'Oficina') for
// mock compatibility.  This map links each alias to its catalog entry so we can
// derive displayName, description, and isSensitive without duplicating them.

const CATALOG_ALIAS_MAP: Record<string, string> = {
  Oficina:       'physicalDeliveryOfficeName',
  AccountStatus: 'userAccountControl',
};

// ── Builder: pull shared metadata from catalog, add portal-specific fields ────

interface FieldOverrides {
  fieldKey:       string;
  fieldType:      FieldType;
  sortOrder:      number;
  isActive?:      boolean;
  allowedValues?: string[];
  placeholder?:   string;
  // optional overrides for catalog-sourced fields (use sparingly)
  displayName?:   string;
  description?:   string;
  isSensitive?:   boolean;
}

function fromCatalog(appAttributeName: string, overrides: FieldOverrides): ADFieldDefinition {
  const catalogName = CATALOG_ALIAS_MAP[appAttributeName] ?? appAttributeName;
  const entry       = AD_ATTRIBUTE_CATALOG.find(a => a.adAttributeName === catalogName);

  return {
    fieldKey:        overrides.fieldKey,
    adAttributeName: appAttributeName,   // keep app alias for UI compatibility
    displayName:     overrides.displayName  ?? entry?.displayName  ?? appAttributeName,
    description:     overrides.description  ?? entry?.description  ?? '',
    isSensitive:     overrides.isSensitive  ?? entry?.isSensitive  ?? false,
    fieldType:       overrides.fieldType,
    isActive:        overrides.isActive ?? true,
    sortOrder:       overrides.sortOrder,
    allowedValues:   overrides.allowedValues,
    placeholder:     overrides.placeholder,
  };
}

// ── Portal field definitions ──────────────────────────────────────────────────
// Only the 4 fields currently managed by the portal.
// Metadata (displayName, description, isSensitive) is sourced from
// adAttributeCatalog.ts via fromCatalog() — not duplicated here.
// To add a new managed field: add an entry to AD_ATTRIBUTE_CATALOG first,
// then add a fromCatalog() call here, and matching rows in roleFieldPermissions.ts.

export const AD_FIELD_DEFINITIONS: ADFieldDefinition[] = [
  fromCatalog('Custom-External-Email-Address', {
    fieldKey:  'field-ext-email',
    fieldType: 'email',
    sortOrder: 1,
    placeholder: 'usuario@dominio.com',
  }),

  fromCatalog('Oficina', {
    fieldKey:    'field-office',
    fieldType:   'text',
    sortOrder:   2,
    placeholder: 'Ciudad - Edificio / Piso',
    // Catalog entry is physicalDeliveryOfficeName; keep displayName 'Oficina'
    // in the portal context since that's how staff know the field.
    displayName: 'Oficina',
  }),

  fromCatalog('telephoneNumber', {
    fieldKey:    'field-telephone',
    fieldType:   'text',
    sortOrder:   3,
    placeholder: '+593 2 000-0000',
    displayName: 'Teléfono',
  }),

  fromCatalog('AccountStatus', {
    fieldKey:      'field-account-status',
    fieldType:     'select',
    sortOrder:     4,
    allowedValues: ['Enabled', 'Disabled'],
    // Catalog entry is userAccountControl (technical flags description).
    // Override with a user-friendly portal description.
    displayName:  'Estado de Cuenta',
    description:  'Controla si el usuario puede autenticarse en los sistemas institucionales. Solo roles autorizados pueden modificarlo.',
    isSensitive:  true,
  }),
];
