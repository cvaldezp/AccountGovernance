import { computePreview } from './accountTypes';
import type { AccountTypeInfo, AccountTypeKey, AccountSubTypeInfo, AccountSubTypeKey, AccountFormData, AccountPreviewData } from './types';

// ── Mock fallback (mirrors gov.AccountTypes + gov.AccountSubTypes seed) ───────

const MOCK_ACCOUNT_TYPES: AccountTypeInfo[] = [
  {
    key: 'GENERIC',    label: 'Genérica',    description: 'Usuarios internos estándar',
    badge: 'GEN', extensionAttribute14: 'Genérica', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'Genérica', subTypes: [],
  },
  {
    key: 'PARTNER',    label: 'Partner',     description: 'Socios externos o proveedores',
    badge: 'PTR', extensionAttribute14: 'PARTNERS', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'PARTNERS', subTypes: [],
  },
  {
    key: 'SERVICE',    label: 'Servicio',    description: 'Servicios o aplicaciones',
    badge: 'SVC', extensionAttribute14: 'SERVICES', isPrivileged: false, defaultPasswordLength: 20,
    defaultCompany: 'USFQ', descriptionTemplate: 'SERVICES', subTypes: [],
  },
  {
    key: 'EXTENSION',  label: 'Extensión',   description: 'Extensión de usuario existente',
    badge: 'EXT', extensionAttribute14: 'EXTENSION', isPrivileged: false, defaultPasswordLength: 16,
    defaultCompany: 'USFQ', descriptionTemplate: 'EXTENSION', subTypes: [],
  },
  {
    key: 'PRIVILEGED', label: 'Privilegiada', description: 'Cuentas con acceso elevado — selecciona el sub-tipo',
    badge: 'PRV', extensionAttribute14: 'PRIVILEGED', isPrivileged: true, defaultPasswordLength: 20,
    defaultCompany: 'USFQ', descriptionTemplate: 'PRIVILEGED',
    subTypes: [
      { key: 'OPERACIONES',    label: 'Operaciones',    samPrefix: 'op',    extensionAttribute14: 'PRIV_OP',  targetOU: 'OU=Privilegiadas,OU=Operaciones,DC=usfq,DC=edu,DC=ec',    isActive: true },
      { key: 'INFRAESTRUCTURA',label: 'Infraestructura',samPrefix: 'sa',    extensionAttribute14: 'PRIV_SA',  targetOU: 'OU=Privilegiadas,OU=Infraestructura,DC=usfq,DC=edu,DC=ec',isActive: true },
      { key: 'SISTEMAS',       label: 'Sistemas',       samPrefix: 'sys',   extensionAttribute14: 'PRIV_SYS', targetOU: 'OU=Privilegiadas,OU=Sistemas,DC=usfq,DC=edu,DC=ec',       isActive: true },
      { key: 'SEGURIDAD',      label: 'Seguridad',      samPrefix: 'cyber', extensionAttribute14: 'PRIV_CYB', targetOU: 'OU=Privilegiadas,OU=Seguridad,DC=usfq,DC=edu,DC=ec',      isActive: true },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms = 300): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

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
    subTypes:              rawSubTypes.map(mapSubType),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ValidateEmailResult {
  isValid:          boolean;
  message:          string;
  userDisplayName?: string;
}

export const accountCreationApi = {
  async getAccountTypes(): Promise<AccountTypeInfo[]> {
    try {
      const res = await fetch('/api/account-types');
      if (!res.ok) throw new Error();
      const data = await res.json() as Record<string, unknown>[];
      return data.map(mapApiType);
    } catch {
      await delay(150);
      return MOCK_ACCOUNT_TYPES;
    }
  },

  async validateRecoveryEmail(email: string): Promise<ValidateEmailResult> {
    try {
      const res = await fetch('/api/accounts/validate-recovery-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ isValid: boolean; message: string; userDisplayName?: string }>;
    } catch {
      await delay(450);
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@'))
        return { isValid: false, message: 'El correo no tiene un formato válido.' };
      if (normalized.endsWith('@usfq.edu.ec')) {
        const local = normalized.split('@')[0];
        const displayName = local.split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        return { isValid: true, message: `Usuario encontrado en AD: ${displayName}`, userDisplayName: displayName };
      }
      return { isValid: false, message: 'No se encontró un usuario en AD con ese correo de recuperación.' };
    }
  },

  async previewAccount(
    typeKey:      AccountTypeKey,
    form:         AccountFormData,
    typeInfo:     AccountTypeInfo,
    subTypeInfo?: AccountSubTypeInfo,
  ): Promise<AccountPreviewData> {
    try {
      const res = await fetch('/api/accounts/preview', {
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
      if (!res.ok) throw new Error();
      const raw = await res.json() as {
        userPrincipalName: string; samAccountName: string;
        displayName: string; company: string; description: string; extensionAttribute14: string;
      };
      return {
        userPrincipalName:    raw.userPrincipalName,
        sAMAccountName:       raw.samAccountName,
        displayName:          raw.displayName,
        company:              raw.company ?? '',
        description:          raw.description,
        extensionAttribute14: raw.extensionAttribute14,
      };
    } catch {
      await delay(200);
      return computePreview(typeKey, form, typeInfo, subTypeInfo);
    }
  },
};
