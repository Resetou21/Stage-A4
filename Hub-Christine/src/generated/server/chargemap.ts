import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DataSurVehiculeBoard, DataWellborneBoard, FactureTotalBoard, FactureChargemapBoard } from '@api/BoardSDK';
import { clearBoardCache } from '@api/mondayApi';

const GROUP_CHARGEMAP = 'group_mm0xf5pd';
const GROUP_CARBURANT = 'group_mm0xzegn';

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Cache mémoire + localStorage (15 min), invalidé systématiquement après chaque import / actualisation
const WITNESS_TTL_MS = 15 * 60 * 1000;
const KEY_CM = 'hub_christine_cm_v1';
const KEY_TOTAL = 'hub_christine_total_v1';
const KEY_WB = 'hub_christine_wb_v1';

let _cachedChargemapMois: any = null;
let _cachedChargemapTime = 0;

let _cachedTotalBimonthly: any = null;
let _cachedTotalTime = 0;

let _cachedWellborneMois: any = null;
let _cachedWellborneTime = 0;

function readStorageCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number' && Date.now() - parsed.ts < WITNESS_TTL_MS && parsed.data) {
      return parsed.data as T;
    }
  } catch {}
  return null;
}

function writeStorageCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export const invalidateFacturesCache = () => {
  _cachedChargemapMois = null;
  _cachedChargemapTime = 0;
  _cachedTotalBimonthly = null;
  _cachedTotalTime = 0;
  _cachedWellborneMois = null;
  _cachedWellborneTime = 0;
  clearBoardCache();
  try {
    localStorage.removeItem(KEY_CM);
    localStorage.removeItem(KEY_TOTAL);
    localStorage.removeItem(KEY_WB);
  } catch {}
};

// Témoin Chargemap : Y a-t-il au moins une facture pour chacun des 6 derniers mois ?
export const getChargemapMois = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    if (_cachedChargemapMois && Date.now() - _cachedChargemapTime < WITNESS_TTL_MS) {
      return _cachedChargemapMois;
    }
    const stored = readStorageCache<any>(KEY_CM);
    if (stored) {
      _cachedChargemapMois = stored;
      _cachedChargemapTime = Date.now();
      return stored;
    }

    const board = new DataSurVehiculeBoard();
    const counts: Record<string, number> = {};

    let cursor: string | null = null;
    let first = true;
    while (first || cursor) {
      const q = first
        ? `query { boards(ids: [5092124669]) { groups(ids: ["${GROUP_CHARGEMAP}"]) { items_page(limit: 500) { cursor items { column_values(ids: ["date4"]) { text } } } } } }`
        : `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { column_values(ids: ["date4"]) { text } } } }`;

      const r: any = await board.executeGraphQL(q, first ? {} : { c: cursor });
      const page = first ? r?.boards?.[0]?.groups?.[0]?.items_page : r?.next_items_page;
      cursor = page?.cursor ?? null;
      first = false;

      for (const item of page?.items ?? []) {
        const d = item.column_values?.[0]?.text;
        if (d) {
          const ym = d.slice(0, 7);
          counts[ym] = (counts[ym] || 0) + 1;
        }
      }
    }

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5 + i, 1)));

    const result = months.map((start) => {
      const ym = iso(start).slice(0, 7);
      return {
        mois: iso(start),
        ym,
        present: (counts[ym] || 0) > 0,
        count: counts[ym] || 0,
      };
    });

    _cachedChargemapMois = { mois: result };
    _cachedChargemapTime = Date.now();
    writeStorageCache(KEY_CM, _cachedChargemapMois);
    return _cachedChargemapMois;
  });

export interface TotalPeriodMonth {
  mois: string; // '2026-06'
  label: string; // 'Juin'
  has15: boolean; // 1-15 du mois présent
  has30: boolean; // 16-30/31 du mois présent
}

