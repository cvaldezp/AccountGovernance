import type { RoleName } from './index';

export type AuditActionType = 'UPDATE_FIELD' | 'ENABLE_ACCOUNT' | 'DISABLE_ACCOUNT';

export interface AuditEntry {
  id:          string;
  timestamp:   string;       // ISO 8601
  performedBy: string;       // operator display name
  roleName:    RoleName;
  actionType:  AuditActionType;
  fieldKey?:   string;       // adAttributeName or fieldKey from AD_FIELD_DEFINITIONS
  oldValue?:   string;
  newValue?:   string;
  targetUser:  string;       // username of the affected account
  domain:      string;       // 'USFQ.EDU.EC' | 'ASIG.EDU.EC'
  success:     boolean;
  notes?:      string;
}

export interface AuditFilters {
  targetUser?:  string;
  actionType?:  AuditActionType | '';
  roleName?:    RoleName | '';
  dateFrom?:    string;      // 'YYYY-MM-DD'
  dateTo?:      string;      // 'YYYY-MM-DD'
}
