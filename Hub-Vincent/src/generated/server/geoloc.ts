import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { callMondayApi, clearBoardCache } from '@api/mondayApi';
import { normalizePlate, normalizePlateKey, type GeoAlertStatus } from '@lib/geolocParser';
import { fetchSharedParcRawResponse } from './parcCache';

export const GEOLOC_BOARD_ID = '5108497111';
export const GEOLOC_BOARD_URL = `https://groupefacility.monday.com/boards/${GEOLOC_BOARD_ID}`;
export const PARC_VEHICULES_BOARD_ID = '5092005027';

export const GEOLOC_COLS = {
  vehiculeRel: 'board_relation_mm9dnt7z',
  immat: 'text_mm9d6acj',
  conducteur: 'text_mm9d3mgk',
  flotte: 'color_mm9d6ypk',
  semaine: 'text_mm9dv1j5',
  debut: 'date_mm9dr4vg',
  fin: 'date_mm9dyc6w',
  alerte: 'color_mm9d8gsk',
  nbTrajets: 'numeric_mm9dj6ag',
  kmTotal: 'numeric_mm9d7deb',
  kmPro: 'numeric_mm9dr94d',
  kmHors: 'numeric_mm9dwgbv',
  conduiteH: 'numeric_mm9dk1qv',
  attenteH: 'numeric_mm9d2x6w',
  vitesseMoy: 'numeric_mm9dcyrq',
  joursRoules: 'numeric_mm9dfdnp',
  premierDepart: 'text_mm9d54mj',
  derniereArrivee: 'text_mm9d985b',
  amplitudeH: 'numeric_mm9dz0jm',
  syntheseJour: 'long_text_mm9d3jkp',
} as const;

export interface MondayGeolocRecord {
  id: string;
  name: string;
  groupId: string;
  groupTitle: string;
  plate: string;
  conducteur: string;
  flotte: string;
  semaine: string;
  debut: string;
  fin: string;
  alerte: GeoAlertStatus;
  nbTrajets: number;
  kmTotal: number;
  kmPro: number;
  kmHors: number;
  conduiteH: number;
  attenteH: number;
  vitesseMoy: number;
  joursRoules: number;
  premierDepart: string;
  derniereArrivee: string;
  amplitudeH: number;
  syntheseJour: string;
  linkedVehicleId: string | null;
}

export interface MondayGeolocWeekMeta {
  weekId: string;
  groupId: string;
  groupTitle: string;
  debut: string;
  fin: string;
  vehicleCount: number;
  activeCount: number;
  totalKm: number;
  totalKmPro: number;
  totalKmHors: number;
  totalTrips: number;
  alertCount: number;
}

export interface MondayGeolocHistory {
  records: MondayGeolocRecord[];
  weeks: MondayGeolocWeekMeta[];
  existingByWeekPlate: Record<string, string>; // "2026-S45::HB599PW" -> itemId
  groupsByTitle: Record<string, string>; // normalized title or weekId -> groupId
  fleetPlateToId: Record<string, string>; // "HB599PW" -> itemId in 5092005027
}

function parseNum(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseLongText(cv: { text?: string; value?: string } | undefined): string {
  if (!cv) return '';
  if (cv.text && cv.text.trim()) return cv.text.trim();
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && typeof parsed.text === 'string') return parsed.text.trim();
    } catch {
      // ignore
    }
  }
  return '';
}

