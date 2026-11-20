import { useCallback, useEffect, useState } from "react";
import { getHealth, getSettings, getStatus, updateSettings } from "@/lib/api";
import type { Spend, Status } from "@/types";

const POLL_MS = 10_000;

/* The brain's status, polled. Also tells "the brain is down" apart from
   "the brain is up and refused us" (a token problem), and keeps the one
   setting the prompt bar can flip: offline mode. */
export function useBrain() {
  const [status, setStatus] = useState<Status | null>(null);
  const [connected, setConnected] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  // Tokens the selected BYOK endpoint has used: this turn, and today.
  const [spend, setSpend] = useState<Spend | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      return s;
    } catch {
      return null; // the poll will pick it up
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const s = await getStatus();
        if (cancelled) return;
        setStatus(s);
        setConnected(true);
        setAuthFailed(false);
        // The selected model's running total, so the pill is right after a
        // reload and not only while a turn streams.
        setSpend(s.usage ? { turn: null, today: s.usage.today, host: null } : null);
      } catch {
        if (cancelled) return;
        setConnected(false);
        // /health needs no token, so a brain that answers it while refusing
        // everything else is a token problem, not a dead brain.
        try {
          await getHealth();
          if (!cancelled) setAuthFailed(true);
        } catch {
          if (!cancelled) setAuthFailed(false);
        }
      }
    }
    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const loadSettings = useCallback(() => {
    getSettings()
      .then((r) => setOffline(!!r?.settings?.offline))
      .catch(() => {
        // keep the last known value
      });
  }, []);

  useEffect(() => {
    if (connected) loadSettings();
  }, [connected, loadSettings]);

  /* The globe in the prompt bar. Optimistic, and put back if the brain says no. */
  const toggleOffline = useCallback(async () => {
    const next = !offline;
    setOffline(next);
    try {
      await updateSettings({ offline: next });
    } catch (e) {
      setOffline(!next);
      throw e;
    }
  }, [offline]);

  return { status, setStatus, connected, authFailed, spend, setSpend, refresh, offline, toggleOffline, loadSettings };
}
