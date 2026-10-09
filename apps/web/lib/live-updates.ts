"use client";
import { useEffect, useRef, useState } from "react";
// Works with both HttpOnly username sessions and Supabase email sessions.
// A focused conversation checks for new messages every two seconds.
export function useLiveUpdates<T>(
  url: string,
  enabled = true,
  interval = 2000,
) {
  const [snapshot, setData] = useState<{ url: string; value: T } | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    setConnected(false);
    setError("");
    let stopped = false;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const refresh = async () => {
      const run = ++sequence;
      clearTimeout(timer);
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      if (document.visibilityState === "hidden" || !navigator.onLine) {
        setConnected(false);
        return;
      }
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: requestController.signal,
        });
        const next = await res.json();
        if (!res.ok) throw Error(next.error || "Povezivanje nije uspjelo.");
        if (!stopped && run === sequence) {
          setData({ url, value: next });
          setConnected(true);
          setError("");
        }
      } catch (e) {
        if (
          !stopped &&
          run === sequence &&
          !(e instanceof Error && e.name === "AbortError")
        ) {
          setConnected(false);
          setError(e instanceof Error ? e.message : "Provjerite vezu.");
        }
      } finally {
        if (!stopped && run === sequence) timer = setTimeout(refresh, interval);
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    const offline = () => {
      setConnected(false);
      controller?.abort();
      clearTimeout(timer);
    };
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
    };
  }, [url, enabled, interval]);
  return {
    data: snapshot?.url === url ? snapshot.value : null,
    error,
    connected,
    refresh: () => refreshRef.current(),
  };
}
export async function portalAction(
  action: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch("/api/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Pokušajte ponovo.");
  return data;
}
