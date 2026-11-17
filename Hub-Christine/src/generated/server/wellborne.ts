import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DataWellborneBoard } from '@api/BoardSDK';

const BOARD = 5106822028;
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();

// Noms de tous les éléments déjà présents sur Monday (sans limite de 500 grâce à next_items_page)
export const getWellborneNames = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const sdk = new DataWellborneBoard();
    const names: string[] = [];
    type Page = { cursor: string | null; items: { name: string }[] };
    let cursor: string | null = null;
    let first = true;

    while (first || cursor) {
      const r = (first
        ? await sdk.executeGraphQL(`query { boards(ids: [${BOARD}]) { items_page(limit: 500) { cursor items { name } } } }`, {})
        : await sdk.executeGraphQL(`query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { name } } }`, { c: cursor })) as
        { boards?: { items_page?: Page }[]; next_items_page?: Page };

      const page: Page | undefined = first ? r.boards?.[0]?.items_page : r.next_items_page;
      first = false;

      for (const it of page?.items ?? []) {
        if (it?.name) names.push(it.name.trim());
      }
      cursor = page?.cursor ?? null;
    }
    return { names };
  });

// Comptage précis des recharges par mois pour s'assurer que tout est bien téléchargé
export const getWellborneMonthlyStats = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const sdk = new DataWellborneBoard();
    const counts: Record<string, number> = {};
    let total = 0;
    let cursor: string | null = null;
    let first = true;

    type Page = {
      cursor: string | null;
      items: { name: string; column_values: { text: string | null; display_value?: string | null }[] }[];
    };

    while (first || cursor) {
      const r = (first
        ? await sdk.executeGraphQL(
            `query { boards(ids: [${BOARD}]) { items_page(limit: 500) { cursor items { name column_values(ids: ["formula_mm8jfb2a"]) { text ... on FormulaValue { display_value } } } } } }`,
            {}
          )
        : await sdk.executeGraphQL(
            `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { name column_values(ids: ["formula_mm8jfb2a"]) { text ... on FormulaValue { display_value } } } } }`,
            { c: cursor }
          )) as { boards?: { items_page?: Page }[]; next_items_page?: Page };

      const page: Page | undefined = first ? r.boards?.[0]?.items_page : r.next_items_page;
      first = false;

      for (const it of page?.items ?? []) {
        total++;
        const rawDate = it.column_values?.[0]?.display_value || it.column_values?.[0]?.text || it.name.slice(0, 10);
        const match = rawDate.match(/(\d{4})-(\d{2})/);
        if (match) {
          const ym = `${match[1]}-${match[2]}`;
          counts[ym] = (counts[ym] || 0) + 1;
        }
      }
      cursor = page?.cursor ?? null;
    }

    return { counts, total };
  });

export interface WellborneChargeItem {
  id: string;
  startTime: string;
  endTime: string;
  duration: string;
  energyKwh: string;
}

// Extraction de toutes les charges d'un mois spécifique pour export Excel / CSV
export const getWellborneMonthCharges = createServerFn({ method: 'GET' })
  .validator(z.object({ ym: z.string() }))
  .handler(async ({ data }) => {
    const sdk = new DataWellborneBoard();
    const items: WellborneChargeItem[] = [];
    let cursor: string | null = null;
    let first = true;

    type Page = {
      cursor: string | null;
      items: { id: string; name: string; column_values: { id: string; text: string | null }[] }[];
    };

    while (first || cursor) {
      const q = first
        ? `query { boards(ids: [${BOARD}]) { items_page(limit: 500) { cursor items { id name column_values(ids: ["text_mm8j5jn3", "text_mm8j609x", "text_mm8j8x0k"]) { id text } } } } }`
        : `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { id name column_values(ids: ["text_mm8j5jn3", "text_mm8j609x", "text_mm8j8x0k"]) { id text } } } }`;

      const r: any = await sdk.executeGraphQL(q, first ? {} : { c: cursor });
      const page: Page | undefined = first ? r?.boards?.[0]?.items_page : r?.next_items_page;
      first = false;

      for (const it of page?.items ?? []) {
        if (!it.name.startsWith(data.ym)) continue;
        const byId = new Map(it.column_values.map((c) => [c.id, c.text ?? '']));
        items.push({
          id: it.id,
          startTime: it.name,
          endTime: byId.get('text_mm8j5jn3') || '',
          duration: byId.get('text_mm8j609x') || '',
          energyKwh: byId.get('text_mm8j8x0k') || '0',
        });
      }
      cursor = page?.cursor ?? null;
    }

    return { charges: items };
  });

// Cache de métadonnées du tableau Wellborne (5 min) pour accélérer les imports par lots
let _cachedWellborneMeta: any = null;
let _cachedWellborneMetaTime = 0;

// Import d'un lot Wellborne avec filtre strict (tout avant le 15-05 est exclu) et vérification doublons
export const importWellborne = createServerFn({ method: 'POST' })
  .validator(z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())).max(50),
  }))
  .handler(async ({ data }) => {
    const sdk = new DataWellborneBoard();
    let meta = _cachedWellborneMeta;
    if (!meta || Date.now() - _cachedWellborneMetaTime > 300_000) {
      meta = (await sdk.executeGraphQL(
        `query { boards(ids: [${BOARD}]) { columns { id title type } groups { id title } } }`, {}
      )) as { boards?: { columns?: { id: string; title: string; type: string }[]; groups?: { id: string; title: string }[] }[] };
      _cachedWellborneMeta = meta;
      _cachedWellborneMetaTime = Date.now();
    }

    const b = meta.boards?.[0];
    const group = b?.groups?.find((g) => g.title.trim().toLowerCase().includes('charge') || g.title.trim().toLowerCase().includes('wellborne')) ?? b?.groups?.[0];
    if (!group) throw new Error('Aucun groupe dans le tableau Wellborne');

    const cols = (b?.columns ?? []).filter((c) => c.type === 'text' || c.type === 'numbers' || c.type === 'long_text');
    const nameIdx = data.headers.findIndex((h) => norm(h) === 'starttime');
    if (nameIdx < 0) throw new Error('Colonne « StartTime » absente du fichier');

    const mapping = data.headers.map((h, i) => (i === nameIdx ? null : cols.find((c) => norm(c.title) === norm(h)) ?? null));

    const vars: Record<string, string> = {};
    const defs: string[] = [];
    const muts: string[] = [];

    data.rows.forEach((row, k) => {
      const name = (row[nameIdx] ?? '').trim();
      if (!name) return;

      const values: Record<string, string> = {};
      mapping.forEach((c, i) => {
        const v = (row[i] ?? '').trim();
        if (!c || !v) return;
        if (c.type === 'numbers') {
          const n = Number(v.replace(',', '.'));
          if (Number.isFinite(n)) values[c.id] = String(n);
        } else {
          values[c.id] = v;
        }
      });

      vars[`n${k}`] = name;
      vars[`v${k}`] = JSON.stringify(values);
      defs.push(`$n${k}: String!, $v${k}: JSON!`);
      muts.push(`i${k}: create_item(board_id: ${BOARD}, group_id: "${group.id}", item_name: $n${k}, column_values: $v${k}) { id }`);
    });

    if (muts.length) {
      await sdk.executeGraphQL(`mutation (${defs.join(', ')}) { ${muts.join(' ')} }`, vars);
    }

    return { created: muts.length };
  });
