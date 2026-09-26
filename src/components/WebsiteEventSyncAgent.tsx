import React from 'react';
import { useAppStore } from '../store/AppContext';
import { fetchWebsiteEvents, getWebsiteSyncUrl, mergeWebsiteEvents } from '../lib/siteEventSync';
import type { Activity } from '../lib/activities';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function WebsiteEventSyncAgent() {
  const { loading, eventsData, updateEventsData } = useAppStore();
  const eventsRef = React.useRef<Activity[]>(eventsData);
  const updateRef = React.useRef(updateEventsData);

  React.useEffect(() => { eventsRef.current = eventsData; }, [eventsData]);
  React.useEffect(() => { updateRef.current = updateEventsData; }, [updateEventsData]);

  React.useEffect(() => {
    if (loading || !getWebsiteSyncUrl()) return;
    let cancelled = false;
    let running = false;

    const sync = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        const remote = await fetchWebsiteEvents();
        if (cancelled) return;
        const current = eventsRef.current;
        const merged = mergeWebsiteEvents(current, remote);
        if (JSON.stringify(merged) !== JSON.stringify(current)) {
          eventsRef.current = merged;
          updateRef.current(merged);
        }
      } catch (error) {
        // Website sync is an enhancement. A temporary website/network problem
        // must never block the CRM or replace its existing event data.
        console.warn('Website event sync failed', error);
      } finally {
        running = false;
      }
    };

    // Give the normal Google Sheet load a moment to finish before the first
    // merge, then keep public event fields fresh while the app stays open.
    const initial = window.setTimeout(() => void sync(), 1200);
    const interval = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loading]);

  return null;
}
