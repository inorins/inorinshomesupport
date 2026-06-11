import { useState, useCallback, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Sync when another part of the same page writes to this key via dispatchStorageEvent
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setValue(defaultValue);
        return;
      }
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, defaultValue]);

  const set = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof newValue === 'function'
            ? (newValue as (p: T) => T)(prev)
            : newValue;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key],
  );

  return [value, set];
}
