import { apiFetch } from '../../api/apiFetch';
import type { DistributionListSummary, DistributionListDetail, DistributionListMember } from './types';

export const distributionListsApi = {
  async search(query: string): Promise<DistributionListSummary[]> {
    const res = await apiFetch(`/api/distribution-lists/search?q=${encodeURIComponent(query)}`);
    return res.json() as Promise<DistributionListSummary[]>;
  },

  async getDetail(dn: string): Promise<DistributionListDetail> {
    const res = await apiFetch(`/api/distribution-lists/detail?dn=${encodeURIComponent(dn)}`);
    return res.json() as Promise<DistributionListDetail>;
  },

  async getMembers(dn: string): Promise<DistributionListMember[]> {
    const res = await apiFetch(`/api/distribution-lists/members?dn=${encodeURIComponent(dn)}`);
    return res.json() as Promise<DistributionListMember[]>;
  },

  async addMember(listDn: string, memberAccount: string): Promise<DistributionListMember> {
    const res = await apiFetch('/api/distribution-lists/members', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ listDn, memberAccount }),
    });
    return res.json() as Promise<DistributionListMember>;
  },

  async removeMember(listDn: string, memberDn: string): Promise<void> {
    await apiFetch('/api/distribution-lists/members/remove', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ listDn, memberDn }),
    });
  },
};
