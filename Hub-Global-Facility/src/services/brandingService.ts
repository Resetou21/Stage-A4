export const BOARD_BRANDING_ID = 5108738585;

export const BRANDING_COLS = {
  key: 'text_mm9gdms9',
  title: 'text_mm9gj2ec',
  description: 'long_text_mm9ghzj8',
  image: 'file_mm9g9c2q',
  imageUrl: 'text_mm9gnr0z',
} as const;

export type BrandingSlotKey =
  | 'hero'
  | 'secteurs'
  | 'atelier'
  | 'facturation'
  | 'commercial'
  | 'direction'
  | 'finance'
  | 'salaries';

export interface BrandingOverride {
  itemId?: string;
  key: BrandingSlotKey;
  title?: string;
  description?: string;
  imageUrl?: string;
}

export type BrandingMap = Partial<Record<BrandingSlotKey, BrandingOverride>>;

const BRANDING_CACHE_KEY = 'facility_hub_branding_v1';

export function readCachedBranding(): BrandingMap {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.data && typeof parsed.data === 'object') {
        return parsed.data as BrandingMap;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export function writeCachedBranding(map: BrandingMap) {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: map }));
  } catch {
    // ignore
  }
}

export async function fetchBranding(monday: any): Promise<BrandingMap> {
  const q = `query {
    boards(ids: [${BOARD_BRANDING_ID}]) {
      items_page(limit: 50) {
        items {
          id
          name
          state
          column_values(ids: [
            "${BRANDING_COLS.key}",
            "${BRANDING_COLS.title}",
            "${BRANDING_COLS.description}",
            "${BRANDING_COLS.image}",
            "${BRANDING_COLS.imageUrl}"
          ]) {
            id
            text
            value
            ... on FileValue {
              files {
                ... on FileAssetValue {
                  name
                  asset {
                    url
                    public_url
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res: any = await monday.api(q);
  const rawItems: any[] = res?.data?.boards?.[0]?.items_page?.items || [];
  const map: BrandingMap = {};

  rawItems
    .filter((it) => !it.state || it.state === 'active')
    .forEach((it) => {
      const byId = new Map<string, any>();
      (it.column_values || []).forEach((cv: any) => {
        if (cv?.id) byId.set(cv.id, cv);
      });

      const rawKey = (byId.get(BRANDING_COLS.key)?.text || it.name || '').trim().toLowerCase() as BrandingSlotKey;
      if (!rawKey) return;

      const title = String(byId.get(BRANDING_COLS.title)?.text || '').trim() || undefined;
      const description = String(byId.get(BRANDING_COLS.description)?.text || '').trim() || undefined;

      // Priorité : fichier uploadé le plus récent dans Monday > URL image manuelle
      let imageUrl = '';
      const fileCv = byId.get(BRANDING_COLS.image);
      if (fileCv?.files && fileCv.files.length > 0) {
        const lastFile = fileCv.files[fileCv.files.length - 1];
        imageUrl = lastFile?.asset?.public_url || lastFile?.asset?.url || '';
      }
      if (!imageUrl) {
        const urlCol = String(byId.get(BRANDING_COLS.imageUrl)?.text || '').trim();
        if (/^(https?:\/\/|\.\/|data:image\/)/i.test(urlCol)) {
          imageUrl = urlCol;
        }
      }

      map[rawKey] = {
        itemId: String(it.id),
        key: rawKey,
        title,
        description,
        imageUrl: imageUrl || undefined,
      };
    });

  writeCachedBranding(map);
  return map;
}

async function uploadBrandingImage(monday: any, itemId: string, file: File): Promise<string | undefined> {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${itemId}, column_id: "${BRANDING_COLS.image}", file: $file) {
      id
      public_url
      url
    }
  }`;

  // 1. Essai via SDK monday.api
  try {
    const res: any = await (monday as any).api(mutation, { variables: { file } });
    const asset = res?.data?.add_file_to_column;
    if (asset?.public_url || asset?.url) {
      return asset.public_url || asset.url;
    }
  } catch (err) {
    console.warn('[Studio Comm] Upload image via monday.api échoué, fallback fetch:', err);
  }

  // 2. Fallback direct via fetch /v2/file
  try {
    let token = '';
    try {
      const sessionRes: any = await (monday as any).get('sessionToken');
      token = sessionRes?.data || '';
    } catch {
      // ignore
    }
    const formData = new FormData();
    formData.append('query', mutation);
    formData.append('variables[file]', file);
    const headers: Record<string, string> = { 'API-Version': '2024-04' };
    if (token) headers['Authorization'] = token;

    const res = await fetch('https://api.monday.com/v2/file', {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await res.json();
    const asset = json?.data?.add_file_to_column;
    if (asset?.public_url || asset?.url) {
      return asset.public_url || asset.url;
    }
  } catch (err) {
    console.warn('[Studio Comm] Fallback fetch /v2/file échoué:', err);
  }

  return undefined;
}

export async function saveBrandingSlot(
  monday: any,
  existingMap: BrandingMap,
  payload: {
    key: BrandingSlotKey;
    label: string;
    title: string;
    description: string;
    imageUrlText: string;
    imageFile?: File | null;
    clearUploadedImage?: boolean;
  }
): Promise<BrandingOverride> {
  const current = existingMap[payload.key];
  let itemId = current?.itemId;

  const colObj: Record<string, any> = {
    [BRANDING_COLS.key]: payload.key,
    [BRANDING_COLS.title]: payload.title.trim(),
    [BRANDING_COLS.description]: { text: payload.description.trim() },
    [BRANDING_COLS.imageUrl]: payload.imageUrlText.trim(),
  };

  if (payload.clearUploadedImage) {
    colObj[BRANDING_COLS.image] = { clear_all: true };
  }

  if (itemId) {
    const mut = `mutation ($itemId: ID!, $vals: JSON!) {
      change_multiple_column_values(board_id: ${BOARD_BRANDING_ID}, item_id: $itemId, column_values: $vals) {
        id
      }
    }`;
    const res: any = await monday.api(mut, {
      variables: { itemId, vals: JSON.stringify(colObj) },
    });
    if (res?.errors?.length) {
      throw new Error(res.errors.map((e: any) => e.message).join(' | '));
    }
  } else {
    const mut = `mutation ($name: String!, $vals: JSON!) {
      create_item(board_id: ${BOARD_BRANDING_ID}, item_name: $name, column_values: $vals) {
        id
      }
    }`;
    const res: any = await monday.api(mut, {
      variables: { name: payload.label, vals: JSON.stringify(colObj) },
    });
    if (res?.errors?.length) {
      throw new Error(res.errors.map((e: any) => e.message).join(' | '));
    }
    itemId = String(res?.data?.create_item?.id || '');
    if (!itemId) {
      throw new Error('Impossible de sauvegarder sur le tableau Studio Communication.');
    }
  }

  let finalImageUrl = payload.clearUploadedImage
    ? payload.imageUrlText.trim() || undefined
    : payload.imageUrlText.trim() || current?.imageUrl;

  if (payload.imageFile && itemId) {
    // Si une nouvelle image est envoyée, on nettoie l'ancienne colonne fichier pour éviter les doublons
    try {
      await monday.api(
        `mutation ($itemId: ID!) {
          change_column_value(board_id: ${BOARD_BRANDING_ID}, item_id: $itemId, column_id: "${BRANDING_COLS.image}", value: "{\\"clear_all\\":true}") { id }
        }`,
        { variables: { itemId } }
      );
    } catch {
      // ignore
    }
    const uploadedUrl = await uploadBrandingImage(monday, itemId, payload.imageFile);
    if (uploadedUrl) {
      finalImageUrl = uploadedUrl;
    }
  }

  return {
    itemId,
    key: payload.key,
    title: payload.title.trim() || undefined,
    description: payload.description.trim() || undefined,
    imageUrl: finalImageUrl || undefined,
  };
}

export async function resetBrandingSlot(
  monday: any,
  existingMap: BrandingMap,
  key: BrandingSlotKey
): Promise<void> {
  const itemId = existingMap[key]?.itemId;
  if (!itemId) return;
  const mut = `mutation ($itemId: ID!) {
    archive_item(item_id: $itemId) { id }
  }`;
  await monday.api(mut, { variables: { itemId } });
}
