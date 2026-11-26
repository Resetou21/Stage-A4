export interface ChantierCommercial {
  id: string;
  name: string;
  groupId: string;
  groupTitle: string;
  codeChantier: string;
  animateur: string;
  ville: string;
  provenance: string;
  activite: string;
  caAnnuel: string;
  heuresMois: number;
  dateDebut: string;
  dateFin: string;
  raisonArret: string;
  sensible: boolean;
  hasHygiene: boolean;
  qualite: string;
}

export interface CommercialDataset {
  items: ChantierCommercial[];
  syncTime: string;
  ts: number;
}

export const BOARD_CHANTIERS_ID = 1976599627;
const CACHE_KEY = 'facility_commercial_hub_v2';
const CACHE_TTL_MS = 15 * 60 * 1000;

// Requête légère (id + text uniquement, sans les blobs JSON `value` -> 3x plus rapide)
const COMMERCIAL_COL_IDS = [
  'text_mm2kscgb',     // Code Chantier
  'color_mkrbk3jy',    // ANIMATEUR
  'color_mkrb1yqe',    // VILLE
  'color_mm0y5esk',    // Provenance
  'color_mm0v1k6a',    // Activité
  'dropdown_mkx4e64m', // Activité principale
  'color_mkx443a0',    // 💶CA annuel
  'numeric_mkxwwma1',  // H par mois
  'date_mkx4mzcy',     // ➕ chantiers
  'date_mkx4kna3',     // ➖ chantiers
  'dropdown_mkx4bmvr', // Raison arrêt
  'boolean_mm0v3fg',   // Sensible ?
  'color_mm8chjrx',    // 🅰️élément d'Hygienne ?
  'color_mkzyheka',    // 🅰️Résultat dernier contrôle
];

let memoryCache: CommercialDataset | null = null;
let inflightPromise: Promise<CommercialDataset> | null = null;

export const getCachedCommercialData = (): CommercialDataset | null => {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        memoryCache = {
          items: parsed.items,
          syncTime: parsed.syncTime || '',
          ts: parsed.ts || 0,
        };
        return memoryCache;
      }
    }
  } catch {
    // ignore
  }
  return null;
};

export const isCommercialCacheFresh = (data: CommercialDataset | null): boolean => {
  if (!data || !data.ts) return false;
  return Date.now() - data.ts < CACHE_TTL_MS;
};

const parseCheckboxText = (txt: string): boolean => {
  const t = txt.trim().toLowerCase();
  return t === 'v' || t === 'true' || t === 'oui' || t === '1';
};

export const fetchCommercialDataset = async (
  monday: any,
  force = false
): Promise<CommercialDataset> => {
  const cached = getCachedCommercialData();
  if (!force && cached && isCommercialCacheFresh(cached)) {
    return cached;
  }

  // Mutualise les requêtes simultanées (ex: prefetch accueil + clic utilisateur)
  if (!force && inflightPromise) {
    return inflightPromise;
  }

  const run = (async (): Promise<CommercialDataset> => {
    const colIdsStr = COMMERCIAL_COL_IDS.map((id) => `"${id}"`).join(', ');
    let cursor: string | null = null;
    const allRaw: any[] = [];
    let pages = 0;

    do {
      pages++;
      const query = cursor
        ? `query ($c: String!) {
            next_items_page(limit: 500, cursor: $c) {
              cursor
              items {
                id
                name
                group { id title }
                column_values(ids: [${colIdsStr}]) { id text }
              }
            }
          }`
        : `query {
            boards(ids: [${BOARD_CHANTIERS_ID}]) {
              items_page(limit: 500) {
                cursor
                items {
                  id
                  name
                  group { id title }
                  column_values(ids: [${colIdsStr}]) { id text }
                }
              }
            }
          }`;

      const res: any = cursor
        ? await monday.api(query, { variables: { c: cursor } })
        : await monday.api(query);

      const page = cursor ? res?.data?.next_items_page : res?.data?.boards?.[0]?.items_page;
      if (page?.items?.length) {
        allRaw.push(...page.items);
      }
      cursor = page?.cursor || null;
    } while (cursor && pages < 10);

    const mapped: ChantierCommercial[] = allRaw.map((it) => {
      const byId = new Map<string, string>();
      (it.column_values || []).forEach((cv: any) => {
        if (cv?.id) byId.set(cv.id, String(cv.text || '').trim());
      });
      const getTxt = (id: string) => byId.get(id) || '';
      const hoursRaw = parseFloat(getTxt('numeric_mkxwwma1').replace(',', '.'));
      const hygieneTxt = getTxt('color_mm8chjrx').toLowerCase();

      return {
        id: String(it.id),
        name: String(it.name || '').trim(),
        groupId: String(it.group?.id || ''),
        groupTitle: String(it.group?.title || ''),
        codeChantier: getTxt('text_mm2kscgb'),
        animateur: getTxt('color_mkrbk3jy'),
        ville: getTxt('color_mkrb1yqe'),
        provenance: getTxt('color_mm0y5esk'),
        activite: getTxt('color_mm0v1k6a') || getTxt('dropdown_mkx4e64m'),
        caAnnuel: getTxt('color_mkx443a0'),
        heuresMois: Number.isFinite(hoursRaw) ? hoursRaw : 0,
        dateDebut: getTxt('date_mkx4mzcy'),
        dateFin: getTxt('date_mkx4kna3'),
        raisonArret: getTxt('dropdown_mkx4bmvr'),
        sensible: parseCheckboxText(getTxt('boolean_mm0v3fg')),
        hasHygiene: hygieneTxt === 'oui' || hygieneTxt.includes('oui') || hygieneTxt.includes('hygi'),
        qualite: getTxt('color_mkzyheka'),
      };
    });

    const dataset: CommercialDataset = {
      items: mapped,
      syncTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      ts: Date.now(),
    };

    memoryCache = dataset;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataset));
    } catch {
      // ignore quota error
    }
    return dataset;
  })();

  inflightPromise = run;
  try {
    return await run;
  } finally {
    if (inflightPromise === run) {
      inflightPromise = null;
    }
  }
};

export const prefetchCommercialData = (monday: any) => {
  const cached = getCachedCommercialData();
  if (cached && isCommercialCacheFresh(cached)) return;
  void fetchCommercialDataset(monday, false).catch(() => {
    // silencieux en arrière-plan
  });
};
