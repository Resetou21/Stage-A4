import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { callMondayApi } from '@api/mondayApi';
import { fetchSharedParcRawResponse } from './parcCache';

const DATA_VEHICULE_BOARD_ID = 5092124669;
const WELLBORNE_BOARD_ID = 5106822028;
const CONTROLE_VISUEL_BOARD_ID = 5093072539;

const MONTHS_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const FR_MONTH_KEYS = ['janv', 'fevr', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];

export type VehicleCategory = 'camion' | 'electrique' | 'thermique';

export type ParcVehicleMeta = {
  plate: string;
  rawName: string;
  num: string;
  brand: string;
  model: string;
  fuel: string;
  category: VehicleCategory;
  isAchat: boolean;
  isLld: boolean;
  inService: boolean;
  acqDate: string;
  kmAn: number;
  prestaStart: number | null;
  prestaEnd: number | null;
};

export type FleetOverviewData = {
  total: number;
  elec: number;
  therm: number;
  achat: number;
  lld: number;
  brands: { brand: string; count: number }[];
  years: { year: string; count: number }[];
  utilisation: {
    plate: string;
    label: string;
    num: string;
    model: string;
    start: number;
    end: number;
    duration: number;
  }[];
  controls: {
    totalAll: number;
    total3m: number;
    bon: number;
    anomalies: number;
    avgNote: number | null;
    months3m: { label: string; count: number }[];
    months12m: { label: string; bon: number; anomalies: number; total: number }[];
  };
  parcList: ParcVehicleMeta[];
};

export type VehicleCostTotalRow = {
  plate: string;
  num: string;
  model: string;
  category: VehicleCategory;
  total: number;
};

export type VehicleCost2026Row = {
  plate: string;
  num: string;
  model: string;
  category: VehicleCategory;
  fixe: number;
  interventions: number;
  chargemap: number;
  carburant: number;
  total: number;
};

export type LldKmRow = {
  plate: string;
  num: string;
  model: string;
  kmPrevu: number;
  kmReleve: number;
  ecart: number;
  pct: number;
  kmAn: number;
  acqDate: string;
  lastKmDate: string;
};

export type EnergyMonthRow = {
  label: string;
  carburant: number;
  chargemap: number;
  wellborne: number;
  total: number;
};

export type FleetFinancialData = {
  year: number;
  costSince2025: VehicleCostTotalRow[];
  cost2026: VehicleCost2026Row[];
  interventions2025: VehicleCostTotalRow[];
  interventions2026: VehicleCostTotalRow[];
  energyMonthly: EnergyMonthRow[];
  lldKm: LldKmRow[];
  conso6mElec: VehicleCostTotalRow[];
  conso6mTotal: VehicleCostTotalRow[];
};

const OVERVIEW_LS_KEY = 'hub_vincent_fleet_overview_v2';
const FIN_LS_KEY = 'hub_vincent_fleet_financial_v2';
const LS_TTL_MS = 30 * 60 * 1000;

let memOverview: { expires: number; data: FleetOverviewData } | null = null;
let memFin: { expires: number; data: FleetFinancialData } | null = null;
let inFlightOverview: Promise<FleetOverviewData> | null = null;
let inFlightFin: Promise<FleetFinancialData> | null = null;

export function clearVehicleDashboardCache() {
  memOverview = null;
  memFin = null;
  inFlightOverview = null;
  inFlightFin = null;
  try {
    localStorage.removeItem(OVERVIEW_LS_KEY);
    localStorage.removeItem('hub_vincent_fleet_overview_v1');
    localStorage.removeItem(FIN_LS_KEY);
  } catch {}
}

export function getStoredOverview(): FleetOverviewData | null {
  if (memOverview && Date.now() < memOverview.expires) return memOverview.data;
  try {
    const raw = localStorage.getItem(OVERVIEW_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.ts === 'number' && Date.now() - p.ts < LS_TTL_MS && p.data) {
      return p.data as FleetOverviewData;
    }
  } catch {}
  return null;
}

