import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';
import { fetchSharedParcRawItems } from './parcCache';

const BOARD = '5092124669';
const AMOUNT_COL = 'numeric_mm0r8ag0';
const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

type Col = { id: string; title: string; type: string };
type Group = { id: string; title: string };
type Item = { name: string; created_at: string; column_values: { id: string; text: string | null; display_value?: string | null }[] };
type Page = { cursor: string | null; items: Item[] };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const FIELDS = 'cursor items { name created_at column_values(ids: $ids) { id text ... on FormulaValue { display_value } } }';

export type VehicleSpendingRow = {
  name: string;
  total: number;
  num: string;
  model: string;
  holder: string;
  fuel: string;
  months: number[];
};

export type Top = {
  group: string;
  vehicleColumn: string | null;
  monthLabels: string[];
  vehicles: VehicleSpendingRow[];
  series: Record<string, string | number>[];
};

const TTL = 10 * 60 * 1000;
const CACHE = new Map<string, { t: number; v: Top }>();

export function clearEnergyTopServerCache() {
  CACHE.clear();
}

/**
 * Normalise toute saisie d'immatriculation (ex: "FZ780QF", "FN 342 WY",
 * "HM-718-RA (Proace City Electric)", "VEHICULE 11") vers la plaque officielle AA-123-AA.
 */
function canonicalizeVehicleKey(
  raw: string,
  byNormPlate: Map<string, string>,
  byFleetNum: Map<string, string>,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return '—';

  // 1. Cas "VEHICULE 11" / "Véhicule #11" -> rattachement au numéro de flotte actif
  const vehNumMatch = trimmed.match(/^v[eé]hicule\s*#?(\d+)$/i);
  if (vehNumMatch) {
    const mapped = byFleetNum.get(vehNumMatch[1]);
    if (mapped) return mapped;
  }

  // 2. Extraction d'une plaque française SIV (AA-123-AA / AA 123 AA / AA123AA) même suivie d'un modèle entre parenthèses
  const sivMatch = trimmed.toUpperCase().match(/\b([A-Z]{2})[\s-]?(\d{3})[\s-]?([A-Z]{2})\b/);
  if (sivMatch) {
    const formatted = `${sivMatch[1]}-${sivMatch[2]}-${sivMatch[3]}`;
    const normKey = `${sivMatch[1]}${sivMatch[2]}${sivMatch[3]}`;
    return byNormPlate.get(normKey) || formatted;
  }

  // 3. Correspondance directe alphanumérique avec le référentiel Parc
  const alphaNum = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alphaNum && byNormPlate.has(alphaNum)) {
    return byNormPlate.get(alphaNum)!;
  }

  return trimmed;
}

