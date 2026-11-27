export const FINANCE_BOARD_IDS = {
  INFORMATIONS_MENSUELLES: 5092559599,
  IMPACT_FINANCIER: 5086406201,
  REUNION_ASSOCIES: 5099650983,
} as const;

export const REUNION_ASSOCIES_URL = `https://groupefacility.monday.com/boards/${FINANCE_BOARD_IDS.REUNION_ASSOCIES}`;
const REUNION_A_FAIRE_GROUP = 'group_mm4xx12e';
const REUNION_STATUS_COL = 'color_mm4xx268';

const IMPACT_GROUPS = {
  loss: 'topics',
  gain: 'group_mm8jm92x',
} as const;

export interface FinanceImpactItem {
  id: string;
  name: string;
  fournisseur: string;
  montant: number;
  categorie: string;
  date: string | null;
}

export interface FinanceImpactSummary {
  year: number;
  total: number;
  count: number;
  categories: Array<{ label: string; total: number }>;
  items: FinanceImpactItem[];
}

export interface MonthlyFinanceRow {
  label: string;
  date: string;
  caBudget: number | null;
  caRealise: number | null;
  resBudget: number | null;
  resRealise: number | null;
}

export interface MonthlyFinanceData {
  year: number;
  months: MonthlyFinanceRow[];
}

export interface FinanceOverviewBundle {
  year: number;
  losses: FinanceImpactSummary;
  gains: FinanceImpactSummary;
  monthly: MonthlyFinanceData;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedBundle: FinanceOverviewBundle | null = null;

export function clearFinanceCache() {
  cachedBundle = null;
}

function parseNum(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return Number.isNaN(val) ? null : val;
}

async function fetchBoardItemsAll(monday: any, boardId: number, colIds: string[]): Promise<any[]> {
  let all: any[] = [];
  let cursor: string | null = null;
  let guard = 0;

  do {
    guard++;
    const query = cursor
      ? `query ($c: String!) {
          next_items_page(limit: 500, cursor: $c) {
            cursor
            items {
              id
              name
              group { id title }
              column_values(ids: ${JSON.stringify(colIds)}) { id text value }
            }
          }
        }`
      : `query {
          boards(ids: [${boardId}]) {
            items_page(limit: 500) {
              cursor
              items {
                id
                name
                group { id title }
                column_values(ids: ${JSON.stringify(colIds)}) { id text value }
              }
            }
          }
        }`;

    const res: any = cursor
      ? await monday.api(query, { variables: { c: cursor } })
      : await monday.api(query);

    const page = cursor
      ? res?.data?.next_items_page || res?.next_items_page
      : res?.data?.boards?.[0]?.items_page || res?.boards?.[0]?.items_page;

    const items = page?.items || [];
    all = all.concat(items);
    cursor = page?.cursor || null;
  } while (cursor && guard < 10);

  return all;
}

function buildImpactSummary(rawItems: any[], groupId: string, year: number): FinanceImpactSummary {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  let total = 0;
  let count = 0;
  const cats = new Map<string, number>();
  const items: FinanceImpactItem[] = [];

  for (const it of rawItems) {
    if (it.group?.id !== groupId) continue;
    const getCol = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text?.trim() || '';
    const dateStr = getCol('date_mkxsjr3k');
    if (!dateStr || dateStr < start || dateStr > end) continue;

    const montant = parseNum(getCol('numeric_mkxsqn5a')) ?? 0;
    const fournisseur = getCol('text_mkxsem47');
    const categorie = getCol('color_mkxsg2pr');

    total += montant;
    count += 1;
    const catKey = categorie || 'Sans catégorie';
    cats.set(catKey, (cats.get(catKey) ?? 0) + montant);

    items.push({
      id: String(it.id),
      name: String(it.name || ''),
      fournisseur,
      montant,
      categorie,
      date: dateStr,
    });
  }

  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const categories = [...cats.entries()]
    .map(([label, t]) => ({ label, total: t }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  return { year, total, count, categories, items };
}

export async function fetchFinanceBundle(monday: any, force = false): Promise<FinanceOverviewBundle> {
  if (!force && cachedBundle && Date.now() - cachedBundle.fetchedAt < CACHE_TTL_MS) {
    return cachedBundle;
  }

  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [impactRaw, monthlyRaw] = await Promise.all([
    fetchBoardItemsAll(monday, FINANCE_BOARD_IDS.IMPACT_FINANCIER, [
      'date_mkxsjr3k',
      'text_mkxsem47',
      'numeric_mkxsqn5a',
      'color_mkxsg2pr',
    ]),
    fetchBoardItemsAll(monday, FINANCE_BOARD_IDS.INFORMATIONS_MENSUELLES, [
      'date_mm12ry9e',
      'numeric_mm12f91j',
      'numeric_mm12qs6w',
      'numeric_mm12edk3',
      'numeric_mm12bq7t',
    ]),
  ]);

  const losses = buildImpactSummary(impactRaw, IMPACT_GROUPS.loss, year);
  const gains = buildImpactSummary(impactRaw, IMPACT_GROUPS.gain, year);

  const months: MonthlyFinanceRow[] = [];
  for (const it of monthlyRaw) {
    const getCol = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text?.trim() || '';
    const dateStr = getCol('date_mm12ry9e');
    if (!dateStr || dateStr < start || dateStr > end) continue;
    const label = new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short' });
    months.push({
      label,
      date: dateStr,
      caBudget: parseNum(getCol('numeric_mm12f91j')),
      caRealise: parseNum(getCol('numeric_mm12qs6w')),
      resBudget: parseNum(getCol('numeric_mm12edk3')),
      resRealise: parseNum(getCol('numeric_mm12bq7t')),
    });
  }
  months.sort((a, b) => a.date.localeCompare(b.date));

  const bundle: FinanceOverviewBundle = {
    year,
    losses,
    gains,
    monthly: { year, months },
    fetchedAt: Date.now(),
  };

  cachedBundle = bundle;
  return bundle;
}

export async function addAssociateMeetingTopic(monday: any, topic: string): Promise<{ id: string; name: string }> {
  const clean = topic.trim().slice(0, 255);
  if (!clean) throw new Error('Le sujet ne peut pas être vide.');

  const colValues = JSON.stringify({
    [REUNION_STATUS_COL]: { label: 'En cours' },
  });

  const res: any = await monday.api(
    `mutation ($b: ID!, $g: String!, $n: String!, $cv: JSON!) {
      create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $cv) {
        id
        name
      }
    }`,
    {
      variables: {
        b: String(FINANCE_BOARD_IDS.REUNION_ASSOCIES),
        g: REUNION_A_FAIRE_GROUP,
        n: clean,
        cv: colValues,
      },
    }
  );

  const created = res?.data?.create_item || res?.create_item;
  if (!created?.id) {
    throw new Error('Impossible de créer le sujet dans Monday.');
  }
  return { id: String(created.id), name: String(created.name || clean) };
}
