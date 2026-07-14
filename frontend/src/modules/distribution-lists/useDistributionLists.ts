import { useState, useCallback } from 'react';
import { errorMessage } from '../../api/apiFetch';
import { distributionListsApi } from './distributionListsApi';
import type { DistributionListSummary, DistributionListDetail, DistributionListMember } from './types';

const MIN_QUERY_LENGTH = 2;

export function useDistributionLists() {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<DistributionListSummary[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedDn, setSelectedDn]       = useState<string | null>(null);
  const [detail, setDetail]               = useState<DistributionListDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState<string | null>(null);

  const [members, setMembers]               = useState<DistributionListMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError]     = useState<string | null>(null);

  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError]         = useState<string | null>(null);

  const [removingDn, setRemovingDn]   = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSearchError(`Ingresa al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`);
      return;
    }
    setSearchError(null);
    setSearching(true);
    setSearched(true);
    try {
      setResults(await distributionListsApi.search(q));
    } catch (err) {
      setSearchError(errorMessage(err));
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const loadMembers = useCallback(async (dn: string) => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      setMembers(await distributionListsApi.getMembers(dn));
    } catch (err) {
      setMembersError(errorMessage(err));
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const selectList = useCallback((dn: string) => {
    setSelectedDn(dn);
    setDetail(null);
    setDetailError(null);
    setAddError(null);
    setRemoveError(null);

    setDetailLoading(true);
    distributionListsApi.getDetail(dn)
      .then(setDetail)
      .catch(err => setDetailError(errorMessage(err)))
      .finally(() => setDetailLoading(false));

    void loadMembers(dn);
  }, [loadMembers]);

  const addMember = useCallback(async (memberAccount: string): Promise<boolean> => {
    if (!selectedDn) return false;
    setAddingMember(true);
    setAddError(null);
    try {
      await distributionListsApi.addMember(selectedDn, memberAccount);
      await loadMembers(selectedDn);
      setDetail(prev => prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev);
      return true;
    } catch (err) {
      setAddError(errorMessage(err));
      return false;
    } finally {
      setAddingMember(false);
    }
  }, [selectedDn, loadMembers]);

  const removeMember = useCallback(async (memberDn: string) => {
    if (!selectedDn) return;
    setRemovingDn(memberDn);
    setRemoveError(null);
    try {
      await distributionListsApi.removeMember(selectedDn, memberDn);
      setMembers(prev => prev.filter(m => m.dn !== memberDn));
      setDetail(prev => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
    } catch (err) {
      setRemoveError(errorMessage(err));
    } finally {
      setRemovingDn(null);
    }
  }, [selectedDn]);

  return {
    query, setQuery, results, searching, searched, searchError, search,
    selectedDn, selectList,
    detail, detailLoading, detailError,
    members, membersLoading, membersError,
    addingMember, addError, addMember,
    removingDn, removeError, removeMember,
  };
}
