'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

export function useApiResource<T>(loader: () => Promise<T>) {
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextData = await loader();
      setData(nextData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load data';
      setError(message);
      toast.error(message);
      if (message.includes(': 401')) {
        router.replace('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [loader, router, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    setData,
  };
}
