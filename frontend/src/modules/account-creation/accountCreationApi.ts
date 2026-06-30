import { computePreview } from './accountTypes';
import type {
  AccountTypeInfo, AccountTypeKey, AccountSubTypeInfo, AccountSubTypeKey,
  AccountFormData, AccountPreviewData, ValidationResult, CreateResult,
} from './types';

// ── Mock fallback — read-only data only ────────────────────────────────────────
// Used exclusively by getAccountTypes() so the type selector works offline.
// Mutating operations (validate-create, create) never fall back to mock.

const MOCK_ACCOUNT_TYPES: AccountTypeInfo[] = [
  {
    key: 'GENERIC',    label: 'Genérica',    description: 'Usuarios internos estándar',
    badge: 'GEN', extensionAttribute14: 'Genérica', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'Genérica', departmentPrefix: 'GEN', subTypes: [],
  },
  {
    key: 'PARTNER',    label: 'Partner',     description: 'Socios externos o proveedores',
    badge: 'PTR', extensionAttribute14: 'PARTNERS', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'PARTNERS', departmentPrefix: 'PART', subTypes: [],
  },
  {
    key: 'SERVICE',    label: 'Servicio',    description: 'Servicios o aplicaciones',
    badge: 'SVC', extensionAttribute14: 'SERVICES', isPrivileged: false, defaultPasswordLength: 20,
    defaultCompany: 'USFQ', descriptionTemplate: 'SERVICES', departmentPrefix: 'SVC', subTypes: [],
  },
  {
    key: 'EXTENSION',  label: 'Extensión',   description: 'Extensión de usuario existente',
    badge: 'EXT', extensionAttribute14: 'EXTENSION', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'EXTENSION', departmentPrefix: 'EXT', subTypes: [],
  },
  {
    key: 'PRIVILEGED', label: 'Privilegiada', description: 'Cuentas con acceso elevado — selecciona el sub-tipo',
    badge: 'PRV', extensionAttribute14: 'PRIVILEGED', isPrivileged: true, defaultPasswordLength: 20,
    defaultCompany: 'USFQ', descriptionTemplate: 'PRIVILEGED', departmentPrefix: 'PRV',
    subTypes: [
      { key: 'OPERACIONES',    label: 'Operaciones',    samPrefix: 'op',    extensionAttribute14: 'PRIV_OP',  targetOU: 'OU=Privilegiadas,OU=Operaciones,DC=usfq,DC=edu,DC=ec',    isActive: true },
      { key: 'INFRAESTRUCTURA',label: 'Infraestructura',samPrefix: 'sa',    extensionAttribute14: 'PRIV_SA',  targetOU: 'OU=Privilegiadas,OU=Infraestructura,DC=usfq,DC=edu,DC=ec',isActive: true },
      { key: 'SISTEMAS',       label: 'Sistemas',       samPrefix: 'sys',   extensionAttribute14: 'PRIV_SYS', targetOU: 'OU=Privilegiadas,OU=Sistemas,DC=usfq,DC=edu,DC=ec',       isActive: true },
      { key: 'SEGURIDAD',      label: 'Seguridad',      samPrefix: 'cyber', extensionAttribute14: 'PRIV_CYB', targetOU: 'OU=Privilegiadas,OU=Seguridad,DC=usfq,DC=edu,DC=ec',      isActive: true },
    ],
  },
];

// ── Debug fetch wrapper ────────────────────────────────────────────────────────
// TODO: remove console.log once integration is confirmed working
function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  console.log('[API]', options?.method ?? 'GET', url);
  return fetch(url, options);
}

// ── Type mappers ──────────────────────────────────────────────────────────────

function mapSubType(raw: Record<string, unknown>): AccountSubTypeInfo {
  return {
    key:                  raw.subTypeKey          as AccountSubTypeKey,
    label:                raw.label               as string,
    samPrefix:            raw.samPrefix            as string,
    extensionAttribute14: raw.extensionAttribute14 as string,
    targetOU:             raw.targetOU             as string | null | undefined,
    isActive:             raw.isActive             as boolean,
  };
}

