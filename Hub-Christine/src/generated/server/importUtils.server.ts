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
