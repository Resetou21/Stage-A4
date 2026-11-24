// Outils partagés pour la détection exhaustive des doublons lors des imports
type Gql = (q: string, v: Record<string, unknown>) => Promise<any>;

const clean = (s: string) => {
  const t = (s ?? '').trim();
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? String(n) : t.toLowerCase();
};

// Valeur préparée pour l'import → texte comparable
export function valText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return clean(String(v));
  const o = v as { date?: string; label?: string; labels?: string[] };
  if (o.date) return o.date;
  if (o.label) return clean(o.label);
  if (o.labels) return clean(o.labels.join(', '));
  return '';
}

export const makeKey = (name: string, parts: string[]) => [clean(name), ...parts].join('|');

export const normAmt = (v: unknown): string => {
  const s = String(v ?? '')
    .replace(/[\s\u00A0\u202F€]/g, '')
    .replace(',', '.')
    .replace(/eur/gi, '')
    .trim();
  if (!s) return '';
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : '';
};

export const normPlate = (v: unknown): string =>
  String(v ?? '')
    .split('(')[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

export const normToken = (v: unknown): string =>
  String(v ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();

export const DATA_VEHICULE_BOARD_ID = 5092124669;

/**
 * Lit TOUTES les lignes existantes d'un groupe de « Data sur véhicule » (5092124669)
 * et retourne un compteur (multiset) par empreinte métier.
 * Le compteur garantit qu'on ignore uniquement le nombre exact de lignes déjà présentes
 * sans jamais bloquer une vraie nouvelle ligne (y compris 2 pleins/recharges identiques le même jour).
 */
export async function fetchDataVehiculeCounts(
  gql: Gql,
  groupId: 'group_mm0xf5pd' | 'group_mm0xzegn'
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const addKey = (k: string) => {
    if (!k) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };

  let cursor: string | null = null;
  let first = true;
  const isChargemap = groupId === 'group_mm0xf5pd';

  while (first || cursor) {
    const q = first
      ? `query {
          boards(ids: [${DATA_VEHICULE_BOARD_ID}]) {
            groups(ids: ["${groupId}"]) {
              items_page(limit: 500) {
                cursor
                items {
                  date4: column_values(ids: ["date4"]) { text }
                  montant: column_values(ids: ["numeric_mm0r8ag0"]) { text }
                  carte: column_values(ids: ["text_mm0xccqy"]) { text }
                  immat: column_values(ids: ["text_mm0xqkkm"]) { text }
                  immatParc: column_values(ids: ["lookup_mm969ea3"]) { ... on MirrorValue { display_value } text }
                  kwh: column_values(ids: ["numeric_mm2749jt"]) { text }
                }
              }
            }
          }
        }`
      : `query ($c: String!) {
          next_items_page(limit: 500, cursor: $c) {
            cursor
            items {
              date4: column_values(ids: ["date4"]) { text }
              montant: column_values(ids: ["numeric_mm0r8ag0"]) { text }
              carte: column_values(ids: ["text_mm0xccqy"]) { text }
              immat: column_values(ids: ["text_mm0xqkkm"]) { text }
              immatParc: column_values(ids: ["lookup_mm969ea3"]) { ... on MirrorValue { display_value } text }
              kwh: column_values(ids: ["numeric_mm2749jt"]) { text }
            }
          }
        }`;

    const res: any = await gql(q, first ? {} : { c: cursor });
    const page = first ? res?.boards?.[0]?.groups?.[0]?.items_page : res?.next_items_page;
    first = false;

    for (const it of page?.items ?? []) {
      const date = (it.date4?.[0]?.text ?? '').trim().slice(0, 10);
      const amt = normAmt(it.montant?.[0]?.text);
      if (!date || !amt) continue;

      const carte = normToken(it.carte?.[0]?.text);
      const rawImmat = it.immat?.[0]?.text || it.immatParc?.[0]?.display_value || it.immatParc?.[0]?.text || '';
      const plate = normPlate(rawImmat);
      const kwh = normAmt(it.kwh?.[0]?.text);

      if (isChargemap) {
        if (carte) addKey(`cm_b|${date}|${amt}|${carte}|${kwh}`);
        if (plate) addKey(`cm_i|${date}|${amt}|${plate}|${kwh}`);
      } else {
        if (plate) addKey(`tot|${date}|${amt}|${plate}`);
      }
    }

    cursor = page?.cursor ?? null;
  }

  return counts;
}

/** Consomme 1 occurrence d'une des clés candidates dans le multiset si présente (retourne true si doublon). */
export function consumeDuplicateKey(counts: Map<string, number>, candidateKeys: string[]): boolean {
  const matched = candidateKeys.filter((k) => k && (counts.get(k) ?? 0) > 0);
  if (matched.length === 0) return false;
  // Décrémenter toutes les clés candidates correspondantes pour garder le multiset cohérent
  for (const k of matched) {
    const cur = counts.get(k) ?? 0;
    if (cur > 0) counts.set(k, cur - 1);
  }
  return true;
}

// Lit TOUTES les lignes existantes du tableau sans limitation à 500 lignes grâce à next_items_page
export async function fetchKeys(gql: Gql, boardId: number, colIds: string[]): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | null = null;
  let first = true;
  const colIdsJson = JSON.stringify(colIds);

  while (first || cursor) {
    type Page = {
      cursor: string | null;
      items: { name: string; column_values: { id: string; text: string | null }[] }[];
    };

    let res: any;
    if (first) {
      const q = `
        query {
          boards(ids: [${boardId}]) {
            items_page(limit: 500) {
              cursor
              items {
                name
                column_values(ids: ${colIdsJson}) {
                  id
                  text
                }
              }
            }
          }
        }
      `;
      res = await gql(q, {});
    } else {
      const q = `
        query ($c: String!) {
          next_items_page(limit: 500, cursor: $c) {
            cursor
            items {
              name
              column_values(ids: ${colIdsJson}) {
                id
                text
              }
            }
          }
        }
      `;
      res = await gql(q, { c: cursor });
    }

    const page: Page | undefined = first ? res?.boards?.[0]?.items_page : res?.next_items_page;
    first = false;

    for (const it of page?.items ?? []) {
      const byId = new Map(it.column_values.map((c) => [c.id, c.text ?? '']));
      keys.push(makeKey(it.name, colIds.map((id) => clean(byId.get(id) ?? ''))));
    }

    cursor = page?.cursor ?? null;
  }

  return keys;
}