// Témoin Factures TOTAL bi-mensuelles (2 factures par mois : au 15 et fin de mois)
export const getTotalBimonthlyStatus = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    if (_cachedTotalBimonthly && Date.now() - _cachedTotalTime < WITNESS_TTL_MS) {
      return _cachedTotalBimonthly;
    }
    const stored = readStorageCache<any>(KEY_TOTAL);
    if (stored) {
      _cachedTotalBimonthly = stored;
      _cachedTotalTime = Date.now();
      return stored;
    }

    const board = new DataSurVehiculeBoard();
    const bimonthlyMap: Record<string, { has15: boolean; has30: boolean; count15: number; count30: number }> = {};

    let cursor: string | null = null;
    let first = true;
    while (first || cursor) {
      const q = first
        ? `query { boards(ids: [5092124669]) { groups(ids: ["${GROUP_CARBURANT}"]) { items_page(limit: 500) { cursor items { column_values(ids: ["date4"]) { text } } } } } }`
        : `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { column_values(ids: ["date4"]) { text } } } }`;

      const r: any = await board.executeGraphQL(q, first ? {} : { c: cursor });
      const page = first ? r?.boards?.[0]?.groups?.[0]?.items_page : r?.next_items_page;
      cursor = page?.cursor ?? null;
      first = false;

      for (const item of page?.items ?? []) {
        const d = item.column_values?.[0]?.text;
        if (d) {
          const ym = d.slice(0, 7);
          const day = Number(d.slice(8, 10)) || 1;
          if (!bimonthlyMap[ym]) {
            bimonthlyMap[ym] = { has15: false, has30: false, count15: 0, count30: 0 };
          }
          if (day <= 15) {
            bimonthlyMap[ym].has15 = true;
            bimonthlyMap[ym].count15++;
          } else {
            bimonthlyMap[ym].has30 = true;
            bimonthlyMap[ym].count30++;
          }
        }
      }
    }

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5 + i, 1)));

    const result: TotalPeriodMonth[] = months.map((start) => {
      const ym = iso(start).slice(0, 7);
      const label = start.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
      const data = bimonthlyMap[ym] || { has15: false, has30: false, count15: 0, count30: 0 };
      return {
        mois: ym,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        has15: data.has15,
        has30: data.has30,
      };
    });

    _cachedTotalBimonthly = { periods: result };
    _cachedTotalTime = Date.now();
    writeStorageCache(KEY_TOTAL, _cachedTotalBimonthly);
    return _cachedTotalBimonthly;
  });

// Témoin Wellborne avec comptage des recharges (cache 15 min, invalidé après import)
export const getWellborneMois = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    if (_cachedWellborneMois && Date.now() - _cachedWellborneTime < WITNESS_TTL_MS) {
      return _cachedWellborneMois;
    }
    const stored = readStorageCache<any>(KEY_WB);
    if (stored) {
      _cachedWellborneMois = stored;
      _cachedWellborneTime = Date.now();
      return stored;
    }
    const board = new DataWellborneBoard();
    const counts: Record<string, number> = {};
    const foundMonths = new Set<string>();

    type Page = {
      cursor: string | null;
      items: { name?: string; column_values: { text: string | null; display_value?: string | null }[] }[];
    };

    let cursor: string | null = null;
    let first = true;

    while (first || cursor) {
      const q = first
        ? `query { boards(ids: [5106822028]) { items_page(limit: 500) { cursor items { name column_values(ids: ["formula_mm8jfb2a"]) { text ... on FormulaValue { display_value } } } } } }`
        : `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { name column_values(ids: ["formula_mm8jfb2a"]) { text ... on FormulaValue { display_value } } } } }`;

      const r: any = await board.executeGraphQL(q, first ? {} : { c: cursor });
      const page: Page | undefined = first ? r?.boards?.[0]?.items_page : r?.next_items_page;
      first = false;

      for (const it of page?.items ?? []) {
        const d = it.column_values?.[0]?.display_value || it.column_values?.[0]?.text || it.name || '';
        const m = d.match(/(\d{4})-(\d{2})/);
        if (m) {
          const ym = `${m[1]}-${m[2]}`;
          foundMonths.add(ym);
          counts[ym] = (counts[ym] || 0) + 1;
        }
      }
      cursor = page?.cursor ?? null;
    }

    const now = new Date();
    const mois = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
      const ym = d.toISOString().slice(0, 7);
      return {
        mois: d.toISOString(),
        ym,
        present: foundMonths.has(ym),
        count: counts[ym] || 0,
      };
    });

    _cachedWellborneMois = { mois, counts };
    _cachedWellborneTime = Date.now();
    writeStorageCache(KEY_WB, _cachedWellborneMois);
    return _cachedWellborneMois;
  });

