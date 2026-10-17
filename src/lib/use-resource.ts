import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
export function useResource<T>(path: string | null, refreshOnFocus = false) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    controller.current?.abort();
    if (!path) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    try {
      const result = await api<T>(path, { signal: abort.signal });
      if (request === sequence.current && !abort.signal.aborted) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current && !abort.signal.aborted)
        setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (request === sequence.current && !abort.signal.aborted)
        setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(undefined);
    void reload();
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [reload]);
  useEffect(() => {
    if (!refreshOnFocus || !path) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
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
