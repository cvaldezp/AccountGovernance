import type { User, AuditLog } from '../types';

// ── Users — 12 total across USFQ.EDU.EC (8) and ASIG.EDU.EC (4) ─────────────

export const MOCK_USERS: User[] = [
  // ── USFQ.EDU.EC — staff / faculty ────────────────────────────────────────
  {
    id: '1',
    username: 'jdoe',
    displayName: 'John Doe',
    email: 'jdoe@usfq.edu.ec',
    department: 'Tecnología',
    jobTitle: 'Desarrollador Senior',
    attributes: {
      'Custom-External-Email-Address': 'john.doe@gmail.com',
      Oficina: 'Quito - Torre Norte',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 2 297-1700',
    },
  },
  {
    id: '2',
    username: 'msmith',
    displayName: 'María Smith',
    email: 'msmith@usfq.edu.ec',
    department: 'Recursos Humanos',
    jobTitle: 'Analista de RRHH',
    attributes: {
      'Custom-External-Email-Address': 'maria.smith@outlook.com',
      Oficina: 'Guayaquil - Centro',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 4 371-2000',
    },
  },
  {
    id: '3',
    username: 'rgarcia',
    displayName: 'Roberto García',
    email: 'rgarcia@usfq.edu.ec',
    department: 'Finanzas',
    jobTitle: 'Contador',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina: 'Cuenca - Sucursal',
      AccountStatus: 'Disabled',
      telephoneNumber: '',
    },
  },
  {
    id: '4',
    username: 'alopez',
    displayName: 'Ana López',
    email: 'alopez@usfq.edu.ec',
    department: 'Operaciones',
    jobTitle: 'Supervisora',
    attributes: {
      'Custom-External-Email-Address': 'ana.lopez@yahoo.com',
      Oficina: 'Quito - Torre Sur',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 2 297-1750',
    },
  },
  {
    id: '5',
    username: 'ctorres',
    displayName: 'Carlos Torres',
    email: 'ctorres@usfq.edu.ec',
    department: 'Tecnología',
    jobTitle: 'Administrador de Sistemas',
    attributes: {
      'Custom-External-Email-Address': 'carlos.t@protonmail.com',
      Oficina: 'Quito - Data Center',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 2 297-1800',
    },
  },
  {
    id: '6',
    username: 'fmorales',
    displayName: 'Fernando Morales',
    email: 'fmorales@usfq.edu.ec',
    department: 'Seguridad',
    jobTitle: 'Analista de Seguridad TI',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina: 'Quito - Torre Norte',
      AccountStatus: 'Locked',
      telephoneNumber: '+593 2 297-1850',
    },
  },
  {
    id: '7',
    username: 'hmendez',
    displayName: 'Helena Méndez',
    email: 'hmendez@usfq.edu.ec',
    department: 'Docencia',
    jobTitle: 'Profesora Titular',
    attributes: {
      'Custom-External-Email-Address': 'helena.m@gmail.com',
      Oficina: 'Cumbayá - Campus',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 2 297-1900',
    },
  },
  {
    id: '8',
    username: 'pnavarro',
    displayName: 'Pedro Navarro',
    email: 'pnavarro@usfq.edu.ec',
    department: 'Registraduría',
    jobTitle: 'Asistente Académico',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina: 'Cumbayá - Campus',
      AccountStatus: 'Enabled',
      telephoneNumber: '',
    },
  },

  // ── ASIG.EDU.EC — contract / adjunct ─────────────────────────────────────
  {
    id: '9',
    username: 'lpena',
    displayName: 'Laura Peña',
    email: 'lpena@asig.edu.ec',
    department: 'Marketing',
    jobTitle: 'Diseñadora Gráfica',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina: 'Guayaquil - Norte',
      AccountStatus: 'Disabled',
      telephoneNumber: '',
    },
  },
  {
    id: '10',
    username: 'kcastillo',
    displayName: 'Karen Castillo',
    email: 'kcastillo@asig.edu.ec',
    department: 'Docencia',
    jobTitle: 'Profesora Asociada',
    attributes: {
      'Custom-External-Email-Address': 'karen.c@gmail.com',
      Oficina: 'Cumbayá - Campus',
      AccountStatus: 'Enabled',
      telephoneNumber: '+593 2 297-2000',
    },
  },
  {
    id: '11',
    username: 'sromero',
    displayName: 'Santiago Romero',
    email: 'sromero@asig.edu.ec',
    department: 'Tecnología',
    jobTitle: 'Soporte de Sistemas',
    attributes: {
      'Custom-External-Email-Address': '',
      Oficina: 'Quito - Data Center',
      AccountStatus: 'Locked',
      telephoneNumber: '+593 2 297-2100',
    },
  },
  {
    id: '12',
    username: 'bvera',
    displayName: 'Beatriz Vera',
    email: 'bvera@asig.edu.ec',
    department: 'Docencia',
    jobTitle: 'Instructora',
    attributes: {
      'Custom-External-Email-Address': 'bvera@yahoo.com',
      Oficina: 'Cumbayá - Campus',
      AccountStatus: 'Enabled',
      telephoneNumber: '',
    },
  },
];

