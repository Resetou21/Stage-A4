import mondaySdk from "monday-sdk-js";

// Filtrer l'avertissement de dépréciation interne console.warn de monday-sdk-js
if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("monday.api() is deprecated")) {
      return;
    }
    origWarn.apply(console, args);
  };
}

const monday = mondaySdk();
const rawApi = monday.api.bind(monday);

// Moteur transparent de cache, dédoublonnage in-flight, file d'attente et retry complexité
const MAX_CONCURRENT = 5;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes (invalidation instantanée à chaque mutation)
const SESSION_PREFIX = "erp_mcache_v1_";

let activeRequests = 0;
const waitQueue: Array<() => void> = [];
const inFlightRequests = new Map<string, Promise<any>>();
const queryCache = new Map<string, { expires: number; data: any }>();

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
    if (parsed && parsed.k === cacheKey && typeof parsed.expires === "number" && Date.now() < parsed.expires) {
      return parsed.data;
    }
  } catch {
    // ignore
  }
  return null;
}

function setSessionCached(cacheKey: string, data: any, expires: number) {
  try {
    const payload = JSON.stringify({ k: cacheKey, expires, data });
    if (payload.length < 400_000) {
      sessionStorage.setItem(SESSION_PREFIX + hashKey(cacheKey), payload);
    }
  } catch {
    // ignore
  }
}

export function clearErpApiCache(boardId?: string | number) {
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
    if (key.includes(bStr)) queryCache.delete(key);
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

(monday as any).api = async (query: string, options?: any): Promise<any> => {
  const isMutation = /\bmutation\b/i.test(query);
  const bypassCache = options?.bypassCache === true;
  const cleanOptions = options && "bypassCache" in options ? { ...options } : options;
  if (cleanOptions && "bypassCache" in cleanOptions) delete cleanOptions.bypassCache;

  const cacheKey = !isMutation && !bypassCache ? `${query}::${JSON.stringify(cleanOptions ?? {})}` : null;

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
  } else if (isMutation) {
    // Toute mutation invalide immédiatement le cache concerné (ou tout le cache si boardId non présent)
    const vBoard =
      cleanOptions?.variables?.boardId ||
      cleanOptions?.variables?.board_id ||
      (Array.isArray(cleanOptions?.variables?.boardIds) ? cleanOptions.variables.boardIds[0] : undefined);
    const mBoard = query.match(/board_id:\s*["']?(\d+)["']?/);
    const targetBoard = vBoard ? String(Array.isArray(vBoard) ? vBoard[0] : vBoard) : mBoard?.[1];
    clearErpApiCache(targetBoard);
  }

  const exec = async () => {
    await acquireSlot();
    let delay = 1000;
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          const res: any = await rawApi(query, cleanOptions);
          if (res?.errors && res.errors.length > 0) {
            const isRateLimit = res.errors.some((e: any) => {
              const m = String(e?.message || "").toLowerCase();
              return m.includes("rate limit") || m.includes("complexity");
            });
            if (isRateLimit && attempt < 3) {
              const retryErr = res.errors.find((e: any) => e?.extensions?.retry_in_seconds);
              const retryAfterSec = retryErr?.extensions?.retry_in_seconds;
              const waitMs = retryAfterSec ? (Number(retryAfterSec) + 1) * 1000 : delay;
              console.warn(`[ERP-API] Budget complexité atteint, attente ${waitMs}ms (essai ${attempt + 1}/3)...`);
              await new Promise((r) => setTimeout(r, waitMs));
              delay = Math.max(delay * 1.5, 2000);
              continue;
            }
          }
          if (cacheKey && res && !res.errors) {
            const expires = Date.now() + CACHE_TTL_MS;
            queryCache.set(cacheKey, { expires, data: res });
            setSessionCached(cacheKey, res, expires);
          }
          return res;
        } catch (err: any) {
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 1.5;
        }
      }
    } finally {
      releaseSlot();
      if (cacheKey) inFlightRequests.delete(cacheKey);
    }
  };

  const p = exec();
  if (cacheKey) inFlightRequests.set(cacheKey, p);
  return p;
};

export default monday;
