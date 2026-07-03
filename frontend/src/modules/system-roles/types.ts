export interface SystemRoleGroup {
  id:              number;
  systemRoleId:    number;
  groupName:       string;
  groupDn:         string;
  groupObjectGuid: string | null;
  groupSid:        string | null;
  isActive:        boolean;
  updatedAt:       string;
  updatedBy:       string | null;
}

export interface SystemRole {
  id:          number;
  roleKey:     string;
  displayName: string;
  description: string | null;
  priority:    number;
  isActive:    boolean;
  updatedAt:   string;
  updatedBy:   string | null;
  groups:      SystemRoleGroup[];
}

export interface UpdateRoleForm {
  displayName: string;
  description: string;
  priority:    number;
  isActive:    boolean;
}

export interface CreateGroupForm {
  /** What the admin types into the "Grupo AD" search box — a name, never a hand-typed DN. */
  query:           string;
  /** Below are only ever populated from a successful AD validation — never hand-edited. */
  groupName:       string;
  groupDn:         string;
  groupObjectGuid: string;
  groupSid:        string;
  isActive:        boolean;
}

export interface AdGroupValidation {
  isValid:    boolean;
  groupName:  string | null;
  dn:         string | null;
  objectGuid: string | null;
  sid:        string | null;
  isSecurity: boolean;
  error:      string | null;
}

export const BLANK_GROUP_FORM: CreateGroupForm = {
  query:           '',
  groupName:       '',
  groupDn:         '',
  groupObjectGuid: '',
  groupSid:        '',
  isActive:        true,
};
