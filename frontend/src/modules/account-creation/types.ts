export type AccountTypeKey =
  | 'GENERIC'
  | 'PARTNER'
  | 'SERVICE'
  | 'EXTENSION'
  | 'PRIVILEGED';

export type AccountSubTypeKey =
  | 'OPERACIONES'
  | 'INFRAESTRUCTURA'
  | 'SISTEMAS'
  | 'SEGURIDAD';

export interface AccountSubTypeInfo {
  key:                  AccountSubTypeKey;
  label:                string;
  samPrefix:            string;
  extensionAttribute14: string;
  targetOU?:            string | null;
  isActive:             boolean;
}

export interface AccountTypeInfo {
  key:                   AccountTypeKey;
  label:                 string;
  description:           string;
  badge:                 string;
  extensionAttribute14:  string;
  isPrivileged:          boolean;
  defaultPasswordLength: number;
  defaultCompany?:       string | null;
  descriptionTemplate:   string;
  departmentPrefix?:     string | null;
  subTypes:              AccountSubTypeInfo[];
}

export interface AccountFormData {
  accountName:    string;
  firstName:      string;
  apellidos:      string;
  description:    string;
  recoveryEmail:  string;
  password:       string;
  passwordLength: number;
}

export interface InitialGroupPreview {
  id:         number;
  groupName:  string;
  groupDn:    string;
  isCritical: boolean;
  existsInAd: boolean | null;
}

export interface GroupAssignmentResult {
  groupName: string;
  success:   boolean;
  error:     string | null;
}

export interface AccountPreviewData {
  userPrincipalName:    string;
  sAMAccountName:       string;
  displayName:          string;
  company:              string;
  description:          string;
  extensionAttribute14: string;
  // extended — present when data comes from backend
  givenName?:           string | null;
  sn?:                  string | null;
  recoveryEmail?:       string | null;
  targetOU?:            string | null;
  accountTypeKey?:      string;
  accountTypeLabel?:    string;
  subTypeKey?:          string | null;
  subTypeLabel?:        string | null;
  mail?:                string | null;
  department?:          string | null;
  managerDn?:           string | null;
  managerDisplayName?:  string | null;
  initialGroups?:       InitialGroupPreview[] | null;
}

export type EmailValidationStatus = 'idle' | 'loading' | 'valid' | 'invalid';

export interface RecoveryEmailValidation {
  status:           EmailValidationStatus;
  message:          string;
  userDisplayName?: string;
  department?:      string | null;
  managerDn?:       string | null;
}

// ── Creation flow ─────────────────────────────────────────────────────────────

export type CreationStep =
  | 'form'        // filling in the form
  | 'validating'  // calling validate-create
  | 'confirming'  // showing validation result, awaiting confirmation
  | 'creating'    // calling create
  | 'result';     // showing final result

export interface ValidationChecks {
  configFound:        boolean;
  samAvailable:       boolean | null;
  upnAvailable:       boolean | null;
  recoveryEmailValid: boolean | null;
  passwordValid:      boolean;
  ouValid:            boolean | null;
}

export interface ValidationResult {
  canCreate: boolean;
  errors:    string[];
  warnings:  string[];
  preview:   AccountPreviewData | null;
  checks:    ValidationChecks | null;
}

export interface CreateResult {
  success:            boolean;
  message:            string;
  samAccountName?:    string;
  userPrincipalName?: string;
  displayName?:       string;
  groupAssignments?:  GroupAssignmentResult[] | null;
}
