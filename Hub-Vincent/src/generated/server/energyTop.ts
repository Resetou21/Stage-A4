import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';

const BOARD = '5092124669';
const AMOUNT_COL = 'numeric_mm0r8ag0';
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

type Col = { id: string; title: string; type: string };
type Group = { id: string; title: string };
type Item = { name: string; created_at: string; column_values: { id: string; text: string | null; display_value?: string | null }[] };
type Page = { cursor: string | null; items: Item[] };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const FIELDS = 'cursor items { name created_at column_values(ids: $ids) { id text ... on FormulaValue { display_value } } }';

type Top = { group: string; vehicleColumn: string | null; vehicles: { name: string; total: number; model: string; holder: string }[]; series: Record<string, string | number>[] };
const TTL = 10 * 60 * 1000;
const CACHE = new Map<string, { t: number; v: Top }>();

// Top 5 des véhicules au coût le plus élevé sur les 6 derniers mois + évolution mensuelle.
export const getTopVehicles = createServerFn({ method: 'GET' })
  .validator(z.object({ source: z.enum(['chargemap', 'carburant']) }))
  .handler(async ({ data }) => {
    const hit = CACHE.get(data.source);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const sdk = new InformationsMensuellesBoard();
    const meta = (await sdk.executeGraphQL(
      `query ($b: [ID!]) { boards(ids: $b) { columns { id title type } groups { id title } } }`, { b: [BOARD] },
    )) as { boards?: { columns: Col[]; groups: Group[] }[] };
    const cols = meta.boards?.[0]?.columns ?? [];
    const group = (meta.boards?.[0]?.groups ?? []).find((g) => (data.source === 'chargemap' ? ['chargemap', 'electrique'] : ['carburant']).some((k) => norm(g.title).includes(k)));
    if (!group) throw new Error(`Groupe « ${data.source} » introuvable dans le tableau.`);
    const dateCol = cols.find((c) => c.type === 'date')?.id ?? null;
    const vehCol: string | null = 'formula_mm0ztfrj';
    const modelCol = cols.find((c) => /modele|model/.test(norm(c.title)))?.id ?? null;
    const holderCol = cols.find((c) => /titulaire|conducteur|utilisateur|porteur/.test(norm(c.title)))?.id ?? null;
    const ids = [AMOUNT_COL, ...(dateCol ? [dateCol] : []), ...(vehCol ? [vehCol] : []), ...(modelCol ? [modelCol] : []), ...(holderCol ? [holderCol] : [])];
    const info = new Map<string, { model: string; holder: string }>();

    const now = new Date();
    const keys = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()] };
    });
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const byVeh = new Map<string, Record<string, number>>();

    const add = (items: Item[]) => {
      for (const it of items) {
        const get = (id: string) => { const v = it.column_values.find((c) => c.id === id); return v?.display_value || v?.text || ''; };
        const d = new Date((dateCol && get(dateCol)) || it.created_at);
        if (Number.isNaN(d.getTime()) || d < start || d > now) continue;
        const n = parseFloat(get(AMOUNT_COL).replace(',', '.'));
        if (Number.isNaN(n)) continue;
        const veh = ((vehCol && get(vehCol)) || it.name || '—').trim();
        const rec = byVeh.get(veh) ?? {};
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        rec[k] = (rec[k] ?? 0) + n;
        byVeh.set(veh, rec);
        const prev = info.get(veh);
        info.set(veh, { model: prev?.model || (modelCol ? get(modelCol) : ''), holder: prev?.holder || (holderCol ? get(holderCol) : '') });
      }
    };

    const first = (await sdk.executeGraphQL(
      `query ($b: [ID!], $g: [String], $ids: [String!]${dateCol ? ', $qp: ItemsQuery' : ''}) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 500${dateCol ? ', query_params: $qp' : ''}) { ${FIELDS} } } } }`,
      dateCol
        ? { b: [BOARD], g: [group.id], ids, qp: { rules: [{ column_id: dateCol, compare_value: [start.toISOString().slice(0, 10), now.toISOString().slice(0, 10)], operator: 'between' }] } }
        : { b: [BOARD], g: [group.id], ids },
    )) as { boards?: { groups: { items_page: Page }[] }[] };
    let page = first.boards?.[0]?.groups?.[0]?.items_page;
    add(page?.items ?? []);
    let cursor = page?.cursor ?? null;
    while (cursor) {
      const next = (await sdk.executeGraphQL(
        `query ($c: String!, $ids: [String!]) { next_items_page(limit: 500, cursor: $c) { ${FIELDS} } }`,
        { c: cursor, ids },
      )) as { next_items_page?: Page };
      page = next.next_items_page;
      add(page?.items ?? []);
      cursor = page?.cursor ?? null;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const top = [...byVeh.entries()]
      .map(([name, rec]) => ({ name, total: round(Object.values(rec).reduce((s, v) => s + v, 0)), rec }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const series = keys.map(({ key, label }) => {
      const row: Record<string, string | number> = { label };
      top.forEach((v, i) => { row[`v${i}`] = round(v.rec[key] ?? 0); });
      return row;
    });
    const result = {
      group: group.title,
      vehicleColumn: cols.find((c) => c.id === vehCol)?.title ?? null,
      vehicles: top.map(({ name, total }) => ({ name, total, model: info.get(name)?.model || '', holder: info.get(name)?.holder || '' })),
      series,
    };
    CACHE.set(data.source, { t: Date.now(), v: result });
    return result;
  });