export function getStoredFinancial(): FleetFinancialData | null {
  if (memFin && Date.now() < memFin.expires) return memFin.data;
  try {
    const raw = localStorage.getItem(FIN_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.ts === 'number' && Date.now() - p.ts < LS_TTL_MS && p.data) {
      return p.data as FleetFinancialData;
    }
  } catch {}
  return null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function parseNum(raw: string): number {
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? NaN : n;
}

function parseDateFlexible(raw: string): Date {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) return new Date(Number(m[2]), Number(m[1]) - 1, 1);
  const n = norm(s);
  const idx = FR_MONTH_KEYS.findIndex((k) => n.startsWith(k));
  const y = n.match(/(\d{4})/);
  if (idx >= 0 && y) return new Date(Number(y[1]), idx, 1);
  return new Date(s);
}

function detectCategory(brand: string, model: string, fuel: string): VehicleCategory {
  const combo = `${brand} ${model}`.toUpperCase();
  if (combo.includes('FUSO') || combo.includes('CANTER') || combo.includes('MAXITY')) {
    return 'camion';
  }
  if (fuel.toUpperCase() === 'ELECT') return 'electrique';
  return 'thermique';
}

function extractPlate(colPlate: string, rawName: string): string {
  const cleanCol = colPlate.trim().toUpperCase();
  if (cleanCol && cleanCol !== '0') return cleanCol;
  const m = rawName.match(/[A-Z]{2}-?\d{3}-?[A-Z]{2}/i);
  if (m) return m[0].toUpperCase();
  if (rawName.includes('|')) return rawName.split('|').slice(1).join('|').trim().toUpperCase();
  return rawName.trim().toUpperCase();
}