function mapApiType(raw: Record<string, unknown>): AccountTypeInfo {
  const rawSubTypes = (raw.subTypes as Record<string, unknown>[] | undefined) ?? [];
  return {
    key:                   raw.key                   as AccountTypeKey,
    label:                 raw.label                 as string,
    description:           raw.description           as string,
    badge:                 raw.badge                 as string,
    extensionAttribute14:  raw.extensionAttribute14  as string,
    isPrivileged:          raw.isPrivileged           as boolean,
    defaultPasswordLength: (raw.defaultPasswordLength as number) ?? 16,
    defaultCompany:        raw.defaultCompany         as string | null | undefined,
    descriptionTemplate:   (raw.descriptionTemplate   as string) ?? '',
    departmentPrefix:      raw.departmentPrefix       as string | null | undefined,
    subTypes:              rawSubTypes.map(mapSubType),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ValidateEmailResult {
  isValid:          boolean;
  message:          string;
  userDisplayName?: string;
  department?:      string | null;
  managerDn?:       string | null;
}

export const accountCreationApi = {
  // Falls back to static mock when backend is unavailable (non-mutating).
  async getAccountTypes(): Promise<AccountTypeInfo[]> {
    try {
      const res = await apiFetch('/api/account-types');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, unknown>[];
      return data.map(mapApiType);
    } catch {
      return MOCK_ACCOUNT_TYPES;
    }
  },

  // No mock fallback — a failure here means the AD check did NOT happen.
  async validateRecoveryEmail(email: string): Promise<ValidateEmailResult> {
    const url = '/api/accounts/validate-recovery-email';
    try {
      const res = await apiFetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${body ? ` — ${body}` : ''}`);
      }
      return res.json() as Promise<ValidateEmailResult>;
    } catch (err) {
      return {
        isValid: false,
        message: `No se pudo verificar el correo en el servidor: ${errorMessage(err)}`,
      };
    }
  },

  // Falls back to client-side computation — preview is cosmetic, not a write operation.
  async previewAccount(
    typeKey:      AccountTypeKey,
    form:         AccountFormData,
    typeInfo:     AccountTypeInfo,
    subTypeInfo?: AccountSubTypeInfo,
  ): Promise<AccountPreviewData> {
    const url = '/api/accounts/preview';
    try {
      const res = await apiFetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountTypeKey: typeKey,
          subTypeKey:     subTypeInfo?.key,
          accountName:    form.accountName,
          firstName:      form.firstName,
          apellidos:      form.apellidos,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json() as {
        userPrincipalName: string; samAccountName: string;
        displayName: string; company: string; description: string; extensionAttribute14: string;
        givenName?: string | null; sn?: string | null; recoveryEmail?: string | null;
        targetOU?: string | null; accountTypeKey?: string; accountTypeLabel?: string;
        subTypeKey?: string | null; subTypeLabel?: string | null;
      };
      return {
        userPrincipalName:    raw.userPrincipalName,
        sAMAccountName:       raw.samAccountName,
        displayName:          raw.displayName,
        company:              raw.company ?? '',
        description:          raw.description,
        extensionAttribute14: raw.extensionAttribute14,
        givenName:            raw.givenName,
        sn:                   raw.sn,
        recoveryEmail:        raw.recoveryEmail,
        targetOU:             raw.targetOU,
        accountTypeKey:       raw.accountTypeKey,
        accountTypeLabel:     raw.accountTypeLabel,
        subTypeKey:           raw.subTypeKey,
        subTypeLabel:         raw.subTypeLabel,
      };
    } catch {
      return computePreview(typeKey, form, typeInfo, subTypeInfo);
    }
  },

  // No mock fallback — a network or server error is returned as canCreate:false.
  async validateCreate(
    typeKey:      AccountTypeKey,
    subTypeKey:   string | undefined,
    form:         AccountFormData,
    _typeInfo:    AccountTypeInfo,
    _subTypeInfo?: AccountSubTypeInfo,
  ): Promise<ValidationResult> {
    const url = '/api/accounts/validate-create';
    try {
      const res = await apiFetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountTypeKey: typeKey,
          subTypeKey,
          accountName:    form.accountName,
          firstName:      form.firstName,
          apellidos:      form.apellidos,
          recoveryEmail:  form.recoveryEmail,
          password:       form.password,
          description:    form.description,
        }),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        let friendlyError: string;
        if (res.status === 500) {
          friendlyError =
            'No se pudo validar la creación de la cuenta. ' +
            'Revise la configuración del tipo de cuenta o consulte los logs del backend.';
        } else {
          try {
            const parsed = JSON.parse(bodyText) as { error?: string };
            friendlyError = parsed.error ?? `Error del servidor (HTTP ${res.status})`;
          } catch {
            friendlyError = `Error del servidor (HTTP ${res.status})`;
          }
        }
        return {
          canCreate: false,
          errors:    [friendlyError],
          warnings:  [],
          preview:   null,
          checks:    null,
        };
      }

      const raw = await res.json() as {
        canCreate: boolean;
        errors:    string[];
        warnings:  string[];
        preview: {
          userPrincipalName: string; samAccountName: string;
          displayName: string; company: string; description: string; extensionAttribute14: string;
          givenName?: string | null; sn?: string | null; recoveryEmail?: string | null;
          targetOU?: string | null; accountTypeKey?: string; accountTypeLabel?: string;
          subTypeKey?: string | null; subTypeLabel?: string | null;
          mail?: string | null; department?: string | null;
          managerDn?: string | null; managerDisplayName?: string | null;
        } | null;
        checks: {
          configFound: boolean; samAvailable: boolean | null; upnAvailable: boolean | null;
          recoveryEmailValid: boolean | null; passwordValid: boolean; ouValid: boolean | null;
        } | null;
      };
      return {
        canCreate: raw.canCreate,
        errors:    raw.errors ?? [],
        warnings:  raw.warnings ?? [],
        preview:   raw.preview
          ? {
              userPrincipalName:    raw.preview.userPrincipalName,
              sAMAccountName:       raw.preview.samAccountName,
              displayName:          raw.preview.displayName,
              company:              raw.preview.company ?? '',
              description:          raw.preview.description,
              extensionAttribute14: raw.preview.extensionAttribute14,
              givenName:            raw.preview.givenName,
              sn:                   raw.preview.sn,
              recoveryEmail:        raw.preview.recoveryEmail,
              targetOU:             raw.preview.targetOU,
              accountTypeKey:       raw.preview.accountTypeKey,
              accountTypeLabel:     raw.preview.accountTypeLabel,
              subTypeKey:           raw.preview.subTypeKey,
              subTypeLabel:         raw.preview.subTypeLabel,
              mail:                 raw.preview.mail,
              department:           raw.preview.department,
              managerDn:            raw.preview.managerDn,
              managerDisplayName:   raw.preview.managerDisplayName,
            }
          : null,
        checks: raw.checks
          ? {
              configFound:        raw.checks.configFound,
              samAvailable:       raw.checks.samAvailable,
              upnAvailable:       raw.checks.upnAvailable,
              recoveryEmailValid: raw.checks.recoveryEmailValid,
              passwordValid:      raw.checks.passwordValid,
              ouValid:            raw.checks.ouValid,
            }
          : null,
      };
    } catch (err) {
      return {
        canCreate: false,
        errors:    [`No se pudo conectar con el servidor de validación: ${errorMessage(err)}`],
        warnings:  [],
        preview:   null,
        checks:    null,
      };
    }
  },

  // No mock fallback — a network or server error is returned as success:false.
  async createAccount(
    typeKey:    AccountTypeKey,
    subTypeKey: string | undefined,
    form:       AccountFormData,
  ): Promise<CreateResult> {
    const url = '/api/accounts/create';
    try {
      const res = await apiFetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountTypeKey: typeKey,
          subTypeKey,
          accountName:   form.accountName,
          firstName:     form.firstName,
          apellidos:     form.apellidos,
          recoveryEmail: form.recoveryEmail,
          password:      form.password,
          description:   form.description,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          success: false,
          message: `Error del servidor (HTTP ${res.status})${body ? `: ${body}` : ''}`,
        };
      }

      const raw = await res.json() as {
        success: boolean; message: string;
        samAccountName?: string; userPrincipalName?: string; displayName?: string;
      };
      return {
        success:           raw.success,
        message:           raw.message,
        samAccountName:    raw.samAccountName,
        userPrincipalName: raw.userPrincipalName,
        displayName:       raw.displayName,
      };
    } catch (err) {
      return {
        success: false,
        message: `No se pudo conectar con el servidor: ${errorMessage(err)}`,
      };
    }
  },
};
