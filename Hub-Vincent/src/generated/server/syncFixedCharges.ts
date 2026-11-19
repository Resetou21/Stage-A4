import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';

export const FLEET_BOARD_ID = '5092005027';
export const DATA_BOARD_ID = '5092124669';
export const FIXE_GROUP_ID = 'group_mm11r5hn';

export type MissingChargeItem = {
  plate: string;
  name: string;
  num: string;
  model: string;
  monthDate: string; // YYYY-MM-DD
  monthKey: string;  // YYYY-MM
  monthLabel: string;
  monthlyCost: number;
};

export type FixedChargesStatus = {
  activeCount: number;
  totalMissing: number;
  missingByMonth: { key: string; label: string; count: number }[];
  missingItems: MissingChargeItem[];
  isUpToDate: boolean;
};

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function getLastDayOfMonth(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex + 1, 0);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 1. Détection de l'état des charges fixes et des lignes manquantes
export const getFixedChargesStatus = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async (): Promise<FixedChargesStatus> => {
    const sdk = new InformationsMensuellesBoard();

    // A. Récupérer les véhicules actifs du parc (groupe topics = Véhicules en service)
    const parcQuery = `{
      boards(ids: [${FLEET_BOARD_ID}]) {
        groups(ids: ["topics"]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: [
                "text_mm839fsd",
                "numeric_mm0rw3mq",
                "formula_mm0zqm5h",
                "numeric_mm10jjyr",
                "color_mm0p87t0",
                "text_mm0p386j"
              ]) {
                id
                text
                ... on FormulaValue { display_value }
              }
            }
          }
        }
      }
    }`;

    // B. Récupérer les charges fixes déjà enregistrées dans le groupe Fixe
    const fixeQuery = `{
      boards(ids: [${DATA_BOARD_ID}]) {
        groups(ids: ["${FIXE_GROUP_ID}"]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["date4", "text_mm0xqkkm", "numeric_mm0r8ag0"]) {
                id
                text
              }
            }
          }
        }
      }
    }`;

    const [parcRes, fixeRes] = await Promise.all([
      sdk.executeGraphQL(parcQuery) as any,
      sdk.executeGraphQL(fixeQuery) as any,
    ]);

    const activeItems = parcRes?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
    const existingFixeItems = fixeRes?.boards?.[0]?.groups?.[0]?.items_page?.items || [];

    // Index des lignes existantes dans Fixe : "IMMAT_YYYY-MM"
    const existingSet = new Set<string>();
    for (const it of existingFixeItems) {
      const d = it.column_values?.find((c: any) => c.id === 'date4')?.text?.trim();
      const immatCol = it.column_values?.find((c: any) => c.id === 'text_mm0xqkkm')?.text?.trim();
      const rawPlate = immatCol || it.name.match(/[A-Z]{2}-?\d{3}-?[A-Z]{2}/i)?.[0] || it.name;
      const cleanPlate = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (d && cleanPlate) {
        const ym = d.slice(0, 7);
        existingSet.add(`${cleanPlate}_${ym}`);
      }
    }

    // Extraction des véhicules en service avec leur coût mensuel
    type VehInfo = { plate: string; cleanPlate: string; name: string; num: string; model: string; monthlyCost: number };
    const vehicles: VehInfo[] = [];

    for (const it of activeItems) {
      const colPlate = it.column_values?.find((c: any) => c.id === 'text_mm839fsd')?.text?.trim().toUpperCase();
      const namePlate = it.name.match(/[A-Z]{2}-?\d{3}-?[A-Z]{2}/i)?.[0]?.toUpperCase();
      const plate = colPlate || namePlate || '';
      if (!plate) continue;

      const numVal = it.column_values?.find((c: any) => c.id === 'numeric_mm0rw3mq')?.text?.trim()
        || it.name.match(/#(\d+)/)?.[1] || '';
      const marque = it.column_values?.find((c: any) => c.id === 'color_mm0p87t0')?.text?.trim() || '';
      const modele = it.column_values?.find((c: any) => c.id === 'text_mm0p386j')?.text?.trim() || '';
      const fullModel = [marque, modele].filter(Boolean).join(' ');

      // Priorité formule "Calcul du coût mensuel", sinon numeric
      const formVal = it.column_values?.find((c: any) => c.id === 'formula_mm0zqm5h')?.display_value
        || it.column_values?.find((c: any) => c.id === 'formula_mm0zqm5h')?.text;
      const numValCost = it.column_values?.find((c: any) => c.id === 'numeric_mm10jjyr')?.text;
      const rawCost = (formVal || numValCost || '0').replace(',', '.').replace(/[^0-9.]/g, '');
      const monthlyCost = Math.round((parseFloat(rawCost) || 0) * 100) / 100;

      vehicles.push({
        plate,
        cleanPlate: plate.replace(/[^A-Z0-9]/g, ''),
        name: it.name,
        num: numVal ? `#${numVal}` : '',
        model: fullModel,
        monthlyCost,
      });
    }

    // Mois cibles : de Juin 2026 (mois où l'automatisation a calé) à Novembre 2026 (mois courant)
    const targetMonths: { year: number; monthIndex: number; key: string; label: string; lastDay: string }[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 10 for November (0-indexed)

    // On part de 2026-06 (index 5) jusqu'au mois actuel
    const startYear = 2026;
    const startMonth = 5; // Juin

    for (let y = startYear; y <= currentYear; y++) {
      const mStart = (y === startYear) ? startMonth : 0;
      const mEnd = (y === currentYear) ? currentMonth : 11;
      for (let m = mStart; m <= mEnd; m++) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${MONTH_NAMES[m]} ${y}`;
        const lastDay = getLastDayOfMonth(y, m);
        targetMonths.push({ year: y, monthIndex: m, key, label, lastDay });
      }
    }

    const missingItems: MissingChargeItem[] = [];
    const monthCounts = new Map<string, { label: string; count: number }>();

    for (const tm of targetMonths) {
      let missingInMonth = 0;
      for (const v of vehicles) {
        const indexKey = `${v.cleanPlate}_${tm.key}`;
        if (!existingSet.has(indexKey)) {
          missingInMonth++;
          missingItems.push({
            plate: v.plate,
            name: v.name,
            num: v.num,
            model: v.model,
            monthDate: tm.lastDay,
            monthKey: tm.key,
            monthLabel: tm.label,
            monthlyCost: v.monthlyCost,
          });
        }
      }
      monthCounts.set(tm.key, { label: tm.label, count: missingInMonth });
    }

    const missingByMonth = targetMonths
      .map((tm) => ({
        key: tm.key,
        label: tm.label,
        count: monthCounts.get(tm.key)?.count ?? 0,
      }))
      .filter((m) => m.count > 0);

    return {
      activeCount: vehicles.length,
      totalMissing: missingItems.length,
      missingByMonth,
      missingItems,
      isUpToDate: missingItems.length === 0,
    };
  });

// 2. Création d'une ligne de charge fixe (sécurisée et dédoublonnée)
export const createSingleFixedCharge = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      plate: z.string().min(1),
      monthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      monthlyCost: z.number().nonnegative(),
    })
  )
  .handler(async ({ data }) => {
    const sdk = new InformationsMensuellesBoard();
    const columnValues = JSON.stringify({
      date4: { date: data.monthDate },
      single_select0akaarp: { label: 'fixe' },
      text_mm0xqkkm: data.plate,
      numeric_mm0r8ag0: String(data.monthlyCost),
    });

    const mutation = `mutation ($b: ID!, $g: String!, $n: String!, $vals: JSON!) {
      create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $vals) {
        id
      }
    }`;

    const res = (await sdk.executeGraphQL(mutation, {
      b: DATA_BOARD_ID,
      g: FIXE_GROUP_ID,
      n: data.plate,
      vals: columnValues,
    })) as any;

    if (!res?.create_item?.id) {
      throw new Error(`Échec création charge fixe pour ${data.plate} au ${data.monthDate}`);
    }

    return { id: res.create_item.id };
  });
