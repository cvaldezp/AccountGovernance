export interface DistributionListSummary {
  name: string;
  mail: string | null;
  dn:   string;
}

export interface DistributionListDetail {
  name:               string;
  mail:               string | null;
  description:        string | null;
  managerDisplayName: string | null;
  memberCount:        number;
  dn:                 string;
}

export interface DistributionListMember {
  displayName:    string;
  mail:           string | null;
  samAccountName: string;
  dn:             string;
}
