import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';

const BOARD = '5092124669';
const AMOUNT_COL = 'numeric_mm0r8ag0';
const WELLBORNE_BOARD = '5106822028';
const WELLBORNE_COL = 'formula_mm8j8c6f';
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

type Col = { id: string; title: string; type: string };
type Group = { id: string; title: string };
type Item = { created_at: string; column_values: { id: string; text: string | null; display_value?: string | null }[] };
type Page = { cursor: string | null; items: Item[] };
type Gql = { executeGraphQL: (q: string, v?: Record<string, unknown>) => Promise<unknown> };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const FIELDS = 'cursor items { created_at column_values(ids: $ids) { id text ... on FormulaValue { display_value } } }';
const FR = ['janv', 'fevr', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
function parseDate(raw: string): Date {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) return new Date(Number(m[2]), Number(m[1]) - 1, 1);
  const n = norm(s);
  const idx = FR.findIndex((k) => n.startsWith(k));
  const y = n.match(/(\d{4})/);
  if (idx >= 0 && y) return new Date(Number(y[1]), idx, 1);
  return new Date(s);
}

async function monthlySums(sdk: Gql, board: string, amountCol: string, groupMatch: string[] | null, dateOverride?: string) {
  const meta = (await sdk.executeGraphQL(
    `query ($b: [ID!]) { boards(ids: $b) { columns { id title type } groups { id title } } }`, { b: [board] },
  )) as { boards?: { columns: Col[]; groups: Group[] }[] };
  const cols = meta.boards?.[0]?.columns ?? [];
  let groupId: string | null = null;
  let groupTitle: string | null = null;
  if (groupMatch) {
    const g = (meta.boards?.[0]?.groups ?? []).find((x) => groupMatch.some((k) => norm(x.title).includes(k)));
    if (!g) throw new Error(`Groupe « ${groupMatch[0]} » introuvable dans le tableau.`);
    groupId = g.id; groupTitle = g.title;
  }
  const dateCol = dateOverride ?? cols.find((c) => c.type === 'date')?.id ?? null;
  const isRealDate = !!dateCol && cols.find((c) => c.id === dateCol)?.type === 'date';
  const ids = [amountCol, ...(dateCol ? [dateCol] : [])];
  const year = new Date().getFullYear();
  const sums = Array.from({ length: 12 }, () => 0);
  const add = (items: Item[]) => {
    for (const it of items) {
      const get = (id: string) => { const v = it.column_values.find((c) => c.id === id); return v?.display_value || v?.text || ''; };
      const d = parseDate((dateCol && get(dateCol)) || it.created_at);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      const n = parseFloat(get(amountCol).replace(/\s/g, '').replace(',', '.'));
      if (!Number.isNaN(n)) sums[d.getMonth()] += n;
    }
  };
  // Filtre l'année côté monday quand la date est une vraie colonne date : beaucoup moins de lignes à lire.
  const qp = isRealDate ? { rules: [{ column_id: dateCol, compare_value: [`${year}-01-01`, `${year}-12-31`], operator: 'between' }] } : null;
  const qpArg = qp ? ', query_params: $qp' : '';
  const qpVar = qp ? ', $qp: ItemsQuery' : '';
  const q = groupId
    ? `query ($b: [ID!], $g: [String], $ids: [String!]${qpVar}) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 500${qpArg}) { ${FIELDS} } } } }`
    : `query ($b: [ID!], $ids: [String!]${qpVar}) { boards(ids: $b) { items_page(limit: 500${qpArg}) { ${FIELDS} } } }`;
  const vars: Record<string, unknown> = groupId ? { b: [board], g: [groupId], ids } : { b: [board], ids };
  if (qp) vars.qp = qp;
  const first = (await sdk.executeGraphQL(q, vars)) as {
    boards?: { items_page?: Page; groups?: { items_page: Page }[] }[];
  };
  let page = groupId ? first.boards?.[0]?.groups?.[0]?.items_page : first.boards?.[0]?.items_page;
  add(page?.items ?? []);
  let cursor = page?.cursor ?? null;
  while (cursor) {
    const next = (await sdk.executeGraphQL(
      `query ($c: String!, $ids: [String!]) { next_items_page(limit: 500, cursor: $c) { ${FIELDS} } }`, { c: cursor, ids },
    )) as { next_items_page?: Page };
    page = next.next_items_page;
    add(page?.items ?? []);
    cursor = page?.cursor ?? null;
  }
  return { sums, groupTitle, dateColumn: cols.find((c) => c.id === dateCol)?.title ?? null };
}

type Cost = { year: number; group: string; hasWellborne: boolean; dateColumn: string | null; months: { label: string; total: number; wellborne: number }[]; total: number };
const TTL = 10 * 60 * 1000;
const CACHE = new Map<string, { t: number; v: Cost }>();

// Dépenses mensuelles de l'année en cours ; pour l'électrique, ajoute les données Wellborne.
export const getMonthlyCost = createServerFn({ method: 'GET' })
  .validator(z.object({ source: z.enum(['chargemap', 'carburant']) }))
  .handler(async ({ data }) => {
    const hit = CACHE.get(data.source);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const sdk = new InformationsMensuellesBoard();
    const isElec = data.source === 'chargemap';
    const [main, well] = await Promise.all([
      monthlySums(sdk, BOARD, AMOUNT_COL, isElec ? ['chargemap', 'electrique'] : ['carburant']),
      isElec ? monthlySums(sdk, WELLBORNE_BOARD, WELLBORNE_COL, null, 'formula_mm8jfb2a') : Promise.resolve(null),
    ]);
    const round = (n: number) => Math.round(n * 100) / 100;
    const now = new Date().getMonth();
    const months = MONTHS.slice(0, now + 1).map((label, i) => ({
      label, total: round(main.sums[i] ?? 0), wellborne: round(well?.sums[i] ?? 0),
    }));
    const v = {
      year: new Date().getFullYear(), group: main.groupTitle ?? '', hasWellborne: !!well,
      dateColumn: main.dateColumn, months,
      total: months.reduce((s, m) => s + m.total + m.wellborne, 0),
    };
    CACHE.set(data.source, { t: Date.now(), v });
    return v;
  });
