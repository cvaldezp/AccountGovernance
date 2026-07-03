import type { Role } from '../types';

export const ROLES_CONFIG: Role[] = [
  {
    name: 'SystemAdmin',
    displayName: 'Super Usuario Administrador',
    color: '#111827',
    // canAccess() below always returns true for SystemAdmin regardless of this list —
    // it's kept in sync for display purposes (Layout avatar color, etc.) only.
    permissions: [
      { field: 'Custom-External-Email-Address', actions: ['read', 'write'] },
      { field: 'Oficina', actions: ['read', 'write'] },
      { field: 'AccountStatus', actions: ['read', 'write'] },
      { field: 'telephoneNumber', actions: ['read', 'write'] },
    ],
  },
  {
    name: 'DragonHelp',
    displayName: 'Dragon Help Desk',
    color: '#8b5cf6',
    permissions: [
      { field: 'Custom-External-Email-Address', actions: ['read', 'write'] },
      { field: 'Oficina', actions: ['read', 'write'] },
    ],
  },
  {
    name: 'Registro',
    displayName: 'Registro',
    color: '#3b82f6',
    permissions: [
      { field: 'Custom-External-Email-Address', actions: ['read', 'write'] },
    ],
  },
  {
    name: 'Seguridades',
    displayName: 'Seguridades',
    color: '#ef4444',
    permissions: [
      { field: 'Custom-External-Email-Address', actions: ['read', 'write'] },
      { field: 'Oficina', actions: ['read', 'write'] },
      { field: 'AccountStatus', actions: ['read', 'write'] },
    ],
  },
  {
    name: 'RRHH',
    displayName: 'RRHH',
    color: '#22c55e',
    permissions: [
      { field: 'Custom-External-Email-Address', actions: ['read', 'write'] },
      { field: 'Oficina', actions: ['read', 'write'] },
      { field: 'AccountStatus', actions: ['read', 'write'] },
    ],
  },
];

export const FIELD_LABELS: Record<string, string> = {
  'Custom-External-Email-Address': 'Email Externo',
  Oficina: 'Oficina',
  AccountStatus: 'Estado de Cuenta',
  telephoneNumber: 'Teléfono',
};
