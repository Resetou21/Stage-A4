import mondaySdk from 'monday-sdk-js';
import { toast } from 'sonner';

export const monday = mondaySdk();

let activeRequests = 0;
const MAX_CONCURRENT = 5;
const waitQueue: Array<() => void> = [];

const inFlightRequests = new Map<string, Promise<any>>();
const queryCache = new Map<string, { expires: number; data: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_PREFIX = 'hc_mcache_v1_';

function hashKey(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function getSessionCached(cacheKey: string): any | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + hashKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.k === cacheKey && typeof parsed.expires === 'number' && Date.now() < parsed.expires) {
      return parsed.data;
    }
  } catch {}
  return null;
}

function setSessionCached(cacheKey: string, data: any, expires: number) {
  try {
    const payload = JSON.stringify({ k: cacheKey, expires, data });
    if (payload.length < 400_000) {
      sessionStorage.setItem(SESSION_PREFIX + hashKey(cacheKey), payload);
    }
  } catch {}
}

export function clearBoardCache(boardId?: string | number) {
  if (!boardId) {
    queryCache.clear();
    inFlightRequests.clear();
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k);
      }
    } catch {}
    return;
  }
  const bStr = String(boardId);
  for (const key of Array.from(queryCache.keys())) {
    if (key.includes(bStr)) {
      queryCache.delete(key);
    }
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX)) {
        const raw = sessionStorage.getItem(k);
        if (raw && raw.includes(bStr)) sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot() {
  activeRequests--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    if (next) next();
  }
}

export async function callMondayApi(query: string, options?: any): Promise<any> {
  const isRead = !query.includes('mutation');
  const cacheKey = isRead ? `${query}::${JSON.stringify(options ?? {})}` : null;

  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    const sess = getSessionCached(cacheKey);
    if (sess !== null) {
      queryCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data: sess });
      return sess;
    }
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  } else {
    const match = query.match(/board_id:\s*["']?(\d+)["']?/);
    if (match && match[1]) {
      clearBoardCache(match[1]);
    }
  }

  const exec = async () => {
    await acquireSlot();
    let delay = 1000;
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          const res: any = await monday.api(query, options);
          if (res?.errors && res.errors.length > 0) {
            const isRateLimit = res.errors.some((e: any) => {
              const m = String(e?.message || '').toLowerCase();
              return m.includes('rate limit') || m.includes('complexity');
            });
            if (isRateLimit && attempt < 3) {
              const retryErr = res.errors.find((e: any) => e?.extensions?.retry_in_seconds);
              const retryAfterSec = retryErr?.extensions?.retry_in_seconds;
              const waitMs = retryAfterSec ? (Number(retryAfterSec) + 1) * 1000 : delay;
              console.warn(`[BoardSDK] Budget complexité Monday dépassé, attente de ${waitMs}ms... (tentative ${attempt + 1}/3)`);
              await new Promise((r) => setTimeout(r, waitMs));
              delay = Math.max(delay * 1.5, 2000);
              continue;
            }
            const nonRateLimit = res.errors.filter((e: any) => {
              const m = String(e?.message || '').toLowerCase();
              return !m.includes('rate limit') && !m.includes('complexity');
            });
            if (nonRateLimit.length > 0) {
              const msg = nonRateLimit.map((e: any) => e.message || JSON.stringify(e)).join(' | ');
              console.error('[BoardSDK Error]:', msg);
              toast.error(`Accès Monday : ${msg}`, { id: 'monday-board-perm-err', duration: 10000 });
            }
          }
          return res?.data ?? res;
        } catch (err: any) {
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        }
      }
    } finally {
      releaseSlot();
      if (cacheKey) inFlightRequests.delete(cacheKey);
    }
  };

  const p = exec();
  if (cacheKey) {
    inFlightRequests.set(cacheKey, p);
    p.then((data) => {
      if (data && !data.errors) {
        const expires = Date.now() + CACHE_TTL_MS;
        queryCache.set(cacheKey, { expires, data });
        setSessionCached(cacheKey, data, expires);
      }
    }).catch(() => {});
  }
  return p;
}
