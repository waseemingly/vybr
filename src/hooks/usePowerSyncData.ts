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
        
        const startTime = performance.now();
        const result = await db.getAll(query, params);
        const endTime = performance.now();
        
        // Record query performance
        const monitor = PowerSyncHealthMonitor.getInstance();
        monitor.recordQuery(endTime - startTime);
        
        if (mounted) {
          setData(result as T[]);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
          
          // Record sync error
          const monitor = PowerSyncHealthMonitor.getInstance();
          monitor.recordSyncError(errorMessage);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [db, isPowerSyncAvailable, query, JSON.stringify(params)]);

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
        
        const startTime = performance.now();
        
        // Use the watch method for real-time updates
        for await (const result of db.watch(query, params)) {
          if (!mounted) break;
          
          const endTime = performance.now();
          
          // Record query performance
          const monitor = PowerSyncHealthMonitor.getInstance();
          monitor.recordQuery(endTime - startTime);
          monitor.recordSyncSuccess();
          
          const rows = result.rows?._array ?? [];
          setData(rows as T[]);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setLoading(false);
          
          // Record sync error
          const monitor = PowerSyncHealthMonitor.getInstance();
          monitor.recordSyncError(errorMessage);
        }
      }
    };

    watchData();

    return () => {
      mounted = false;
    };
  }, [db, isPowerSyncAvailable, query, JSON.stringify(params)]);

  return { data, loading, error };
} 