// Tous les véhicules ayant des dépenses sur les 6 derniers mois + harmonisation stricte des plaques AA-123-AA.
export const getTopVehicles = createServerFn({ method: 'GET' })
  .validator(z.object({ source: z.enum(['chargemap', 'carburant']) }))
  .handler(async ({ data }) => {
    const hit = CACHE.get(data.source);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const sdk = new InformationsMensuellesBoard();

    // 1. Récupération mutualisée du référentiel Parc pour harmoniser les plaques dès l'agrégation
    const parcPromise = fetchSharedParcRawItems().catch(() => [] as any[]);

    const [parcItems, meta] = (await Promise.all([
      parcPromise,
      sdk.executeGraphQL(
        `query ($b: [ID!]) { boards(ids: $b) { columns { id title type } groups { id title } } }`,
        { b: [BOARD] },
      ),
    ])) as [any[], { boards?: { columns: Col[]; groups: Group[] }[] }];

    const parcMap = new Map<string, { num: string; model: string; fuel: string }>();
    const byNormPlate = new Map<string, string>();
    const byFleetNum = new Map<string, string>();

    for (const it of parcItems) {
      const colPlate = it.column_values?.find((c: any) => c.id === 'text_mm839fsd')?.text?.trim().toUpperCase();
      const namePlate = it.name.match(/[A-Z]{2}-?\d{3}-?[A-Z]{2}/i)?.[0]?.toUpperCase();
      const rawPlate = colPlate || namePlate || '';
      const siv = rawPlate.match(/^([A-Z]{2})[\s-]?(\d{3})[\s-]?([A-Z]{2})$/);
      const plate = siv ? `${siv[1]}-${siv[2]}-${siv[3]}` : rawPlate;

      const numVal =
        it.column_values?.find((c: any) => c.id === 'numeric_mm0rw3mq')?.text?.trim() ||
        it.name.match(/#(\d+)/)?.[1] ||
        '';
      const marque = it.column_values?.find((c: any) => c.id === 'color_mm0p87t0')?.text?.trim() || '';
      const modele = it.column_values?.find((c: any) => c.id === 'text_mm0p386j')?.text?.trim() || '';
      const fuel = it.column_values?.find((c: any) => c.id === 'color_mm0p7xft')?.text?.trim().toUpperCase() || '';
      const fullModel = [marque, modele].filter(Boolean).join(' ');
      const entry = { num: numVal || '—', model: fullModel, fuel };
      const inService = it.group?.id === 'topics';

      if (plate) {
        parcMap.set(plate, entry);
        const normPlate = plate.replace(/[^A-Z0-9]/g, '');
        if (normPlate) {
          parcMap.set(normPlate, entry);
          if (inService || !byNormPlate.has(normPlate)) {
            byNormPlate.set(normPlate, plate);
          }
        }
        if (numVal && (inService || !byFleetNum.has(numVal))) {
          byFleetNum.set(numVal, plate);
        }
      }
    }

    const cols = meta.boards?.[0]?.columns ?? [];
    const group = (meta.boards?.[0]?.groups ?? []).find((g) =>
      (data.source === 'chargemap' ? ['chargemap', 'electrique'] : ['carburant']).some((k) => norm(g.title).includes(k)),
    );
    if (!group) throw new Error(`Groupe « ${data.source} » introuvable dans le tableau.`);
    const dateCol = cols.find((c) => c.type === 'date')?.id ?? null;
    const vehCol: string | null = 'formula_mm0ztfrj';
    const textImmatCol: string | null = 'text_mm0xqkkm';
    const modelCol = cols.find((c) => /modele|model/.test(norm(c.title)))?.id ?? null;
    const holderCol = cols.find((c) => /titulaire|conducteur|utilisateur|porteur/.test(norm(c.title)))?.id ?? null;
    const ids = [
      AMOUNT_COL,
      ...(dateCol ? [dateCol] : []),
      ...(vehCol ? [vehCol] : []),
      ...(textImmatCol ? [textImmatCol] : []),
      ...(modelCol ? [modelCol] : []),
      ...(holderCol ? [holderCol] : []),
    ];
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
        const get = (id: string) => {
          const v = it.column_values.find((c) => c.id === id);
          return v?.display_value || v?.text || '';
        };
        const d = new Date((dateCol && get(dateCol)) || it.created_at);
        if (Number.isNaN(d.getTime()) || d < start || d > now) continue;
        const n = parseFloat(get(AMOUNT_COL).replace(/\s/g, '').replace(',', '.'));
        if (Number.isNaN(n)) continue;
        const rawVeh = ((vehCol && get(vehCol)) || (textImmatCol && get(textImmatCol)) || it.name || '—').trim();
        const fallbackVeh = rawVeh === '0' ? (textImmatCol && get(textImmatCol).trim()) || it.name || '—' : rawVeh;
        const veh = canonicalizeVehicleKey(fallbackVeh, byNormPlate, byFleetNum);
        const rec = byVeh.get(veh) ?? {};
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        rec[k] = (rec[k] ?? 0) + n;
        byVeh.set(veh, rec);
        const prev = info.get(veh);
        info.set(veh, {
          model: prev?.model || (modelCol ? get(modelCol) : ''),
          holder: prev?.holder || (holderCol ? get(holderCol) : ''),
        });
      }
    };

    const first = (await sdk.executeGraphQL(
      `query ($b: [ID!], $g: [String], $ids: [String!]${dateCol ? ', $qp: ItemsQuery' : ''}) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 500${dateCol ? ', query_params: $qp' : ''}) { ${FIELDS} } } } }`,
      dateCol
        ? {
            b: [BOARD],
            g: [group.id],
            ids,
            qp: {
              rules: [
                {
                  column_id: dateCol,
                  compare_value: [start.toISOString().slice(0, 10), now.toISOString().slice(0, 10)],
                  operator: 'between',
                },
              ],
            },
          }
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
    const allSorted = [...byVeh.entries()]
      .map(([name, rec]) => ({ name, total: round(Object.values(rec).reduce((s, v) => s + v, 0)), rec }))
      .filter((v) => v.total > 0)
      .sort((a, b) => b.total - a.total);

    const series = keys.map(({ key, label }) => {
      const row: Record<string, string | number> = { label };
      allSorted.forEach((v, i) => {
        row[`v${i}`] = round(v.rec[key] ?? 0);
      });
      return row;
    });

    const result: Top = {
      group: group.title,
      vehicleColumn: cols.find((c) => c.id === vehCol)?.title ?? null,
      monthLabels: keys.map((k) => k.label),
      vehicles: allSorted.map(({ name, total, rec }) => {
        const cleanKey = name.trim().toUpperCase();
        const normKey = cleanKey.replace(/[^A-Z0-9]/g, '');
        const pInfo = parcMap.get(cleanKey) || parcMap.get(normKey);
        return {
          name,
          total,
          num: pInfo?.num || (name.match(/#(\d+)/)?.[1] || '—'),
          model: pInfo?.model || info.get(name)?.model || '',
          holder: info.get(name)?.holder || '',
          fuel: pInfo?.fuel || '',
          months: keys.map(({ key }) => round(rec[key] ?? 0)),
        };
      }),
      series,
    };
    CACHE.set(data.source, { t: Date.now(), v: result });
    return result;
  });
