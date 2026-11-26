import {
  ALL_HUB_KEYS,
  HubKey,
  PERMISSIONS_BOARD_ID,
  PERMISSIONS_COLUMN_IDS,
} from '../config/hubPermissions';

export type UserHubPermissions = Record<HubKey, boolean>;

export interface PermissionRow {
  itemId: string;
  userName: string;
  email: string;
  permissions: UserHubPermissions;
}

const PERM_CACHE_KEY = 'facility_hub_permissions_v1';

let memoryRowsCache: { ts: number; rows: PermissionRow[] } | null = null;

export const createAllAllowedPermissions = (): UserHubPermissions => ({
  secteurs: true,
  atelier: true,
  facturation: true,
  fournisseurs: true,
  communication: true,
  direction: true,
  commercial: true,
});

export const createEmptyPermissions = (): UserHubPermissions => ({
  secteurs: false,
  atelier: false,
  facturation: false,
  fournisseurs: false,
  communication: false,
  direction: false,
  commercial: false,
});

export const isGuillaumeUser = (userName?: string, userEmail?: string): boolean => {
  const n = (userName || '').toLowerCase().trim();
  const e = (userEmail || '').toLowerCase().trim();
  return (
    e.includes('guillaume.daniel') ||
    e.includes('gdaniel') ||
    (n.includes('guillaume') && n.includes('daniel'))
  );
};

export const isAdminUser = (userName?: string, userEmail?: string): boolean => {
  const n = (userName || '').toLowerCase().trim();
  const e = (userEmail || '').toLowerCase().trim();
  if (e.includes('guillaume.daniel') || e.includes('lguillou')) return true;
  if (n.includes('guillaume') && n.includes('daniel')) return true;
  if (n.includes('laurent') && n.includes('guillou')) return true;
  return n === 'guillaume daniel' || n === 'guillaume' || n === 'laurent guillou';
};

const normStr = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const parseCheckboxValue = (cv: any): boolean => {
  if (!cv) return true;
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (typeof parsed?.checked === 'boolean') return parsed.checked;
      if (parsed?.checked === 'true') return true;
      if (parsed?.checked === 'false') return false;
    } catch {
      // ignore parse error
    }
  }
  const txt = String(cv.text || '').trim().toLowerCase();
  if (txt === 'v' || txt === 'true' || txt === '1' || txt === 'oui') return true;
  if (txt === '' || txt === 'false' || txt === '0' || txt === 'non') return false;
  return true;
};

export const invalidatePermissionsCache = () => {
  memoryRowsCache = null;
  try {
    localStorage.removeItem(PERM_CACHE_KEY);
  } catch {
    // ignore
  }
};

export const fetchAllPermissionsRows = async (
  monday: any,
  forceRefresh = false
): Promise<PermissionRow[]> => {
  if (!forceRefresh && memoryRowsCache && Date.now() - memoryRowsCache.ts < 60_000) {
    return memoryRowsCache.rows;
  }

  const query = `query {
    boards(ids: [${PERMISSIONS_BOARD_ID}]) {
      items_page(limit: 100) {
        items {
          id
          name
          column_values(ids: [
            "${PERMISSIONS_COLUMN_IDS.email}",
            "${PERMISSIONS_COLUMN_IDS.secteurs}",
            "${PERMISSIONS_COLUMN_IDS.atelier}",
            "${PERMISSIONS_COLUMN_IDS.facturation}",
            "${PERMISSIONS_COLUMN_IDS.fournisseurs}",
            "${PERMISSIONS_COLUMN_IDS.communication}",
            "${PERMISSIONS_COLUMN_IDS.direction}",
            "${PERMISSIONS_COLUMN_IDS.commercial}"
          ]) {
            id
            text
            value
          }
        }
      }
    }
  }`;

  const res: any = await monday.api(query);
  const rawItems: any[] = res?.data?.boards?.[0]?.items_page?.items || [];

  const rows: PermissionRow[] = rawItems.map((it) => {
    const byId = new Map<string, any>();
    (it.column_values || []).forEach((cv: any) => {
      if (cv?.id) byId.set(cv.id, cv);
    });

    const permissions: UserHubPermissions = {
      secteurs: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.secteurs)),
      atelier: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.atelier)),
      facturation: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.facturation)),
      fournisseurs: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.fournisseurs)),
      communication: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.communication)),
      direction: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.direction)),
      commercial: parseCheckboxValue(byId.get(PERMISSIONS_COLUMN_IDS.commercial)),
    };

    return {
      itemId: String(it.id),
      userName: String(it.name || '').trim(),
      email: String(byId.get(PERMISSIONS_COLUMN_IDS.email)?.text || '').trim(),
      permissions,
    };
  });

  const ts = Date.now();
  memoryRowsCache = { ts, rows };
  return rows;
};