export const getGeolocHistory = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async (): Promise<MondayGeolocHistory> => {
    const colIds = Object.values(GEOLOC_COLS);

    const geolocQuery = `query {
      boards(ids: [${GEOLOC_BOARD_ID}]) {
        groups { id title }
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) {
              id
              text
              value
              ... on BoardRelationValue { linked_item_ids }
            }
          }
        }
      }
    }`;

    const [geoRes, fleetRes] = await Promise.all([
      callMondayApi(geolocQuery),
      fetchSharedParcRawResponse(),
    ]);

    const board = geoRes?.boards?.[0] ?? geoRes?.data?.boards?.[0];
    const groups: Array<{ id: string; title: string }> = board?.groups ?? [];
    let allItems: any[] = board?.items_page?.items ?? [];
    let cursor: string | null = board?.items_page?.cursor ?? null;

    while (cursor && allItems.length < 3000) {
      const nextQ = `query ($c: String!) {
        next_items_page(limit: 500, cursor: $c) {
          cursor
          items {
            id
            name
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) {
              id
              text
              value
              ... on BoardRelationValue { linked_item_ids }
            }
          }
        }
      }`;
      const nextRes = await callMondayApi(nextQ, { variables: { c: cursor } });
      const page = nextRes?.next_items_page ?? nextRes?.data?.next_items_page;
      allItems = allItems.concat(page?.items ?? []);
      cursor = page?.cursor ?? null;
    }

    const fleetPlateToId: Record<string, string> = {};
    const fleetItems: any[] =
      fleetRes?.boards?.[0]?.items_page?.items ??
      fleetRes?.data?.boards?.[0]?.items_page?.items ??
      [];
    for (const f of fleetItems) {
      const colPlate = f.column_values?.find((c: any) => c.id === 'text_mm839fsd')?.text?.trim();
      const raw = colPlate || f.name || '';
      const key = normalizePlateKey(raw);
      if (key && key.length >= 6) {
        fleetPlateToId[key] = String(f.id);
      }
    }

    const groupsByTitle: Record<string, string> = {};
    for (const g of groups) {
      groupsByTitle[g.title.trim().toLowerCase()] = g.id;
      const wkMatch = g.title.match(/semaine\s*(\d{1,2})/i);
      if (wkMatch) {
        groupsByTitle[`s${wkMatch[1].padStart(2, '0')}`] = g.id;
      }
    }

    const existingByWeekPlate: Record<string, string> = {};
    const records: MondayGeolocRecord[] = [];
    const weekMap = new Map<string, MondayGeolocWeekMeta>();

    for (const it of allItems) {
      const cvMap = new Map<string, any>();
      for (const cv of it.column_values ?? []) {
        cvMap.set(cv.id, cv);
      }
      const txt = (id: string) => String(cvMap.get(id)?.text ?? '').trim();

      const plate = normalizePlate(txt(GEOLOC_COLS.immat) || it.name);
      const semaine = txt(GEOLOC_COLS.semaine) || it.group?.title || 'Inconnue';
      const debut = txt(GEOLOC_COLS.debut);
      const fin = txt(GEOLOC_COLS.fin);
      const alerteRaw = txt(GEOLOC_COLS.alerte);
      const alerte = (
        ['Conforme', 'Hors horaires', 'Week-end', 'Vie privée', 'Hors horaires + WE', 'Inactif'].includes(alerteRaw)
          ? alerteRaw
          : 'Conforme'
      ) as GeoAlertStatus;

      const relCv = cvMap.get(GEOLOC_COLS.vehiculeRel);
      const linkedVehicleId =
        Array.isArray(relCv?.linked_item_ids) && relCv.linked_item_ids[0]
          ? String(relCv.linked_item_ids[0])
          : null;

      const rec: MondayGeolocRecord = {
        id: String(it.id),
        name: String(it.name || ''),
        groupId: String(it.group?.id || ''),
        groupTitle: String(it.group?.title || ''),
        plate,
        conducteur: txt(GEOLOC_COLS.conducteur),
        flotte: txt(GEOLOC_COLS.flotte) || 'Autre',
        semaine,
        debut,
        fin,
        alerte,
        nbTrajets: Math.round(parseNum(txt(GEOLOC_COLS.nbTrajets))),
        kmTotal: parseNum(txt(GEOLOC_COLS.kmTotal)),
        kmPro: parseNum(txt(GEOLOC_COLS.kmPro)),
        kmHors: parseNum(txt(GEOLOC_COLS.kmHors)),
        conduiteH: parseNum(txt(GEOLOC_COLS.conduiteH)),
        attenteH: parseNum(txt(GEOLOC_COLS.attenteH)),
        vitesseMoy: parseNum(txt(GEOLOC_COLS.vitesseMoy)),
        joursRoules: Math.round(parseNum(txt(GEOLOC_COLS.joursRoules))),
        premierDepart: txt(GEOLOC_COLS.premierDepart) || '—',
        derniereArrivee: txt(GEOLOC_COLS.derniereArrivee) || '—',
        amplitudeH: parseNum(txt(GEOLOC_COLS.amplitudeH)),
        syntheseJour: parseLongText(cvMap.get(GEOLOC_COLS.syntheseJour)),
        linkedVehicleId,
      };

      records.push(rec);

      const dedupKey = `${semaine}::${normalizePlateKey(plate)}`;
      existingByWeekPlate[dedupKey] = rec.id;
      if (rec.groupId) {
        groupsByTitle[semaine.toLowerCase()] = rec.groupId;
      }

      const cur = weekMap.get(semaine) || {
        weekId: semaine,
        groupId: rec.groupId,
        groupTitle: rec.groupTitle || semaine,
        debut,
        fin,
        vehicleCount: 0,
        activeCount: 0,
        totalKm: 0,
        totalKmPro: 0,
        totalKmHors: 0,
        totalTrips: 0,
        alertCount: 0,
      };
      cur.vehicleCount += 1;
      if (rec.nbTrajets > 0 || rec.kmTotal > 0) cur.activeCount += 1;
      cur.totalKm = Math.round((cur.totalKm + rec.kmTotal) * 100) / 100;
      cur.totalKmPro = Math.round((cur.totalKmPro + rec.kmPro) * 100) / 100;
      cur.totalKmHors = Math.round((cur.totalKmHors + rec.kmHors) * 100) / 100;
      cur.totalTrips += rec.nbTrajets;
      if (rec.alerte !== 'Conforme' && rec.alerte !== 'Inactif') cur.alertCount += 1;
      if (!cur.debut && debut) cur.debut = debut;
      if (!cur.fin && fin) cur.fin = fin;
      weekMap.set(semaine, cur);
    }

    const weeks = Array.from(weekMap.values()).sort((a, b) => b.weekId.localeCompare(a.weekId));

    return {
      records: records.sort((a, b) => b.kmTotal - a.kmTotal),
      weeks,
      existingByWeekPlate,
      groupsByTitle,
      fleetPlateToId,
    };
  });

