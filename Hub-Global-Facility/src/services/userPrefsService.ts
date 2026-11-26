import { ALL_HUB_KEYS, HubKey } from '../config/hubPermissions';

export interface UserHubPrefs {
  hiddenHubs: HubKey[];
  hubOrder: HubKey[];
  showNewsCarousel: boolean;
  showStatsSection: boolean;
  viewMode: 'carousel' | 'grid';
  mobileViewMode: 'carousel' | 'grid';
}

const PREFS_STORAGE_PREFIX = 'facility_hub_prefs_v1_';

export const getDefaultUserPrefs = (): UserHubPrefs => ({
  hiddenHubs: [],
  hubOrder: [...ALL_HUB_KEYS],
  showNewsCarousel: true,
  showStatsSection: true,
  viewMode: 'carousel',
  mobileViewMode: 'grid',
});

export const normalizeUserKey = (userEmail?: string, userName?: string): string => {
  const raw = (userEmail || userName || 'default')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return raw || 'default';
};

export const sanitizeUserPrefs = (raw: Partial<UserHubPrefs> | null | undefined): UserHubPrefs => {
  const defaults = getDefaultUserPrefs();
  if (!raw || typeof raw !== 'object') return defaults;

  const validSet = new Set<HubKey>(ALL_HUB_KEYS);
  const hiddenHubs = Array.isArray(raw.hiddenHubs)
    ? raw.hiddenHubs.filter((k): k is HubKey => validSet.has(k))
    : [];

  const seenOrder = new Set<HubKey>();
  const hubOrder: HubKey[] = [];
  if (Array.isArray(raw.hubOrder)) {
    raw.hubOrder.forEach((k) => {
      if (validSet.has(k) && !seenOrder.has(k)) {
        seenOrder.add(k);
        hubOrder.push(k);
      }
    });
  }
  ALL_HUB_KEYS.forEach((k) => {
    if (!seenOrder.has(k)) {
      hubOrder.push(k);
    }
  });

  return {
    hiddenHubs,
    hubOrder,
    showNewsCarousel: typeof raw.showNewsCarousel === 'boolean' ? raw.showNewsCarousel : true,
    showStatsSection: typeof raw.showStatsSection === 'boolean' ? raw.showStatsSection : true,
    viewMode: raw.viewMode === 'grid' ? 'grid' : 'carousel',
    mobileViewMode: raw.mobileViewMode === 'carousel' ? 'carousel' : 'grid',
  };
};

export const readLocalUserPrefs = (userKey: string): UserHubPrefs => {
  try {
    const raw = localStorage.getItem(`${PREFS_STORAGE_PREFIX}${userKey}`);
    if (raw) {
      return sanitizeUserPrefs(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return getDefaultUserPrefs();
};

export const loadRemoteUserPrefs = async (
  monday: any,
  userKey: string
): Promise<UserHubPrefs | null> => {
  try {
    if (monday?.storage?.instance?.getItem) {
      const res: any = await monday.storage.instance.getItem(`hub_prefs_${userKey}`);
      const val = res?.data?.value;
      if (val) {
        const sanitized = sanitizeUserPrefs(JSON.parse(val));
        try {
          localStorage.setItem(`${PREFS_STORAGE_PREFIX}${userKey}`, JSON.stringify(sanitized));
        } catch {
          // ignore
        }
        return sanitized;
      }
    }
  } catch {
    // ignore
  }
  return null;
};

export const saveUserPrefs = async (
  monday: any,
  userKey: string,
  prefs: UserHubPrefs
): Promise<void> => {
  const sanitized = sanitizeUserPrefs(prefs);
  const serialized = JSON.stringify(sanitized);
  try {
    localStorage.setItem(`${PREFS_STORAGE_PREFIX}${userKey}`, serialized);
  } catch {
    // ignore
  }
  try {
    if (monday?.storage?.instance?.setItem) {
      await monday.storage.instance.setItem(`hub_prefs_${userKey}`, serialized);
    }
  } catch {
    // ignore
  }
};
