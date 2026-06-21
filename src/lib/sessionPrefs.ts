// Session preferences: remember name/room/server and support shareable room
// links. `resolvePrefs` is pure (URL params + stored values → effective prefs).

export interface SessionPrefs {
  name: string;
  room: string;
  /** WebSocket session server URL. */
  server: string;
}

export const DEFAULT_SERVER =
  (import.meta.env.VITE_SESSION_URL as string | undefined) ??
  'ws://localhost:8787';

const STORAGE_KEY = 'jamboree.session';

/** URL query wins (shared link), then stored prefs, then defaults. */
export function resolvePrefs(
  params: URLSearchParams,
  stored: Partial<SessionPrefs> | null,
): SessionPrefs {
  return {
    name: params.get('name') ?? stored?.name ?? '',
    room: params.get('room') ?? stored?.room ?? 'jam',
    server: params.get('server') ?? stored?.server ?? DEFAULT_SERVER,
  };
}

export function loadPrefs(): SessionPrefs {
  let stored: Partial<SessionPrefs> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as Partial<SessionPrefs>) : null;
  } catch {
    // ignore unreadable/absent storage
  }
  const search = typeof location !== 'undefined' ? location.search : '';
  return resolvePrefs(new URLSearchParams(search), stored);
}

export function savePrefs(prefs: SessionPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

/** Shareable link to a room; the server is included only when non-default. */
export function buildShareLink(
  room: string,
  server: string,
  origin = typeof location !== 'undefined'
    ? `${location.origin}${location.pathname}`
    : '',
): string {
  const params = new URLSearchParams({ room });
  if (server && server !== DEFAULT_SERVER) params.set('server', server);
  return `${origin}?${params.toString()}`;
}