export const ensureGeolocWeekGroup = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      weekId: z.string().min(1),
      weekLabel: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<{ groupId: string; created: boolean }> => {
    const q = `query {
      boards(ids: [${GEOLOC_BOARD_ID}]) {
        groups { id title }
      }
    }`;
    const res = await callMondayApi(q);
    const groups: Array<{ id: string; title: string }> =
      res?.boards?.[0]?.groups ?? res?.data?.boards?.[0]?.groups ?? [];

    const targetLower = data.weekLabel.trim().toLowerCase();
    const weekNumMatch = data.weekId.match(/S(\d{2})$/i);
    const weekNumNeedle = weekNumMatch ? `semaine ${weekNumMatch[1]}` : '';

    const found = groups.find((g) => {
      const t = g.title.trim().toLowerCase();
      return (
        t === targetLower ||
        t.includes(data.weekId.toLowerCase()) ||
        (weekNumNeedle && t.includes(weekNumNeedle) && t.includes(data.weekId.slice(0, 4)))
      );
    });

    if (found) {
      return { groupId: found.id, created: false };
    }

    const createMutation = `mutation ($boardId: ID!, $groupName: String!) {
      create_group(board_id: $boardId, group_name: $groupName, position_relative_method: before_at) {
        id
        title
      }
    }`;
    const createdRes = await callMondayApi(createMutation, {
      variables: {
        boardId: GEOLOC_BOARD_ID,
        groupName: data.weekLabel,
      },
    });
    const newId = createdRes?.create_group?.id ?? createdRes?.data?.create_group?.id;
    if (!newId) {
      // Fallback sans position_relative_method si Monday le rejette sans relative_to
      const fallbackMutation = `mutation ($boardId: ID!, $groupName: String!) {
        create_group(board_id: $boardId, group_name: $groupName) {
          id
          title
        }
      }`;
      const fbRes = await callMondayApi(fallbackMutation, {
        variables: {
          boardId: GEOLOC_BOARD_ID,
          groupName: data.weekLabel,
        },
      });
      const fbId = fbRes?.create_group?.id ?? fbRes?.data?.create_group?.id;
      if (!fbId) throw new Error(`Impossible de créer le groupe ${data.weekLabel} sur Monday.`);
      clearBoardCache(GEOLOC_BOARD_ID);
      return { groupId: String(fbId), created: true };
    }

    clearBoardCache(GEOLOC_BOARD_ID);
    return { groupId: String(newId), created: true };
  });

const upsertVehicleSchema = z.object({
  groupId: z.string().min(1),
  existingItemId: z.string().optional(),
  weekId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plate: z.string().min(1),
  linkedVehicleId: z.string().optional(),
  conducteur: z.string(),
  flotte: z.string(),
  alerte: z.string(),
  nbTrajets: z.number(),
  kmTotal: z.number(),
  kmPro: z.number(),
  kmHors: z.number(),
  conduiteH: z.number(),
  attenteH: z.number(),
  vitesseMoy: z.number(),
  joursRoules: z.number(),
  premierDepart: z.string(),
  derniereArrivee: z.string(),
  amplitudeH: z.number(),
  syntheseJour: z.string(),
});

