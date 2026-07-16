import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { fetchMyFields } from '../api/fieldConfigApi';
import type { FieldConfig } from '../types';

interface UseFieldConfigResult {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
}

export function useFieldConfig(): UseFieldConfigResult {
  const { user } = useAuth();
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchMyFields(user.role)
      .then(configs => {
        setFieldConfigs(configs);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [user?.role]);

  return { fieldConfigs, loading, error };
}