export const fetchUserPermissions = async (
  monday: any,
  userEmail?: string,
  userName?: string,
  forceRefresh = true
): Promise<UserHubPermissions> => {
  // Les admins (Guillaume & Laurent) conservent toujours un accès complet de secours
  const adminFallback = isAdminUser(userName, userEmail);
  try {
    const rows = await fetchAllPermissionsRows(monday, forceRefresh);
    if (!rows.length) {
      return adminFallback ? createAllAllowedPermissions() : createEmptyPermissions();
    }

    const emailNorm = (userEmail || '').toLowerCase().trim();
    const nameNorm = normStr(userName || '');

    let matched: PermissionRow | undefined;
    if (emailNorm) {
      matched = rows.find((r) => r.email.toLowerCase().trim() === emailNorm);
    }
    if (!matched && nameNorm && nameNorm !== 'utilisateur') {
      matched = rows.find((r) => {
        const rowName = normStr(r.userName);
        return rowName === nameNorm || rowName.includes(nameNorm) || nameNorm.includes(rowName);
      });
    }

    if (matched) {
      return { ...matched.permissions };
    }
  } catch (err) {
    console.warn('[Hub Global] Lecture permissions impossible:', err);
  }
  return adminFallback ? createAllAllowedPermissions() : createEmptyPermissions();
};

export const updatePermissionCell = async (
  monday: any,
  itemId: string,
  hubKey: HubKey,
  checked: boolean
): Promise<boolean> => {
  const columnId = PERMISSIONS_COLUMN_IDS[hubKey];
  if (!columnId) return false;

  const colValue = JSON.stringify({ checked: checked ? 'true' : 'false' });
  const mutation = `mutation ($itemId: ID!, $val: JSON!) {
    change_column_value(
      board_id: ${PERMISSIONS_BOARD_ID},
      item_id: $itemId,
      column_id: "${columnId}",
      value: $val
    ) {
      id
    }
  }`;

  const res: any = await monday.api(mutation, {
    variables: { itemId, val: colValue },
  });

  if (res?.errors?.length) {
    throw new Error(res.errors.map((e: any) => e.message).join(' | '));
  }

  invalidatePermissionsCache();
  return true;
};

export const addPermissionUserRow = async (
  monday: any,
  userName: string,
  email: string
): Promise<PermissionRow | null> => {
  const colObj: Record<string, any> = {
    [PERMISSIONS_COLUMN_IDS.email]: email.trim(),
  };
  ALL_HUB_KEYS.forEach((k) => {
    colObj[PERMISSIONS_COLUMN_IDS[k]] = { checked: 'true' };
  });

  const mutation = `mutation ($name: String!, $colVals: JSON!) {
    create_item(
      board_id: ${PERMISSIONS_BOARD_ID},
      item_name: $name,
      column_values: $colVals
    ) {
      id
      name
    }
  }`;

  const res: any = await monday.api(mutation, {
    variables: {
      name: userName.trim(),
      colVals: JSON.stringify(colObj),
    },
  });

  const created = res?.data?.create_item;
  if (!created?.id) return null;

  invalidatePermissionsCache();
  return {
    itemId: String(created.id),
    userName: String(created.name || userName.trim()),
    email: email.trim(),
    permissions: createAllAllowedPermissions(),
  };
};

export const archivePermissionUserRow = async (
  monday: any,
  itemId: string
): Promise<boolean> => {
  const mutation = `mutation ($itemId: ID!) {
    archive_item(item_id: $itemId) {
      id
    }
  }`;

  const res: any = await monday.api(mutation, {
    variables: { itemId },
  });

  if (res?.errors?.length) {
    throw new Error(res.errors.map((e: any) => e.message).join(' | '));
  }

  invalidatePermissionsCache();
  return true;
};