export const upsertGeolocVehicleRow = createServerFn({ method: 'POST' })
  .validator(upsertVehicleSchema)
  .handler(async ({ data }): Promise<{ id: string; action: 'created' | 'updated' }> => {
    const colValues: Record<string, any> = {
      [GEOLOC_COLS.immat]: data.plate,
      [GEOLOC_COLS.conducteur]: data.conducteur.slice(0, 250),
      [GEOLOC_COLS.flotte]: { label: data.flotte },
      [GEOLOC_COLS.semaine]: data.weekId,
      [GEOLOC_COLS.debut]: { date: data.startDate },
      [GEOLOC_COLS.fin]: { date: data.endDate },
      [GEOLOC_COLS.alerte]: { label: data.alerte },
      [GEOLOC_COLS.nbTrajets]: String(data.nbTrajets),
      [GEOLOC_COLS.kmTotal]: String(data.kmTotal),
      [GEOLOC_COLS.kmPro]: String(data.kmPro),
      [GEOLOC_COLS.kmHors]: String(data.kmHors),
      [GEOLOC_COLS.conduiteH]: String(data.conduiteH),
      [GEOLOC_COLS.attenteH]: String(data.attenteH),
      [GEOLOC_COLS.vitesseMoy]: String(data.vitesseMoy),
      [GEOLOC_COLS.joursRoules]: String(data.joursRoules),
      [GEOLOC_COLS.premierDepart]: data.premierDepart,
      [GEOLOC_COLS.derniereArrivee]: data.derniereArrivee,
      [GEOLOC_COLS.amplitudeH]: String(data.amplitudeH),
      [GEOLOC_COLS.syntheseJour]: { text: data.syntheseJour.slice(0, 1900) },
    };

    if (data.linkedVehicleId && /^\d+$/.test(data.linkedVehicleId)) {
      colValues[GEOLOC_COLS.vehiculeRel] = { item_ids: [Number(data.linkedVehicleId)] };
    }

    const itemName = `${data.plate} · ${data.weekId}`;

    if (data.existingItemId) {
      const updateMutation = `mutation ($b: ID!, $id: ID!, $vals: JSON!) {
        change_multiple_column_values(board_id: $b, item_id: $id, column_values: $vals, create_labels_if_missing: true) {
          id
        }
      }`;
      const res = await callMondayApi(updateMutation, {
        variables: {
          b: GEOLOC_BOARD_ID,
          id: data.existingItemId,
          vals: JSON.stringify(colValues),
        },
      });
      const updatedId = res?.change_multiple_column_values?.id ?? res?.data?.change_multiple_column_values?.id;
      if (!updatedId) throw new Error(`Échec mise à jour de ${itemName}`);
      clearBoardCache(GEOLOC_BOARD_ID);
      return { id: String(updatedId), action: 'updated' };
    }

    const createMutation = `mutation ($b: ID!, $g: String!, $n: String!, $vals: JSON!) {
      create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $vals, create_labels_if_missing: true) {
        id
      }
    }`;
    const res = await callMondayApi(createMutation, {
      variables: {
        b: GEOLOC_BOARD_ID,
        g: data.groupId,
        n: itemName,
        vals: JSON.stringify(colValues),
      },
    });
    const createdId = res?.create_item?.id ?? res?.data?.create_item?.id;
    if (!createdId) throw new Error(`Échec création de ${itemName}`);
    clearBoardCache(GEOLOC_BOARD_ID);
    return { id: String(createdId), action: 'created' };
  });