// ── Audit logs — spread across June 2026 ─────────────────────────────────────

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  // June 17
  {
    id: 'a1',
    timestamp: '2026-06-17T09:15:00Z',
    operatorName: 'Ana García',
    operatorRole: 'DragonHelp',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'jdoe',
    field: 'Custom-External-Email-Address',
    oldValue: 'john@gmail.com',
    newValue: 'john.doe@gmail.com',
    success: true,
  },
  {
    id: 'a2',
    timestamp: '2026-06-17T10:30:00Z',
    operatorName: 'María Torres',
    operatorRole: 'Seguridades',
    action: 'DISABLE_ACCOUNT',
    targetUser: 'rgarcia',
    field: 'AccountStatus',
    oldValue: 'Enabled',
    newValue: 'Disabled',
    success: true,
  },
  {
    id: 'a3',
    timestamp: '2026-06-17T11:00:00Z',
    operatorName: 'Juan Pérez',
    operatorRole: 'RRHH',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'msmith',
    field: 'Oficina',
    oldValue: 'Quito - Torre Norte',
    newValue: 'Guayaquil - Centro',
    success: true,
  },
  {
    id: 'a4',
    timestamp: '2026-06-17T11:45:00Z',
    operatorName: 'Carlos López',
    operatorRole: 'Registro',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'alopez',
    field: 'Custom-External-Email-Address',
    oldValue: '',
    newValue: 'ana.lopez@yahoo.com',
    success: true,
  },
  {
    id: 'a5',
    timestamp: '2026-06-17T13:20:00Z',
    operatorName: 'María Torres',
    operatorRole: 'Seguridades',
    action: 'ENABLE_ACCOUNT',
    targetUser: 'lpena',
    field: 'AccountStatus',
    oldValue: 'Disabled',
    newValue: 'Enabled',
    success: false,
  },
  // June 16
  {
    id: 'a6',
    timestamp: '2026-06-16T08:00:00Z',
    operatorName: 'Ana García',
    operatorRole: 'DragonHelp',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'ctorres',
    field: 'Oficina',
    oldValue: 'Quito - Torre Norte',
    newValue: 'Quito - Data Center',
    success: true,
  },
  {
    id: 'a7',
    timestamp: '2026-06-16T14:30:00Z',
    operatorName: 'María Torres',
    operatorRole: 'Seguridades',
    action: 'DISABLE_ACCOUNT',
    targetUser: 'fmorales',
    field: 'AccountStatus',
    oldValue: 'Enabled',
    newValue: 'Disabled',
    success: true,
  },
  // June 15
  {
    id: 'a8',
    timestamp: '2026-06-15T09:00:00Z',
    operatorName: 'Juan Pérez',
    operatorRole: 'RRHH',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'hmendez',
    field: 'Custom-External-Email-Address',
    oldValue: '',
    newValue: 'helena.m@gmail.com',
    success: true,
  },
  // June 14
  {
    id: 'a9',
    timestamp: '2026-06-14T11:00:00Z',
    operatorName: 'Carlos López',
    operatorRole: 'Registro',
    action: 'UPDATE_ATTRIBUTE',
    targetUser: 'pnavarro',
    field: 'telephoneNumber',
    oldValue: '+593 2 297-1600',
    newValue: '',
    success: true,
  },
  // June 10
  {
    id: 'a10',
    timestamp: '2026-06-10T15:00:00Z',
    operatorName: 'María Torres',
    operatorRole: 'Seguridades',
    action: 'ENABLE_ACCOUNT',
    targetUser: 'bvera',
    field: 'AccountStatus',
    oldValue: 'Disabled',
    newValue: 'Enabled',
    success: true,
  },
];

// ── Activity summary — last 30 days (aggregate) ───────────────────────────────

export const MOCK_ACTIVITY_30D = {
  created:     14,
  deactivated:  7,
  locked:       5,
  deleted:      3,
} as const;

// ── Activity timeline — one point every ~5 days ───────────────────────────────

export interface ActivityDataPoint {
  date: string;        // ISO date: 'YYYY-MM-DD'
  created: number;
  deactivated: number;
  locked: number;
  deleted: number;
}

export const MOCK_ACTIVITY_TIMELINE: ActivityDataPoint[] = [
  { date: '2026-06-01', created: 6,  deactivated: 1, locked: 2, deleted: 0 },
  { date: '2026-06-05', created: 8,  deactivated: 2, locked: 3, deleted: 1 },
  { date: '2026-06-10', created: 5,  deactivated: 1, locked: 4, deleted: 0 },
  { date: '2026-06-15', created: 12, deactivated: 3, locked: 5, deleted: 1 },
  { date: '2026-06-20', created: 9,  deactivated: 2, locked: 2, deleted: 0 },
  { date: '2026-06-25', created: 14, deactivated: 4, locked: 6, deleted: 1 },
  { date: '2026-06-30', created: 10, deactivated: 2, locked: 3, deleted: 0 },
];

// ── Operational alerts (mock) ─────────────────────────────────────────────────

export interface DashboardAlert {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
}

export const MOCK_ALERTS: DashboardAlert[] = [
  {
    id: 'alert-1',
    severity: 'danger',
    title: '5 cuentas bloqueadas por intentos fallidos',
    description: '3 en USFQ.EDU.EC · 2 en ASIG.EDU.EC · Requiere revisión de Seguridades',
    timestamp: '2026-06-17T08:00:00Z',
  },
  {
    id: 'alert-2',
    severity: 'warning',
    title: '12 cuentas sin email externo configurado',
    description: 'Atributo Custom-External-Email-Address vacío o inválido',
    timestamp: '2026-06-16T00:00:00Z',
  },
  {
    id: 'alert-3',
    severity: 'warning',
    title: '3 cuentas con último acceso mayor a 90 días',
    description: 'Candidatas a desactivación según política institucional',
    timestamp: '2026-06-15T00:00:00Z',
  },
  {
    id: 'alert-4',
    severity: 'info',
    title: 'Sincronización AD completada sin errores',
    description: 'Último ciclo: 2026-06-17 06:00 UTC-5 · 847 objetos procesados',
    timestamp: '2026-06-17T06:00:00Z',
  },
];
