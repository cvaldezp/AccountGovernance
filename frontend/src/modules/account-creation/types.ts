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
  subTypes:              AccountSubTypeInfo[];
}

export interface AccountFormData {
  firstName:      string;
  lastName1:      string;
  lastName2:      string;
  serviceName:    string;
  department:     string;
  company:        string;
  description:    string;
  recoveryEmail:  string;
  password:       string;
  passwordLength: number;
}

export interface AccountPreviewData {
  userPrincipalName:    string;
  sAMAccountName:       string;
  displayName:          string;
  description:          string;
  extensionAttribute14: string;
}

export type EmailValidationStatus = 'idle' | 'loading' | 'valid' | 'invalid';

export interface RecoveryEmailValidation {
  status:           EmailValidationStatus;
  message:          string;
  userDisplayName?: string;
}