export const upsertGeolocVehicleBatch = createServerFn({ method: 'POST' })
  .validator(z.object({ rows: z.array(upsertVehicleSchema).min(1).max(20) }))
  .handler(async ({ data }): Promise<Array<{ plate: string; id: string; action: 'created' | 'updated' }>> => {
    const vars: Record<string, any> = { b: GEOLOC_BOARD_ID };
    const defs: string[] = ['$b: ID!'];
    const muts: string[] = [];
    const meta: Array<{ alias: string; plate: string; action: 'created' | 'updated' }> = [];

    data.rows.forEach((row, idx) => {
      const colValues: Record<string, any> = {
        [GEOLOC_COLS.immat]: row.plate,
        [GEOLOC_COLS.conducteur]: row.conducteur.slice(0, 250),
        [GEOLOC_COLS.flotte]: { label: row.flotte },
        [GEOLOC_COLS.semaine]: row.weekId,
        [GEOLOC_COLS.debut]: { date: row.startDate },
        [GEOLOC_COLS.fin]: { date: row.endDate },
        [GEOLOC_COLS.alerte]: { label: row.alerte },
        [GEOLOC_COLS.nbTrajets]: String(row.nbTrajets),
        [GEOLOC_COLS.kmTotal]: String(row.kmTotal),
        [GEOLOC_COLS.kmPro]: String(row.kmPro),
        [GEOLOC_COLS.kmHors]: String(row.kmHors),
        [GEOLOC_COLS.conduiteH]: String(row.conduiteH),
        [GEOLOC_COLS.attenteH]: String(row.attenteH),
        [GEOLOC_COLS.vitesseMoy]: String(row.vitesseMoy),
        [GEOLOC_COLS.joursRoules]: String(row.joursRoules),
        [GEOLOC_COLS.premierDepart]: row.premierDepart,
        [GEOLOC_COLS.derniereArrivee]: row.derniereArrivee,
        [GEOLOC_COLS.amplitudeH]: String(row.amplitudeH),
        [GEOLOC_COLS.syntheseJour]: { text: row.syntheseJour.slice(0, 1900) },
      };
      if (row.linkedVehicleId && /^\d+$/.test(row.linkedVehicleId)) {
        colValues[GEOLOC_COLS.vehiculeRel] = { item_ids: [Number(row.linkedVehicleId)] };
      }

      const alias = `m${idx}`;
      vars[`v${idx}`] = JSON.stringify(colValues);
      defs.push(`$v${idx}: JSON!`);

      if (row.existingItemId) {
        vars[`id${idx}`] = row.existingItemId;
        defs.push(`$id${idx}: ID!`);
        muts.push(
          `${alias}: change_multiple_column_values(board_id: $b, item_id: $id${idx}, column_values: $v${idx}, create_labels_if_missing: true) { id }`,
        );
        meta.push({ alias, plate: row.plate, action: 'updated' });
      } else {
        vars[`g${idx}`] = row.groupId;
        vars[`n${idx}`] = `${row.plate} · ${row.weekId}`;
        defs.push(`$g${idx}: String!`, `$n${idx}: String!`);
        muts.push(
          `${alias}: create_item(board_id: $b, group_id: $g${idx}, item_name: $n${idx}, column_values: $v${idx}, create_labels_if_missing: true) { id }`,
        );
        meta.push({ alias, plate: row.plate, action: 'created' });
      }
    });

    const query = `mutation (${defs.join(', ')}) { ${muts.join(' ')} }`;
    const res = await callMondayApi(query, { variables: vars });
    const root = res?.data ?? res;
    clearBoardCache(GEOLOC_BOARD_ID);

    return meta.map((m) => ({
      plate: m.plate,
      id: String(root?.[m.alias]?.id || ''),
      action: m.action,
    }));
  });

/**
 * Archive proprement toutes les lignes d'une semaine donnée dans Synthèse Géolocalisation (5108497111).
 * Utilise uniquement archive_item (récupérable dans les archives Monday, aucune suppression de structure).
 */
export const archiveGeolocWeekItems = createServerFn({ method: 'POST' })
  .validator(z.object({ weekId: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ archivedCount: number }> => {
    const cleanWeek = data.weekId.replace(/"/g, '').trim();
    const q = `query {
      boards(ids: [${GEOLOC_BOARD_ID}]) {
        items_page(
          limit: 500,
          query_params: { rules: [{ column_id: "${GEOLOC_COLS.semaine}", compare_value: ["${cleanWeek}"], operator: contains_text }] }
        ) {
          items {
            id
            state
            column_values(ids: ["${GEOLOC_COLS.semaine}"]) { id text }
          }
        }
      }
    }`;
    const res = await callMondayApi(q, { ttlMs: 0 });
    const items: any[] = res?.boards?.[0]?.items_page?.items ?? res?.data?.boards?.[0]?.items_page?.items ?? [];
    const targetIds = items
      .filter((it) => (!it.state || it.state === 'active') && String(it.column_values?.[0]?.text || '').trim() === cleanWeek)
      .map((it) => String(it.id));

    let archivedCount = 0;
    const BATCH = 20;
    for (let i = 0; i < targetIds.length; i += BATCH) {
      const chunk = targetIds.slice(i, i + BATCH);
      const muts = chunk.map((id, idx) => `a${idx}: archive_item(item_id: ${id}) { id }`).join(' ');
      await callMondayApi(`mutation { ${muts} }`);
      archivedCount += chunk.length;
    }

    clearBoardCache(GEOLOC_BOARD_ID);
    return { archivedCount };
  });