export interface PeriodTransactionItem {
  id: string;
  name: string;
  date: string;
  vehicule: string;
  produit: string;
  quantite: string;
  montant: string;
  station: string;
}

export const getPeriodTransactions = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      variant: z.enum(['total', 'chargemap']),
      mois: z.string(), // e.g. '2026-11'
      quinzaine: z.enum(['15', '30']).optional(),
    })
  )
  .handler(async ({ data }) => {
    const { variant, quinzaine } = data;
    // Garantir le format YYYY-MM pour matcher tout le mois (et pas seulement le 1er jour)
    const mois = data.mois.slice(0, 7);
    const transactions: PeriodTransactionItem[] = [];

    if (variant === 'total') {
      // 1. Chercher dans Facture TOTAL (5092674084)
      try {
        const boardTotal = new FactureTotalBoard();
        const q = `query {
          boards(ids: [5092674084]) {
            items_page(limit: 500) {
              items {
                id
                name
                d_trans: column_values(ids: ["date_mm149d1c"]) { text }
                d_fac: column_values(ids: ["date_mm148mxx"]) { text }
                c_immat: column_values(ids: ["text_mm145fgq"]) { text }
                c_prod: column_values(ids: ["color_mm14ygn3"]) { text }
                c_qte: column_values(ids: ["numeric_mm14dtxd"]) { text }
                c_ttc: column_values(ids: ["numeric_mm144d2g"]) { text }
                c_ht: column_values(ids: ["numeric_mm14csqf"]) { text }
                c_stat: column_values(ids: ["color_mm14pm65"]) { text }
              }
            }
          }
        }`;
        const res: any = await boardTotal.executeGraphQL(q, {});
        const items = res?.boards?.[0]?.items_page?.items || [];
        for (const it of items) {
          const dateStr = it.d_trans?.[0]?.text || it.d_fac?.[0]?.text || '';
          if (!dateStr.startsWith(mois)) continue;
          const day = Number(dateStr.slice(8, 10)) || 1;
          if (quinzaine === '15' && day > 15) continue;
          if (quinzaine === '30' && day <= 15) continue;

          transactions.push({
            id: it.id,
            name: it.name || 'Facture TOTAL',
            date: dateStr,
            vehicule: it.c_immat?.[0]?.text || '—',
            produit: it.c_prod?.[0]?.text || 'Carburant',
            quantite: it.c_qte?.[0]?.text ? `${it.c_qte[0].text} L` : '—',
            montant: it.c_ttc?.[0]?.text
              ? `${it.c_ttc[0].text} € TTC`
              : it.c_ht?.[0]?.text
                ? `${it.c_ht[0].text} € HT`
                : '—',
            station: it.c_stat?.[0]?.text || 'Station Total',
          });
        }
      } catch (err) {
        console.error('Erreur lecture Total:', err);
      }

      // 2. Chercher aussi dans Data sur véhicule (5092124669) - groupe Carburant avec pagination curseur
      try {
        const boardVeh = new DataSurVehiculeBoard();
        let cursorV: string | null = null;
        let firstV = true;

        while (firstV || cursorV) {
          const qV = firstV
            ? `query {
                boards(ids: [5092124669]) {
                  groups(ids: ["group_mm0xzegn"]) {
                    items_page(limit: 500) {
                      cursor
                      items {
                        id
                        name
                        dateInfo: column_values(ids: ["date_mm0r0s2b", "date4"]) { text }
                        montantHt: column_values(ids: ["numeric_mm0rv0tq", "numeric_mm0r8ag0"]) { text }
                        prestation: column_values(ids: ["color_mm0rqb33", "dropdown_mm0r2vyg"]) { text }
                        fournisseur: column_values(ids: ["color_mm0rk2re", "dropdown_mm0rw6zg"]) { text }
                        immat: column_values(ids: ["text_mm0xqkkm"]) { text }
                        km: column_values(ids: ["numeric_mm0r9f1k"]) { text }
                      }
                    }
                  }
                }
              }`
            : `query ($c: String!) {
                next_items_page(limit: 500, cursor: $c) {
                  cursor
                  items {
                    id
                    name
                    dateInfo: column_values(ids: ["date_mm0r0s2b", "date4"]) { text }
                    montantHt: column_values(ids: ["numeric_mm0rv0tq", "numeric_mm0r8ag0"]) { text }
                    prestation: column_values(ids: ["color_mm0rqb33", "dropdown_mm0r2vyg"]) { text }
                    fournisseur: column_values(ids: ["color_mm0rk2re", "dropdown_mm0rw6zg"]) { text }
                    immat: column_values(ids: ["text_mm0xqkkm"]) { text }
                    km: column_values(ids: ["numeric_mm0r9f1k"]) { text }
                  }
                }
              }`;

          const resV: any = await boardVeh.executeGraphQL(qV, firstV ? {} : { c: cursorV });
          const pageV = firstV ? resV?.boards?.[0]?.groups?.[0]?.items_page : resV?.next_items_page;
          firstV = false;

          for (const it of pageV?.items || []) {
            const dateStr = it.dateInfo?.[0]?.text || '';
            if (!dateStr.startsWith(mois)) continue;
            const day = Number(dateStr.slice(8, 10)) || 1;
            if (quinzaine === '15' && day > 15) continue;
            if (quinzaine === '30' && day <= 15) continue;

            transactions.push({
              id: it.id,
              name: it.name || 'Carburant',
              date: dateStr,
              vehicule: it.immat?.[0]?.text || it.name || '—',
              produit: it.prestation?.[0]?.text || 'Carburant',
              quantite: it.km?.[0]?.text ? `${it.km[0].text} km` : '—',
              montant: it.montantHt?.[0]?.text ? `${it.montantHt[0].text} € HT` : '—',
              station: it.fournisseur?.[0]?.text || 'TOTAL',
            });
          }
          cursorV = pageV?.cursor ?? null;
        }
      } catch (err) {
        console.error('Erreur lecture DataSurVehicule Carburant:', err);
      }
    } else {
      // 1. Chercher dans Data sur véhicule (5092124669) - groupe Chargemap avec pagination curseur
      try {
        const boardVeh = new DataSurVehiculeBoard();
        let cursorV: string | null = null;
        let firstV = true;

        while (firstV || cursorV) {
          const qV = firstV
            ? `query {
                boards(ids: [5092124669]) {
                  groups(ids: ["group_mm0xf5pd"]) {
                    items_page(limit: 500) {
                      cursor
                      items {
                        id
                        name
                        dateInfo: column_values(ids: ["date4"]) { text }
                        montantHt: column_values(ids: ["numeric_mm0r8ag0"]) { text }
                        carte: column_values(ids: ["text_mm0xccqy"]) { text }
                        immat: column_values(ids: ["text_mm0xqkkm"]) { text }
                        fournisseur: column_values(ids: ["dropdown_mm0rw6zg"]) { text }
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
                    id
                    name
                    dateInfo: column_values(ids: ["date4"]) { text }
                    montantHt: column_values(ids: ["numeric_mm0r8ag0"]) { text }
                    carte: column_values(ids: ["text_mm0xccqy"]) { text }
                    immat: column_values(ids: ["text_mm0xqkkm"]) { text }
                    fournisseur: column_values(ids: ["dropdown_mm0rw6zg"]) { text }
                    kwh: column_values(ids: ["numeric_mm2749jt"]) { text }
                  }
                }
              }`;

          const resV: any = await boardVeh.executeGraphQL(qV, firstV ? {} : { c: cursorV });
          const pageV = firstV ? resV?.boards?.[0]?.groups?.[0]?.items_page : resV?.next_items_page;
          firstV = false;

          for (const it of pageV?.items || []) {
            const dateStr = it.dateInfo?.[0]?.text || '';
            if (!dateStr.startsWith(mois)) continue;

            transactions.push({
              id: it.id,
              name: it.name || 'Recharge Chargemap',
              date: dateStr,
              vehicule: it.immat?.[0]?.text || '—',
              produit: it.carte?.[0]?.text ? `Carte ${it.carte[0].text}` : 'Recharge Électrique',
              quantite: it.kwh?.[0]?.text ? `${it.kwh[0].text} kWh` : '—',
              montant: it.montantHt?.[0]?.text ? `${it.montantHt[0].text} € HT` : '—',
              station: it.fournisseur?.[0]?.text || 'Chargemap',
            });
          }
          cursorV = pageV?.cursor ?? null;
        }
      } catch (err) {
        console.error('Erreur lecture DataSurVehicule Chargemap:', err);
      }

      // 2. Chercher aussi dans Facture Chargemap (5092349771)
      try {
        const boardCM = new FactureChargemapBoard();
        const q = `query {
          boards(ids: [5092349771]) {
            items_page(limit: 500) {
              items {
                id
                name
                d_trans: column_values(ids: ["date_mm0x7t7d"]) { text }
                c_immat: column_values(ids: ["color_mm0xyjbt"]) { text }
                c_badge: column_values(ids: ["color_mm0xn4gn"]) { text }
                c_kwh: column_values(ids: ["numeric_mm0xk1ka"]) { text }
                c_ttc: column_values(ids: ["numeric_mm0xgbyh"]) { text }
                c_loc: column_values(ids: ["color_mm0x8e1p"]) { text }
              }
            }
          }
        }`;
        const res: any = await boardCM.executeGraphQL(q, {});
        const items = res?.boards?.[0]?.items_page?.items || [];
        for (const it of items) {
          const dateStr = it.d_trans?.[0]?.text || '';
          if (!dateStr.startsWith(mois)) continue;

          transactions.push({
            id: it.id,
            name: it.name || 'Recharge Chargemap',
            date: dateStr,
            vehicule: it.c_immat?.[0]?.text || '—',
            produit: it.c_badge?.[0]?.text ? `Badge ${it.c_badge[0].text}` : 'Recharge Électrique',
            quantite: it.c_kwh?.[0]?.text ? `${it.c_kwh[0].text} kWh` : '—',
            montant: it.c_ttc?.[0]?.text ? `${it.c_ttc[0].text} € TTC` : '—',
            station: it.c_loc?.[0]?.text || 'Borne Chargemap',
          });
        }
      } catch (err) {
        console.error('Erreur lecture Chargemap:', err);
      }
    }

    let totalMontant = 0;
    for (const t of transactions) {
      const m = parseFloat(t.montant.replace(',', '.').replace(/[^\d.]/g, ''));
      if (!isNaN(m)) totalMontant += m;
    }

    return {
      transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
      totalCount: transactions.length,
      totalMontant: Math.round(totalMontant * 100) / 100,
    };
  });
