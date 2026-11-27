export const BOARD_NEWS_ID = 5108705371;

export const NEWS_COLS = {
  content: 'long_text_mm9gnh5f',
  category: 'text_mm9grd0s',
  author: 'text_mm9g6k43',
  date: 'date_mm9g5z9f',
  active: 'boolean_mm9gdhjz',
  image: 'file_mm9g61wv',
} as const;

export const CUSTOM_NEWS_CACHE_KEY = 'facility_custom_news_v2';

export interface CustomNewsItem {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  date: string;
  active: boolean;
  imageUrl?: string;
}

export const NEWS_CATEGORIES = [
  { id: 'Vie d’entreprise', tagColor: '#1B4565', tagBg: '#EBF6FC', accentColor: '#39A9DC' },
  { id: 'Info RH / Salariés', tagColor: '#0E7042', tagBg: '#E6F9F1', accentColor: '#00C875' },
  { id: 'Sécurité / Qualité', tagColor: '#D66927', tagBg: '#FFF4EB', accentColor: '#D66927' },
  { id: 'Commercial', tagColor: '#B87414', tagBg: '#FEF6E7', accentColor: '#F7AC37' },
  { id: 'Nouveauté Hub', tagColor: '#6D28D9', tagBg: '#F3E8FF', accentColor: '#7C3AED' },
] as const;

export function getNewsCategoryStyle(cat: string) {
  const found = NEWS_CATEGORIES.find((c) => c.id.toLowerCase() === (cat || '').toLowerCase());
  return found || NEWS_CATEGORIES[0];
}

export function fmtNewsDateFr(isoDate: string): string {
  if (!isoDate) return '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return isoDate;
}

export function readCachedCustomNews(): CustomNewsItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_NEWS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < 5 * 60 * 1000 && Array.isArray(parsed.items)) {
        return parsed.items;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function writeCachedCustomNews(items: CustomNewsItem[]) {
  try {
    localStorage.setItem(CUSTOM_NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {
    // ignore
  }
}

export async function fetchCustomNews(monday: any, force = false): Promise<CustomNewsItem[]> {
  if (!force) {
    const cached = readCachedCustomNews();
    if (cached.length > 0) return cached;
  }

  const q = `query {
    boards(ids: [${BOARD_NEWS_ID}]) {
      items_page(limit: 60) {
        items {
          id
          name
          state
          column_values(ids: ["${NEWS_COLS.content}", "${NEWS_COLS.category}", "${NEWS_COLS.author}", "${NEWS_COLS.date}", "${NEWS_COLS.active}", "${NEWS_COLS.image}"]) {
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
  const raw = res?.data?.boards?.[0]?.items_page?.items || [];
  const list: CustomNewsItem[] = raw
    .filter((it: any) => !it.state || it.state === 'active')
    .map((it: any) => {
      const byId = new Map<string, any>();
      (it.column_values || []).forEach((cv: any) => byId.set(cv.id, cv));

      const activeCv = byId.get(NEWS_COLS.active);
      let isAct = activeCv?.text === 'v' || activeCv?.text === 'true';
      if (!isAct && activeCv?.value) {
        try {
          const p = JSON.parse(activeCv.value);
          isAct = p?.checked === true || p?.checked === 'true';
        } catch {
          // ignore
        }
      }

      const fileCv = byId.get(NEWS_COLS.image);
      let imageUrl = '';
      if (fileCv?.files && fileCv.files.length > 0) {
        imageUrl = fileCv.files[0]?.asset?.public_url || fileCv.files[0]?.asset?.url || '';
      } else if (fileCv?.text && /^https?:\/\//i.test(fileCv.text)) {
        imageUrl = fileCv.text.trim();
      }

      return {
        id: String(it.id),
        title: String(it.name || '').trim(),
        content: String(byId.get(NEWS_COLS.content)?.text || '').trim(),
        category: String(byId.get(NEWS_COLS.category)?.text || NEWS_CATEGORIES[0].id).trim(),
        author: String(byId.get(NEWS_COLS.author)?.text || '').trim(),
        date: String(byId.get(NEWS_COLS.date)?.text || '').trim(),
        active: isAct,
        imageUrl: imageUrl || undefined,
      };
    })
    .filter((x: CustomNewsItem) => x.title)
    .sort((a: CustomNewsItem, b: CustomNewsItem) => (b.date || '').localeCompare(a.date || ''));

  writeCachedCustomNews(list);
  return list;
}

async function uploadNewsImage(monday: any, itemId: string, file: File): Promise<string | undefined> {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${itemId}, column_id: "${NEWS_COLS.image}", file: $file) {
      id
      public_url
      url
    }
  }`;

  try {
    const res: any = await (monday as any).api(mutation, { variables: { file } });
    const asset = res?.data?.add_file_to_column;
    if (asset?.public_url || asset?.url) {
      return asset.public_url || asset.url;
    }
  } catch (err) {
    console.warn('[News] Upload image via monday.api échoué:', err);
  }
  return undefined;
}

export async function createCustomNews(
  monday: any,
  payload: {
    title: string;
    content: string;
    category: string;
    author: string;
    imageFile?: File | null;
  },
): Promise<CustomNewsItem> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const colVals = JSON.stringify({
    [NEWS_COLS.content]: { text: payload.content.trim() },
    [NEWS_COLS.category]: payload.category,
    [NEWS_COLS.author]: payload.author,
    [NEWS_COLS.date]: { date: todayIso },
    [NEWS_COLS.active]: { checked: 'true' },
  });

  const mut = `mutation ($name: String!, $vals: JSON!) {
    create_item(board_id: ${BOARD_NEWS_ID}, item_name: $name, column_values: $vals) {
      id
    }
  }`;
  const res: any = await monday.api(mut, { variables: { name: payload.title.trim(), vals: colVals } });
  const newId = String(res?.data?.create_item?.id || '');
  if (!newId) {
    throw new Error('Impossible de créer l’actualité sur Monday.');
  }

  let imageUrl: string | undefined;
  if (payload.imageFile) {
    imageUrl = await uploadNewsImage(monday, newId, payload.imageFile);
  }

  return {
    id: newId,
    title: payload.title.trim(),
    content: payload.content.trim(),
    category: payload.category,
    author: payload.author,
    date: todayIso,
    active: true,
    imageUrl,
  };
}

export async function toggleCustomNewsActive(monday: any, itemId: string, nextActive: boolean): Promise<void> {
  const val = nextActive ? JSON.stringify({ checked: 'true' }) : JSON.stringify({});
  const mut = `mutation ($itemId: ID!, $val: JSON!) {
    change_column_value(board_id: ${BOARD_NEWS_ID}, item_id: $itemId, column_id: "${NEWS_COLS.active}", value: $val) { id }
  }`;
  await monday.api(mut, { variables: { itemId, val } });
}
