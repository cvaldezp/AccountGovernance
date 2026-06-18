import type { RoleADFieldPermission } from '../types';

// ── Role × Field permission matrix ────────────────────────────────────────────
// 4 roles × 4 fields = 16 entries.
// Missing or isActive=false entries default to canView=false, canEdit=false (deny by default).
//
// Policy summary:
//   DragonHelp  — support desk: reads all, edits email/office/telephone; cannot edit AccountStatus
//   Registro    — academic records: edits email only; reads office/telephone; no account status
//   Seguridades — security: full access including AccountStatus; reads telephone (cannot edit)
//   RRHH        — human resources: full access to all fields

export const ROLE_AD_FIELD_PERMISSIONS: RoleADFieldPermission[] = [
  // ── DragonHelp ──────────────────────────────────────────────────────────────
  { roleName: 'DragonHelp', fieldKey: 'field-ext-email',      canView: true,  canEdit: true,  isActive: true },
  { roleName: 'DragonHelp', fieldKey: 'field-office',         canView: true,  canEdit: true,  isActive: true },
  { roleName: 'DragonHelp', fieldKey: 'field-telephone',      canView: true,  canEdit: true,  isActive: true },
  { roleName: 'DragonHelp', fieldKey: 'field-account-status', canView: true,  canEdit: false, isActive: true },

  // ── Registro ────────────────────────────────────────────────────────────────
  { roleName: 'Registro',   fieldKey: 'field-ext-email',      canView: true,  canEdit: true,  isActive: true },
  { roleName: 'Registro',   fieldKey: 'field-office',         canView: true,  canEdit: false, isActive: true },
  { roleName: 'Registro',   fieldKey: 'field-telephone',      canView: true,  canEdit: false, isActive: true },
  { roleName: 'Registro',   fieldKey: 'field-account-status', canView: false, canEdit: false, isActive: true },

  // ── Seguridades ─────────────────────────────────────────────────────────────
  { roleName: 'Seguridades', fieldKey: 'field-ext-email',      canView: true, canEdit: true,  isActive: true },
  { roleName: 'Seguridades', fieldKey: 'field-office',         canView: true, canEdit: true,  isActive: true },
  { roleName: 'Seguridades', fieldKey: 'field-telephone',      canView: true, canEdit: false, isActive: true },
  { roleName: 'Seguridades', fieldKey: 'field-account-status', canView: true, canEdit: true,  isActive: true },

  // ── RRHH ────────────────────────────────────────────────────────────────────
  { roleName: 'RRHH', fieldKey: 'field-ext-email',      canView: true, canEdit: true, isActive: true },
  { roleName: 'RRHH', fieldKey: 'field-office',         canView: true, canEdit: true, isActive: true },
  { roleName: 'RRHH', fieldKey: 'field-telephone',      canView: true, canEdit: true, isActive: true },
  { roleName: 'RRHH', fieldKey: 'field-account-status', canView: true, canEdit: true, isActive: true },
];
