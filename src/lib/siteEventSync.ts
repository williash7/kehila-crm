import { Activity, normalizeActivity } from './activities';
import { getOrg } from './orgConfig';

const WEBSITE_SYNC_URL_KEY = 'website_sync_url_v1';

export type WebsiteEvent = {
  slug: string;
  titleHe: string;
  titleRu: string;
  kickerHe?: string;
  kickerRu?: string;
  introHe?: string;
  introRu?: string;
  bodyHe?: string;
  bodyRu?: string;
  detailsHe?: string;
  detailsRu?: string;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  hasRegistration?: boolean;
  showOnHome?: boolean;
  sortOrder?: number;
  url?: string;
};

type WebsiteFeed = {
  version?: number;
  generatedAt?: string;
  events?: WebsiteEvent[];
};

type WebsiteLinkedActivity = Activity & {
  source?: string;
  siteSlug?: string;
  siteUrl?: string;
  siteTitleRu?: string;
  siteDetailsRu?: string;
  siteSyncedAt?: string;
};

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * The CRM stays generic. A specific organization can connect its public site
 * once, without baking that site into the shared application code.
 *
 * Opening the app with ?websiteSync=https://example.org stores the connection
 * locally. From then on normal app opens use the stored URL automatically.
 */
export function getWebsiteSyncUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = cleanBaseUrl(params.get('websiteSync') || '');
    if (fromQuery && /^https:\/\//i.test(fromQuery)) {
      localStorage.setItem(WEBSITE_SYNC_URL_KEY, fromQuery);
      return fromQuery;
    }
    return cleanBaseUrl(localStorage.getItem(WEBSITE_SYNC_URL_KEY) || '');
  } catch {
    return '';
  }
}

export function setWebsiteSyncUrl(value: string): string {
  const normalized = cleanBaseUrl(value);
  try {
    if (normalized) localStorage.setItem(WEBSITE_SYNC_URL_KEY, normalized);
    else localStorage.removeItem(WEBSITE_SYNC_URL_KEY);
  } catch {
    // Storage can be unavailable in private browsing. The caller can retry.
  }
  return normalized;
}

function dateTimeParts(iso: string, tzid: string): { date: string; time: string } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzid,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(parsed);
    const get = (type: string) => parts.find(part => part.type === type)?.value || '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    if (year && month && day) return { date: `${year}-${month}-${day}`, time: hour && minute ? `${hour}:${minute}` : '' };
  } catch {
    // fallback below
  }
  return {
    date: parsed.toISOString().slice(0, 10),
    time: parsed.toISOString().slice(11, 16),
  };
}

function mappedActivity(event: WebsiteEvent): WebsiteLinkedActivity | null {
  if (!event?.slug || !event?.titleHe || !event.eventStartsAt) return null;
  const org = getOrg();
  const parts = dateTimeParts(event.eventStartsAt, org.tzid || 'Asia/Jerusalem');
  if (!parts) return null;
  const location = [org.venueName, org.address, org.city].map(v => String(v || '').trim()).filter(Boolean).join(' · ');

  return normalizeActivity({
    id: `site:${event.slug}`,
    name: event.titleHe,
    activityKind: 'special',
    type: 'event',
    freq: 'oneoff',
    date: parts.date,
    time: parts.time,
    location,
    purposeTag: event.titleHe,
    purposeTags: [event.titleHe],
    notes: [event.introHe, event.bodyHe, event.detailsHe].map(v => String(v || '').trim()).filter(Boolean).join('\n\n'),
    source: 'website',
    siteSlug: event.slug,
    siteUrl: event.url || '',
    siteTitleRu: event.titleRu || '',
    siteDetailsRu: event.detailsRu || '',
    siteSyncedAt: new Date().toISOString(),
  }) as WebsiteLinkedActivity;
}

export async function fetchWebsiteEvents(): Promise<WebsiteEvent[]> {
  const websiteUrl = getWebsiteSyncUrl();
  if (!websiteUrl) return [];
  const response = await fetch(`${websiteUrl}/api/integration/events`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`website sync failed: ${response.status}`);
  const payload = await response.json() as WebsiteFeed;
  return Array.isArray(payload.events) ? payload.events : [];
}

/**
 * Public fields come from the website; operational CRM fields stay in the app.
 * This is deliberate: editing a site's title/date in the CRM would otherwise
 * create two competing sources of truth. Tasks, budget, attendance, payment
 * tracking and notes added by the CRM are preserved across every sync.
 */
export function mergeWebsiteEvents(existing: Activity[], remote: WebsiteEvent[]): Activity[] {
  const mapped = remote.map(mappedActivity).filter((x): x is WebsiteLinkedActivity => !!x);
  if (!mapped.length) return existing;

  const byId = new Map(existing.map(item => [item.id, item]));
  const remoteIds = new Set(mapped.map(item => item.id));
  const mergedRemote = mapped.map(incoming => {
    const previous = byId.get(incoming.id) as WebsiteLinkedActivity | undefined;
    if (!previous) return incoming;
    return normalizeActivity({
      ...previous,
      ...incoming,
      // Internal CRM data must never be overwritten by the public website.
      tasks: previous.tasks || [],
      performers: previous.performers || [],
      budget: previous.budget || { expenses: [], income: [] },
      attendance: previous.attendance || {},
      participants: previous.participants || {},
      entryPrice: previous.entryPrice,
      purposeTag: previous.purposeTag || incoming.purposeTag,
      purposeTags: previous.purposeTags?.length ? previous.purposeTags : incoming.purposeTags,
      // Keep user-written CRM notes and append website copy only on first import.
      notes: previous.notes || incoming.notes,
    });
  });

  // Keep activities created directly in the CRM, plus previously synced events
  // that are no longer in the public feed. The latter may contain attendance or
  // budget history and must not disappear just because an event was archived.
  const localOnly = existing.filter(item => !remoteIds.has(item.id));
  return [...localOnly, ...mergedRemote];
}
