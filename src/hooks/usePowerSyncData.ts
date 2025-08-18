import { useEffect, useState } from 'react';
import { usePowerSync } from '@/context/PowerSyncContext';
import { PowerSyncHealthMonitor } from '@/utils/powersyncHealth';

export function usePowerSyncData<T>(
  query: string,
  params: any[] = []
): { data: T[]; loading: boolean; error: string | null } {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPowerSyncAvailable || !db) {
      setLoading(false);
      setError('PowerSync not available');
      return;
    }

    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await db.getAll(query, params);
        
        if (mounted) {
          setData(result as T[]);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [db, isPowerSyncAvailable, query, ...params]); // Use spread operator instead of JSON.stringify

  return { data, loading, error };
}

export function usePowerSyncDataWatcher<T>(
  query: string,
  params: any[] = []
): { data: T[]; loading: boolean; error: string | null } {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPowerSyncAvailable || !db) {
      setLoading(false);
      setError('PowerSync not available');
      return;
    }

    let mounted = true;

    const watchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use the watch method for real-time updates
        for await (const result of db.watch(query, params)) {
          if (!mounted) break;
          
          const rows = result.rows?._array ?? [];
          setData(rows as T[]);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    watchData();

    return () => {
      mounted = false;
    };
  }, [db, isPowerSyncAvailable, query, ...params]); // Use spread operator instead of JSON.stringify

  return { data, loading, error };
} 