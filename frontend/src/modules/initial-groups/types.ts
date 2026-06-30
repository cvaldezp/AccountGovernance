export interface InitialGroup {
  id:             number;
  typeKey:        string;
  subTypeKey:     string | null;
  groupName:      string;
  groupDn:        string;
  groupObjectGuid: string | null;
  groupSid:       string | null;
  isCritical:     boolean;
  isActive:       boolean;
  sortOrder:      number;
  updatedAt:      string;
  updatedBy:      string | null;
}

export interface CreateGroupForm {
  groupName:       string;
  groupDn:         string;
  groupObjectGuid: string;
  groupSid:        string;
  isCritical:      boolean;
  isActive:        boolean;
  sortOrder:       number;
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
  groupName:       '',
  groupDn:         '',
  groupObjectGuid: '',
  groupSid:        '',
  isCritical:      true,
  isActive:        true,
  sortOrder:       0,
};
