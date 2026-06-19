// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccountSubTypeConfigItem {
  subTypeKey:           string;
  label:                string;
  samPrefix:            string;
  extensionAttribute14: string;
  targetOU:             string | null;
  isActive:             boolean;
}

export interface AccountTypeConfigItem {
  id:                    number;
  typeKey:               string;
  label:                 string;
  description:           string;
  badge:                 string;
  isPrivileged:          boolean;
  isActive:              boolean;
  sortOrder:             number;
  samPrefix:             string | null;
  extensionAttribute14:  string;
  targetOU:              string | null;
  defaultPasswordLength: number;
  descriptionTemplate:   string;
  updatedAt:             string;
  updatedBy:             string | null;
  subTypes:              AccountSubTypeConfigItem[];
}

export interface UpdateConfigPayload {
  samPrefix:             string | null;
  extensionAttribute14:  string;
  targetOU:              string | null;
  defaultPasswordLength: number;
  descriptionTemplate:   string;
  isActive:              boolean;
}

export interface UpdateSubTypePayload {
  samPrefix:            string;
  extensionAttribute14: string;
  targetOU:             string | null;
  isActive:             boolean;
}

// ── Mock fallback (mirrors gov.AccountTypes + gov.AccountTypeConfigurations + gov.AccountSubTypes) ──

const MOCK_SUBTYPES: AccountSubTypeConfigItem[] = [
  { subTypeKey: 'OPERACIONES',    label: 'Operaciones',    samPrefix: 'op',    extensionAttribute14: 'PRIV_OP',  targetOU: 'OU=Privilegiadas,OU=Operaciones,DC=usfq,DC=edu,DC=ec',    isActive: true },
  { subTypeKey: 'INFRAESTRUCTURA',label: 'Infraestructura',samPrefix: 'sa',    extensionAttribute14: 'PRIV_SA',  targetOU: 'OU=Privilegiadas,OU=Infraestructura,DC=usfq,DC=edu,DC=ec',isActive: true },
  { subTypeKey: 'SISTEMAS',       label: 'Sistemas',       samPrefix: 'sys',   extensionAttribute14: 'PRIV_SYS', targetOU: 'OU=Privilegiadas,OU=Sistemas,DC=usfq,DC=edu,DC=ec',       isActive: true },
  { subTypeKey: 'SEGURIDAD',      label: 'Seguridad',      samPrefix: 'cyber', extensionAttribute14: 'PRIV_CYB', targetOU: 'OU=Privilegiadas,OU=Seguridad,DC=usfq,DC=edu,DC=ec',      isActive: true },
];

const MOCK_CONFIGS: AccountTypeConfigItem[] = [
  {
    id: 1, typeKey: 'GENERIC',    label: 'Genérica',    description: 'Cuentas de usuarios internos estándar.',
    badge: 'GEN', isPrivileged: false, isActive: true, sortOrder: 1,
    samPrefix: null, extensionAttribute14: 'GENERICA',  targetOU: 'OU=Genericas,OU=Usuarios,DC=usfq,DC=edu,DC=ec',
    defaultPasswordLength: 16, descriptionTemplate: 'Cuenta genérica — {Department}',
    updatedAt: new Date().toISOString(), updatedBy: null, subTypes: [],
  },
  {
    id: 2, typeKey: 'PARTNER',    label: 'Partner',     description: 'Cuentas para socios externos o proveedores.',
    badge: 'PTR', isPrivileged: false, isActive: true, sortOrder: 2,
    samPrefix: null, extensionAttribute14: 'PARTNER',   targetOU: 'OU=Partners,OU=Externos,DC=usfq,DC=edu,DC=ec',
    defaultPasswordLength: 16, descriptionTemplate: 'Cuenta partner — {Company}',
    updatedAt: new Date().toISOString(), updatedBy: null, subTypes: [],
  },
  {
    id: 3, typeKey: 'SERVICE',    label: 'Servicio',    description: 'Cuentas para servicios o aplicaciones.',
    badge: 'SVC', isPrivileged: false, isActive: true, sortOrder: 3,
    samPrefix: null, extensionAttribute14: 'SERVICIO',  targetOU: 'OU=ServiceAccounts,DC=usfq,DC=edu,DC=ec',
    defaultPasswordLength: 20, descriptionTemplate: 'Cuenta de servicio — {ServiceName}',
    updatedAt: new Date().toISOString(), updatedBy: null, subTypes: [],
  },
  {
    id: 4, typeKey: 'EXTENSION',  label: 'Extensión',   description: 'Cuentas de extensión para usuarios existentes.',
    badge: 'EXT', isPrivileged: false, isActive: true, sortOrder: 4,
    samPrefix: null, extensionAttribute14: 'EXTENSION', targetOU: 'OU=Extension,OU=Usuarios,DC=usfq,DC=edu,DC=ec',
    defaultPasswordLength: 16, descriptionTemplate: 'Cuenta de extensión — {Department}',
    updatedAt: new Date().toISOString(), updatedBy: null, subTypes: [],
  },
  {
    id: 5, typeKey: 'PRIVILEGED', label: 'Privilegiada', description: 'Cuentas privilegiadas con acceso elevado.',
    badge: 'PRV', isPrivileged: true,  isActive: true, sortOrder: 5,
    samPrefix: null, extensionAttribute14: 'PRIVILEGED', targetOU: null,
    defaultPasswordLength: 20, descriptionTemplate: 'Cuenta privilegiada {SubType} — {Department}',
    updatedAt: new Date().toISOString(), updatedBy: null, subTypes: MOCK_SUBTYPES,
  },
];

let mockStore      = [...MOCK_CONFIGS];
let mockSubStore   = [...MOCK_SUBTYPES];

function delay(ms = 300): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Public API ────────────────────────────────────────────────────────────────

export const accountTypeConfigApi = {
  async getAll(): Promise<AccountTypeConfigItem[]> {
    try {
      const res = await fetch('/api/account-type-configs');
      if (!res.ok) throw new Error();
      return res.json() as Promise<AccountTypeConfigItem[]>;
    } catch {
      await delay(200);
      return [...mockStore];
    }
  },

  async update(typeKey: string, payload: UpdateConfigPayload): Promise<AccountTypeConfigItem> {
    try {
      const res = await fetch(`/api/account-type-configs/${typeKey}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json() as Promise<AccountTypeConfigItem>;
    } catch {
      await delay(400);
      mockStore = mockStore.map(c =>
        c.typeKey === typeKey
          ? { ...c, ...payload, updatedAt: new Date().toISOString(), updatedBy: 'sistema (mock)' }
          : c,
      );
      return { ...mockStore.find(c => c.typeKey === typeKey)! };
    }
  },

  async updateSubType(typeKey: string, subTypeKey: string, payload: UpdateSubTypePayload): Promise<AccountSubTypeConfigItem> {
    try {
      const res = await fetch(`/api/account-type-configs/${typeKey}/subtypes/${subTypeKey}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json() as Promise<AccountSubTypeConfigItem>;
    } catch {
      await delay(350);
      mockSubStore = mockSubStore.map(s =>
        s.subTypeKey === subTypeKey ? { ...s, ...payload } : s,
      );
      mockStore = mockStore.map(c =>
        c.typeKey === typeKey
          ? { ...c, subTypes: mockSubStore }
          : c,
      );
      return { ...mockSubStore.find(s => s.subTypeKey === subTypeKey)! };
    }
  },
};
