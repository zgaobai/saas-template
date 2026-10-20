import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const resourceCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 100;

export function clearResourceCache(prefix?: string) {
  if (typeof window === "undefined") return;
  if (!prefix) {
    resourceCache.clear();
  } else {
    for (const key of resourceCache.keys()) {
      if (key.startsWith(prefix)) {
        resourceCache.delete(key);
      }
    }
  }
}

export function useResource<T>(path: string | null, refreshOnFocus = false) {
  const cached =
    path && typeof window !== "undefined"
      ? (resourceCache.get(path) as CacheEntry<T> | undefined)
      : undefined;

  const [data, setData] = useState<T | undefined>(() => cached?.data);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !cached && Boolean(path));
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(
    async (isBackground = false) => {
      const request = ++sequence.current;
      controller.current?.abort();
      if (!path) {
        setLoading(false);
        return;
      }
      const abort = new AbortController();
      controller.current = abort;
      if (!isBackground) {
        setLoading(true);
      }
      try {
        const result = await api<T>(path, { signal: abort.signal });
        if (request === sequence.current && !abort.signal.aborted) {
          setData(result);
          setError("");
          if (typeof window !== "undefined") {
            if (resourceCache.size >= MAX_CACHE_ENTRIES) {
              const oldest = resourceCache.keys().next().value;
              if (oldest) resourceCache.delete(oldest);
            }
            resourceCache.set(path, { data: result, timestamp: Date.now() });
          }
        }
      } catch (e) {
        if (request === sequence.current && !abort.signal.aborted) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (request === sequence.current && !abort.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      return;
    }

    const existing =
      typeof window !== "undefined"
        ? (resourceCache.get(path) as CacheEntry<T> | undefined)
        : undefined;

    if (existing) {
      setData(existing.data);
      setLoading(false);
      void reload(true);
    } else {
      setData(undefined);
      setLoading(true);
      void reload(false);
    }

    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [path, reload]);

  useEffect(() => {
    if (!refreshOnFocus || !path) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, refreshOnFocus, reload]);

  return { data, error, loading, reload };
}