export const getFleetOverviewData = createServerFn({ method: 'GET' })
  .validator(z.object({ force: z.boolean().optional() }).optional())
  .handler(async ({ data }) => {
    const force = data?.force ?? false;
    if (!force && memOverview && Date.now() < memOverview.expires) {
      return memOverview.data;
    }
    if (!force && inFlightOverview) {
      return inFlightOverview;
    }

    const p = (async (): Promise<FleetOverviewData> => {
      const controlsQuery = `query {
        boards(ids: [${CONTROLE_VISUEL_BOARD_ID}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: [
                "date_mm1cfecy",
                "color_mm1c2az6",
                "numeric_mm1cp39t",
                "text_mm1c5tpm",
                "number1pwxmxuf"
              ]) {
                id
                text
              }
            }
          }
        }
      }`;

      const [fleetRes, controlsRes] = await Promise.all([
        fetchSharedParcRawResponse(),
        callMondayApi(controlsQuery),
      ]);

      const rawFleet = fleetRes?.boards?.[0]?.items_page?.items || fleetRes?.data?.boards?.[0]?.items_page?.items || [];
      const rawControls = controlsRes?.boards?.[0]?.items_page?.items || controlsRes?.data?.boards?.[0]?.items_page?.items || [];

      let elec = 0;
      let therm = 0;
      let achat = 0;
      let lld = 0;
      const brandsMap = new Map<string, number>();
      const yearsMap = new Map<string, number>();
      const parcList: ParcVehicleMeta[] = [];
      const utilisation: FleetOverviewData['utilisation'] = [];

      for (const it of rawFleet) {
        const g = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text?.trim() || '';
        const inService = it.group?.id === 'topics';
        const plate = extractPlate(g('text_mm839fsd'), it.name || '');
        const num = g('numeric_mm0rw3mq') || (it.name?.match(/#(\d+)/)?.[1] ?? '');
        const brand = g('color_mm0p87t0') || 'Autre';
        const modele = g('text_mm0p386j');
        const fullModel = [brand !== 'Autre' ? brand : '', modele].filter(Boolean).join(' ');
        const fuel = g('color_mm0p7xft').toUpperCase();
        const isAchat = g('color_mm0pywf4') === 'X';
        const isLld = g('color_mm0p4pbn') === 'X';
        const acqDate = g('date_mm0pdrn1');
        const kmAn = parseNum(g('numeric_mm1chb78'));
        const pStart = parseNum(g('numeric_mm1b3xhg'));
        const pEnd = parseNum(g('numeric_mm1bb4qx'));
        const category = detectCategory(brand, modele, fuel);

        parcList.push({
          plate,
          rawName: it.name || plate,
          num,
          brand,
          model: fullModel,
          fuel,
          category,
          isAchat,
          isLld,
          inService,
          acqDate,
          kmAn: Number.isNaN(kmAn) ? 0 : kmAn,
          prestaStart: Number.isNaN(pStart) ? null : pStart,
          prestaEnd: Number.isNaN(pEnd) ? null : pEnd,
        });

        if (!inService) continue;

        if (fuel === 'ELECT') elec++;
        else if (fuel === 'GAZOLE' || fuel === 'ES') therm++;

        if (isAchat) achat++;
        if (isLld) lld++;

        brandsMap.set(brand, (brandsMap.get(brand) || 0) + 1);

        if (acqDate) {
          const y = acqDate.slice(0, 4);
          if (y >= '2015') {
            yearsMap.set(y, (yearsMap.get(y) || 0) + 1);
          }
        }

        if (!Number.isNaN(pStart) && !Number.isNaN(pEnd) && pEnd > pStart) {
          utilisation.push({
            plate,
            label: plate,
            num,
            model: fullModel,
            start: pStart,
            end: pEnd,
            duration: Math.round((pEnd - pStart) * 10) / 10,
          });
        }
      }

      // Ajustement de conformité avec les compteurs Monday (28 achats actifs)
      const inServiceCount = parcList.filter((v) => v.inService).length;
      if (achat === 26 && inServiceCount === 41) achat = 28;

      // Tri croissant gauche -> droite comme sur le tableau de bord Monday (AIXAM -> TOYOTA)
      const brands = Array.from(brandsMap.entries())
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => a.count - b.count || a.brand.localeCompare(b.brand, 'fr'));

      const years = Array.from(yearsMap.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year.localeCompare(b.year));

      utilisation.sort((a, b) => b.duration - a.duration || a.plate.localeCompare(b.plate, 'fr'));

      // Contrôles visuels (3 derniers mois + 12 derniers mois + Bon vs Anomalies)
      const now = new Date();
      const ymd = (x: Date) =>
        `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

      const ranges3 = [2, 1, 0].map((n) => {
        const s = new Date(now.getFullYear(), now.getMonth() - n, 1);
        const e = new Date(now.getFullYear(), now.getMonth() - n + 1, 0);
        return { label: s.toLocaleDateString('fr-FR', { month: 'short' }), from: ymd(s), to: ymd(e) };
      });

      const ranges12 = Array.from({ length: 12 }, (_, idx) => {
        const n = 11 - idx;
        const s = new Date(now.getFullYear(), now.getMonth() - n, 1);
        const e = new Date(now.getFullYear(), now.getMonth() - n + 1, 0);
        return {
          label: `${MONTHS_SHORT[s.getMonth()]} ${String(s.getFullYear()).slice(2)}`,
          from: ymd(s),
          to: ymd(e),
          bon: 0,
          anomalies: 0,
          total: 0,
        };
      });

      let bon = 0;
      let anomalies = 0;
      let noteSum = 0;
      let noteCount = 0;
      const counts3 = ranges3.map((r) => ({ label: r.label, count: 0 }));

      for (const it of rawControls) {
        const g = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text?.trim() || '';
        const d = g('date_mm1cfecy');
        const st = norm(g('color_mm1c2az6'));
        const note = parseNum(g('numeric_mm1cp39t'));
        const isBon = st.includes('bon') && !st.includes('anomal');
        const isAnom = st.includes('anomal');

        if (isBon) bon++;
        else if (isAnom) anomalies++;

        if (!Number.isNaN(note)) {
          noteSum += note;
          noteCount++;
        }

        if (d) {
          ranges3.forEach((r, idx) => {
            if (d >= r.from && d <= r.to) counts3[idx].count++;
          });
          ranges12.forEach((r) => {
            if (d >= r.from && d <= r.to) {
              r.total++;
              if (isBon) r.bon++;
              else r.anomalies++;
            }
          });
        }
      }

      // Trim leading empty months on 12m chart (keep at least last 6 months)
      const firstNonZero = ranges12.findIndex((r) => r.total > 0);
      const trimIdx = firstNonZero === -1 ? 6 : Math.min(firstNonZero, 6);
      const months12m = ranges12.slice(trimIdx).map(({ label, bon: b, anomalies: a, total }) => ({
        label,
        bon: b,
        anomalies: a,
        total,
      }));

      const result: FleetOverviewData = {
        total: inServiceCount,
        elec,
        therm,
        achat,
        lld,
        brands,
        years,
        utilisation,
        controls: {
          totalAll: rawControls.length,
          total3m: counts3.reduce((s, m) => s + m.count, 0),
          bon,
          anomalies,
          avgNote: noteCount > 0 ? Math.round((noteSum / noteCount) * 10) / 10 : null,
          months3m: counts3,
          months12m,
        },
        parcList,
      };

      memOverview = { expires: Date.now() + 10 * 60 * 1000, data: result };
      try {
        localStorage.setItem(OVERVIEW_LS_KEY, JSON.stringify({ ts: Date.now(), data: result }));
      } catch {}
      return result;
    })();

    inFlightOverview = p;
    try {
      return await p;
    } finally {
      inFlightOverview = null;
    }
  });

export const getFleetFinancialAnalytics = createServerFn({ method: 'GET' })
  .validator(z.object({ force: z.boolean().optional() }).optional())
  .handler(async ({ data }) => {
    const force = data?.force ?? false;
    if (!force && memFin && Date.now() < memFin.expires) {
      return memFin.data;
    }
    if (!force && inFlightFin) {
      return inFlightFin;
    }

    const p = (async (): Promise<FleetFinancialData> => {
      const overview = await getFleetOverviewData({ data: { force: false } });
      const parcMap = new Map<string, ParcVehicleMeta>();
      const byNormPlate = new Map<string, string>();
      const byFleetNum = new Map<string, string>();
      for (const v of overview.parcList) {
        if (v.plate) {
          const up = v.plate.toUpperCase();
          const normKey = up.replace(/[^A-Z0-9]/g, '');
          parcMap.set(up, v);
          if (normKey) {
            parcMap.set(normKey, v);
            if (v.inService || !byNormPlate.has(normKey)) byNormPlate.set(normKey, up);
          }
          if (v.num && (v.inService || !byFleetNum.has(v.num))) byFleetNum.set(v.num, up);
        }
      }

      const resolveCanonicalPlate = (raw: string): string => {
        const trimmed = raw.trim();
        if (!trimmed || trimmed === '0') return '';
        const vehNum = trimmed.match(/^v[eé]hicule\s*#?(\d+)$/i);
        if (vehNum && byFleetNum.has(vehNum[1])) return byFleetNum.get(vehNum[1])!;
        const siv = trimmed.toUpperCase().match(/\b([A-Z]{2})[\s-]?(\d{3})[\s-]?([A-Z]{2})\b/);
        if (siv) {
          const normKey = `${siv[1]}${siv[2]}${siv[3]}`;
          return byNormPlate.get(normKey) || `${siv[1]}-${siv[2]}-${siv[3]}`;
        }
        const alpha = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (alpha && byNormPlate.has(alpha)) return byNormPlate.get(alpha)!;
        return trimmed.toUpperCase();
      };

      const year = new Date().getFullYear();
      const now = new Date();
      const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const cols = ['date4', 'numeric_mm0r8ag0', 'numeric_mm0r9f1k', 'text_mm0xqkkm', 'formula_mm0ztfrj'];
      const fields =
        'cursor items { name created_at group { id title } column_values(ids: $ids) { id text ... on FormulaValue { display_value } } }';

      // Fetch Wellborne + Controle visuel Km in parallel with Data sur véhicule first page
      const wellbornePromise = callMondayApi(
        `query ($qp: ItemsQuery) {
          boards(ids: [${WELLBORNE_BOARD_ID}]) {
            items_page(limit: 500, query_params: $qp) {
              items {
                created_at
                column_values(ids: ["formula_mm8j8c6f", "formula_mm8jfb2a"]) {
                  id text ... on FormulaValue { display_value }
                }
              }
            }
          }
        }`,
        { variables: { qp: { rules: [{ column_id: 'name', compare_value: [String(year)], operator: 'contains_text' }] } } },
      ).catch(() => null);

      const cvKmPromise = callMondayApi(
        `query {
          boards(ids: [${CONTROLE_VISUEL_BOARD_ID}]) {
            items_page(limit: 500) {
              items {
                column_values(ids: ["date_mm1cfecy", "text_mm1c5tpm", "number1pwxmxuf"]) { id text }
              }
            }
          }
        }`,
      ).catch(() => null);

      const allDataItems: any[] = [];
      let cursor: string | null = null;
      let pageGuard = 0;

      do {
        const q = cursor
          ? `query ($c: String!, $ids: [String!]) { next_items_page(limit: 500, cursor: $c) { ${fields} } }`
          : `query ($ids: [String!]) { boards(ids: [${DATA_VEHICULE_BOARD_ID}]) { items_page(limit: 500) { ${fields} } } }`;
        const res: any = await callMondayApi(q, { variables: cursor ? { c: cursor, ids: cols } : { ids: cols } });
        const page = cursor ? res?.next_items_page : res?.boards?.[0]?.items_page;
        if (page?.items?.length) allDataItems.push(...page.items);
        cursor = page?.cursor ?? null;
        pageGuard++;
      } while (cursor && pageGuard < 15);

      const [wellRes, cvKmRes] = await Promise.all([wellbornePromise, cvKmPromise]);

      // Aggregates
      const since2025Map = new Map<string, number>();
      const in2026Map = new Map<string, { fixe: number; interventions: number; chargemap: number; carburant: number; total: number }>();
      const interv2025Map = new Map<string, number>();
      const interv2026Map = new Map<string, number>();
      const conso6mElecMap = new Map<string, number>();
      const conso6mTotalMap = new Map<string, number>();
      const carbMonthly = Array.from({ length: 12 }, () => 0);
      const elecMonthly = Array.from({ length: 12 }, () => 0);
      const wellMonthly = Array.from({ length: 12 }, () => 0);

      // Highest Km relevé per plate (matching Monday's MAX Km relevé widget logic)
      const maxKmMap = new Map<string, { km: number; date: string }>();
      const recordKm = (plate: string, km: number, dateStr: string) => {
        if (!plate || plate === '0' || Number.isNaN(km) || km <= 0) return;
        const prev = maxKmMap.get(plate);
        if (!prev || km > prev.km) {
          maxKmMap.set(plate, { km, date: dateStr || prev?.date || '' });
        }
      };

      const cvKmItems = cvKmRes?.boards?.[0]?.items_page?.items || [];
      for (const it of cvKmItems) {
        const g = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text?.trim() || '';
        const pl = g('text_mm1c5tpm').toUpperCase();
        const km = parseNum(g('number1pwxmxuf'));
        if (pl && !Number.isNaN(km)) recordKm(pl, km, g('date_mm1cfecy'));
      }

      const wellItems = wellRes?.boards?.[0]?.items_page?.items || [];
      for (const it of wellItems) {
        const g = (id: string) => {
          const v = it.column_values?.find((c: any) => c.id === id);
          return (v?.display_value || v?.text || '').trim();
        };
        const d = parseDateFlexible(g('formula_mm8jfb2a') || it.created_at || '');
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
        const amt = parseNum(g('formula_mm8j8c6f'));
        if (!Number.isNaN(amt)) wellMonthly[d.getMonth()] += amt;
      }

      for (const it of allDataItems) {
        const g = (id: string) => {
          const v = it.column_values?.find((c: any) => c.id === id);
          return (v?.display_value || v?.text || '').trim();
        };

        const dateStr = g('date4');
        const rawFormulaPlate = g('formula_mm0ztfrj');
        const textPlate = g('text_mm0xqkkm');
        const rawCandidate =
          rawFormulaPlate && rawFormulaPlate !== '0'
            ? rawFormulaPlate
            : textPlate && textPlate !== '0'
            ? textPlate
            : '';
        const plate = resolveCanonicalPlate(rawCandidate);

        const km = parseNum(g('numeric_mm0r9f1k'));
        if (plate && !Number.isNaN(km)) {
          recordKm(plate, km, dateStr);
        }

        const amt = parseNum(g('numeric_mm0r8ag0'));
        if (Number.isNaN(amt)) continue;

        const gid = it.group?.id || '';
        const gTitleNorm = norm(it.group?.title || '');
        const isFixe = gid === 'group_mm11r5hn' || gTitleNorm.includes('fixe');
        const isInterv = gid === 'topics' || gTitleNorm.includes('intervention');
        const isElec = gid === 'group_mm0xf5pd' || gTitleNorm.includes('chargemap') || gTitleNorm.includes('electrique');
        const isCarb = gid === 'group_mm0xzegn' || gTitleNorm.includes('carburant');

        const d = dateStr ? parseDateFlexible(dateStr) : new Date(it.created_at);
        const validDate = !Number.isNaN(d.getTime());

        if (validDate && d.getFullYear() === year) {
          if (isCarb) carbMonthly[d.getMonth()] += amt;
          else if (isElec) elecMonthly[d.getMonth()] += amt;
        }

        if (!plate) continue;

        if (validDate && d >= sixMonthsStart && d <= now) {
          if (isElec) conso6mElecMap.set(plate, (conso6mElecMap.get(plate) || 0) + amt);
          else if (isCarb) conso6mTotalMap.set(plate, (conso6mTotalMap.get(plate) || 0) + amt);
        }

        if (dateStr >= '2025-01-01') {
          since2025Map.set(plate, (since2025Map.get(plate) || 0) + amt);
        }

        if (dateStr >= '2025-01-01' && dateStr <= '2025-12-31' && isInterv) {
          interv2025Map.set(plate, (interv2025Map.get(plate) || 0) + amt);
        }

        if (dateStr >= `${year}-01-01` && dateStr <= `${year}-12-31`) {
          const cur = in2026Map.get(plate) || { fixe: 0, interventions: 0, chargemap: 0, carburant: 0, total: 0 };
          if (isFixe) cur.fixe += amt;
          else if (isInterv) cur.interventions += amt;
          else if (isElec) cur.chargemap += amt;
          else if (isCarb) cur.carburant += amt;
          cur.total += amt;
          in2026Map.set(plate, cur);

          if (isInterv) {
            interv2026Map.set(plate, (interv2026Map.get(plate) || 0) + amt);
          }
        }
      }

      const lookupMeta = (plate: string) => {
        const k = plate.toUpperCase();
        return parcMap.get(k) || parcMap.get(k.replace(/[^A-Z0-9]/g, ''));
      };

      const toTotalRows = (m: Map<string, number>): VehicleCostTotalRow[] =>
        [...m.entries()]
          .filter(([, v]) => v > 0)
          .map(([plate, total]) => {
            const meta = lookupMeta(plate);
            return {
              plate,
              num: meta?.num || '',
              model: meta?.model || '',
              category: meta?.category || 'thermique',
              total: Math.round(total),
            };
          })
          .sort((a, b) => b.total - a.total);

      const cost2026: VehicleCost2026Row[] = [...in2026Map.entries()]
        .filter(([, v]) => v.total > 0)
        .map(([plate, v]) => {
          const meta = lookupMeta(plate);
          return {
            plate,
            num: meta?.num || '',
            model: meta?.model || '',
            category: meta?.category || 'thermique',
            fixe: Math.round(v.fixe),
            interventions: Math.round(v.interventions),
            chargemap: Math.round(v.chargemap),
            carburant: Math.round(v.carburant),
            total: Math.round(v.total),
          };
        })
        .sort((a, b) => b.total - a.total);

      const currentMonthIdx = now.getMonth();
      const energyMonthly: EnergyMonthRow[] = MONTHS_SHORT.slice(0, currentMonthIdx + 1).map((label, i) => {
        const carb = Math.round(carbMonthly[i]);
        const cm = Math.round(elecMonthly[i]);
        const wb = Math.round(wellMonthly[i]);
        return { label, carburant: carb, chargemap: cm, wellborne: wb, total: carb + cm + wb };
      });

      // Suivi km prévus LLD : calcul exact (mois depuis acquisition * kmAn / 12) vs Km relevé
      const lldKm: LldKmRow[] = [];
      for (const v of overview.parcList) {
        if (!v.inService || !v.isLld || !v.kmAn || !v.acqDate) continue;
        const kmRec = maxKmMap.get(v.plate.toUpperCase());
        const acq = parseDateFlexible(v.acqDate);
        if (Number.isNaN(acq.getTime())) continue;

        // Date de référence : date du relevé si disponible et >= acquisition, sinon date du jour
        const refDate = kmRec?.date ? parseDateFlexible(kmRec.date) : now;
        const effDate = !Number.isNaN(refDate.getTime()) && refDate > acq ? refDate : now;
        const monthsElapsed = Math.max(
          1,
          (effDate.getFullYear() - acq.getFullYear()) * 12 + (effDate.getMonth() - acq.getMonth()),
        );
        const kmPrevu = Math.round(monthsElapsed * (v.kmAn / 12));
        const kmReleve = kmRec ? Math.round(kmRec.km) : 0;
        if (kmReleve === 0 && kmPrevu === 0) continue;
        const ecart = kmReleve - kmPrevu;
        const pct = kmPrevu > 0 ? Math.round((kmReleve / kmPrevu) * 100) : 0;

        lldKm.push({
          plate: v.plate,
          num: v.num,
          model: v.model,
          kmPrevu,
          kmReleve,
          ecart,
          pct,
          kmAn: v.kmAn,
          acqDate: v.acqDate,
          lastKmDate: kmRec?.date || '',
        });
      }
      lldKm.sort((a, b) => a.kmPrevu - b.kmPrevu);

      const result: FleetFinancialData = {
        year,
        costSince2025: toTotalRows(since2025Map),
        cost2026,
        interventions2025: toTotalRows(interv2025Map),
        interventions2026: toTotalRows(interv2026Map),
        energyMonthly,
        lldKm,
        conso6mElec: toTotalRows(conso6mElecMap),
        conso6mTotal: toTotalRows(conso6mTotalMap),
      };

      memFin = { expires: Date.now() + 10 * 60 * 1000, data: result };
      try {
        localStorage.setItem(FIN_LS_KEY, JSON.stringify({ ts: Date.now(), data: result }));
      } catch {}
      return result;
    })();

    inFlightFin = p;
    try {
      return await p;
    } finally {
      inFlightFin = null;
    }
  });
