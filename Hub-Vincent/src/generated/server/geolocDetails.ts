import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { callMondayApi, clearBoardCache } from '@api/mondayApi';
import {
  formatDayLabel,
  formatMinutesToDuration,
  formatSecondsToDuration,
  normalizePlate,
  normalizePlateKey,
  type GeoAlertStatus,
  type GeoDailySummary,
  type GeoTrip,
  type GeoVehicleSummary,
  type GeoWorkbookResult,
} from '@lib/geolocParser';

export const GEOLOC_DETAILS_BOARD_ID = '5108589918';
export const GEOLOC_DETAILS_BOARD_URL = `https://groupefacility.monday.com/boards/${GEOLOC_DETAILS_BOARD_ID}`;
export const POLE_RH_SALARIES_BOARD_ID = '5108574616';

export const GEOLOC_DETAILS_COLS = {
  semaine: 'text_mm9e7ck1',
  date: 'date_mm9egqck',
  immat: 'text_mm9ex34p',
  vehicule: 'text_mm9ek5a8',
  conducteur: 'text_mm9e1p1b',
  statutPointage: 'color_mm9e6ygt',
  ecartTotalMin: 'numeric_mm9ef62y',
  amplitudeUtileH: 'numeric_mm9e3853',
  plageUtile: 'text_mm9ezj2v',
  kmUtiles: 'numeric_mm9e7bf0',
  trajetsExclus: 'numeric_mm9evmsj',
  pointageJson: 'long_text_mm9eam56',
  trajetsJson: 'long_text_mm9eh4h1',
} as const;

export interface DriverPointageEntry {
  id: string;
  employeeName: string;
  plannedStart: string; // HH:MM
  plannedEnd: string;   // HH:MM
  compliant: boolean;
  deltaMin: number;     // +25 = 25 min dépassées, -15 = 15 min de moins
  note: string;
}

export interface DayAnnotationState {
  excludedTripIds: string[];
  pointages: DriverPointageEntry[];
  mondayItemId?: string;
}

export interface CompactStoredTrip {
  id: string;
  s?: string; // startTime HH:MM (rétro-compatibilité)
  e?: string; // endTime HH:MM (rétro-compatibilité)
  sm: number; // startMinutes
  em: number; // endMinutes
  sa: string; // startAddress
  ea: string; // endAddress
  km: number;
  d: number;  // durationSec
  p?: 1;      // isPrivate
  ex?: 1;     // excluded (Domicile-Travail)
}

export interface MondayDetailWeekSummary {
  weekId: string;
  groupId: string;
  groupTitle: string;
  minDate: string;
  maxDate: string;
  dayCount: number;
  vehicleCount: number;
  tripCount: number;
  pointedCount: number;
  nonCompliantCount: number;
  isOlderThan6Months: boolean;
}

export interface MondayWeekDetailsPayload {
  weekId: string;
  weekLabel: string;
  annotationsByKey: Record<string, DayAnnotationState>; // "${plateKey}::${date}" -> state
  itemIdByKey: Record<string, string>;
  reconstructedWorkbook: GeoWorkbookResult | null;
}

function parseLongTextVal(cv: { text?: string; value?: string } | undefined): string {
  if (!cv) return '';
  if (cv.text && cv.text.trim()) return cv.text.trim();
  if (cv.value) {
    try {
      const p = JSON.parse(cv.value);
      if (typeof p?.text === 'string') return p.text.trim();
    } catch {
      // ignore
    }
  }
  return '';
}

export function serializeTripsCompact(trips: GeoTrip[], excludedSet: Set<string>): string {
  const MAX_LEN = 1940; // Limite colonne long_text Monday = 2000 caractères
  const addrCaps = [55, 38, 26, 18, 12];

  for (const cap of addrCaps) {
    const arr: CompactStoredTrip[] = trips.map((t) => ({
      id: t.id,
      sm: t.startMinutes,
      em: t.endMinutes,
      sa: t.startAddress.slice(0, cap),
      ea: t.endAddress.slice(0, cap),
      km: t.distanceKm,
      d: t.durationSec,
      ...(t.isPrivate ? { p: 1 as const } : {}),
      ...(excludedSet.has(t.id) ? { ex: 1 as const } : {}),
    }));
    const raw = JSON.stringify(arr);
    if (raw.length <= MAX_LEN) return raw;
  }

  // Ultime repli (journée exceptionnelle > 20 trajets) : IDs courts + adresses 10 car.
  const minimal = trips.map((t, i) => ({
    id: `${i}`,
    sm: t.startMinutes,
    em: t.endMinutes,
    sa: t.startAddress.slice(0, 10),
    ea: t.endAddress.slice(0, 10),
    km: t.distanceKm,
    d: t.durationSec,
    ...(t.isPrivate ? { p: 1 as const } : {}),
    ...(excludedSet.has(t.id) ? { ex: 1 as const } : {}),
  }));
  return JSON.stringify(minimal).slice(0, MAX_LEN);
}

/**
 * Calcule les horaires utiles et les totaux d'une journée en excluant les trajets
 * cochés "Domicile ↔ Travail" :
 * - Si le 1er trajet (Maison → 1er chantier) est exclu, le début utile = heure d'ARRIVÉE sur le 1er chantier.
 * - Si le dernier trajet (Dernier chantier → Maison) est exclu, la fin utile = heure de DÉPART du dernier chantier.
 * - Tout trajet exclu voit sa distance et sa durée de conduite retirées des totaux utiles.
 */
export function computeUsefulDayMetrics(day: GeoDailySummary, excludedIds: Set<string>) {
  const trips = day.trips;
  const totalCount = trips.length;
  const excludedCount = trips.filter((t) => excludedIds.has(t.id)).length;

  if (totalCount === 0 || excludedCount === totalCount) {
    return {
      excludedCount,
      usefulTripsCount: 0,
      usefulStartMin: 0,
      usefulEndMin: 0,
      usefulStartLabel: '—',
      usefulEndLabel: '—',
      usefulAmplitudeMin: 0,
      usefulAmplitudeLabel: '0h00',
      usefulAmplitudeHours: 0,
      usefulKm: 0,
      excludedKm: Math.round(day.distanceKm * 100) / 100,
      usefulDriveMin: 0,
      usefulDriveLabel: '0h00',
      usefulOnSiteMin: 0,
      usefulOnSiteLabel: '0h00',
      hasAdjustment: excludedCount > 0,
    };
  }

  // Compter combien de trajets au tout début (aller domicile) sont exclus
  let leadingExcluded = 0;
  while (leadingExcluded < totalCount && excludedIds.has(trips[leadingExcluded].id)) {
    leadingExcluded++;
  }
  // Compter combien de trajets à la toute fin (retour domicile) sont exclus
  let trailingExcluded = 0;
  while (
    trailingExcluded < totalCount - leadingExcluded &&
    excludedIds.has(trips[totalCount - 1 - trailingExcluded].id)
  ) {
    trailingExcluded++;
  }

  const usefulStartMin =
    leadingExcluded > 0 ? trips[leadingExcluded - 1].endMinutes : trips[0].startMinutes;
  const usefulEndMin =
    trailingExcluded > 0
      ? trips[totalCount - trailingExcluded].startMinutes
      : trips[totalCount - 1].endMinutes;

  const toHHMM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let usefulKm = 0;
  let excludedKm = 0;
  let usefulDriveSec = 0;
  let middleExcludedDriveMin = 0;

  trips.forEach((t, idx) => {
    const isEx = excludedIds.has(t.id);
    if (isEx) {
      excludedKm += t.distanceKm;
      const isMiddle = idx >= leadingExcluded && idx < totalCount - trailingExcluded;
      if (isMiddle) {
        middleExcludedDriveMin += Math.max(0, t.endMinutes - t.startMinutes);
      }
    } else {
      usefulKm += t.distanceKm;
      usefulDriveSec += t.durationSec;
    }
  });

  const rawAmp = Math.max(0, usefulEndMin - usefulStartMin);
  const usefulAmplitudeMin = Math.max(0, rawAmp - middleExcludedDriveMin);
  const usefulDriveMin = Math.round(usefulDriveSec / 60);
  const usefulOnSiteMin = Math.max(0, usefulAmplitudeMin - usefulDriveMin);

  return {
    excludedCount,
    usefulTripsCount: totalCount - excludedCount,
    usefulStartMin,
    usefulEndMin,
    usefulStartLabel: toHHMM(usefulStartMin),
    usefulEndLabel: toHHMM(usefulEndMin),
    usefulAmplitudeMin,
    usefulAmplitudeLabel: formatMinutesToDuration(usefulAmplitudeMin),
    usefulAmplitudeHours: Math.round((usefulAmplitudeMin / 60) * 100) / 100,
    usefulKm: Math.round(usefulKm * 100) / 100,
    excludedKm: Math.round(excludedKm * 100) / 100,
    usefulDriveMin,
    usefulDriveLabel: formatMinutesToDuration(usefulDriveMin),
    usefulOnSiteMin,
    usefulOnSiteLabel: formatMinutesToDuration(usefulOnSiteMin),
    hasAdjustment: excludedCount > 0,
  };
}

export function parseHHMMToMin(hhmm: string): number | null {
  const m = String(hhmm || '').trim().match(/^(\d{1,2})[:h](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function computePointageStatus(pointages: DriverPointageEntry[]): {
  status: 'Non pointé' | 'Conforme' | 'Écart horaire';
  totalDeltaMin: number;
} {
  const valid = pointages.filter((p) => p.employeeName.trim());
  if (valid.length === 0) return { status: 'Non pointé', totalDeltaMin: 0 };
  const hasNonCompliant = valid.some((p) => !p.compliant);
  const totalDeltaMin = valid.reduce((sum, p) => sum + (p.compliant ? 0 : (p.deltaMin || 0)), 0);
  return {
    status: hasNonCompliant ? 'Écart horaire' : 'Conforme',
    totalDeltaMin,
  };
}

export const getRhEmployeeNames = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async (): Promise<string[]> => {
    try {
      const q = `query {
        boards(ids: [${POLE_RH_SALARIES_BOARD_ID}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["color_mm9ea1d9"]) { id text }
            }
          }
        }
      }`;
      const res = await callMondayApi(q);
      const items: any[] = res?.boards?.[0]?.items_page?.items ?? res?.data?.boards?.[0]?.items_page?.items ?? [];
      return items
        .filter((it) => {
          const st = String(it.column_values?.[0]?.text || '').trim().toLowerCase();
          return st !== 'sorti';
        })
        .map((it) => String(it.name || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'fr'));
    } catch {
      return [];
    }
  });

export const getMondayDetailWeeksList = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async (): Promise<{ weeks: MondayDetailWeekSummary[]; totalActiveItems: number }> => {
    const colIds = [
      GEOLOC_DETAILS_COLS.semaine,
      GEOLOC_DETAILS_COLS.date,
      GEOLOC_DETAILS_COLS.immat,
      GEOLOC_DETAILS_COLS.statutPointage,
    ];
    const q = `query {
      boards(ids: [${GEOLOC_DETAILS_BOARD_ID}]) {
        items_count
        items_page(limit: 500) {
          cursor
          items {
            id
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) { id text }
          }
        }
      }
    }`;
    const res = await callMondayApi(q);
    const board = res?.boards?.[0] ?? res?.data?.boards?.[0];
    const totalActiveItems = Number(board?.items_count || 0);
    let allItems: any[] = board?.items_page?.items ?? [];
    let cursor: string | null = board?.items_page?.cursor ?? null;

    while (cursor && allItems.length < 5000) {
      const nextQ = `query ($c: String!) {
        next_items_page(limit: 500, cursor: $c) {
          cursor
          items {
            id
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) { id text }
          }
        }
      }`;
      const nr = await callMondayApi(nextQ, { variables: { c: cursor } });
      const page = nr?.next_items_page ?? nr?.data?.next_items_page;
      if (!page?.items?.length) break;
      allItems = allItems.concat(page.items);
      cursor = page.cursor ?? null;
    }

    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    const byWeek = new Map<
      string,
      MondayDetailWeekSummary & { plates: Set<string> }
    >();

    for (const it of allItems) {
      const m = new Map<string, string>();
      for (const cv of it.column_values || []) m.set(cv.id, String(cv.text || '').trim());
      const weekId = m.get(GEOLOC_DETAILS_COLS.semaine) || it.group?.title || '';
      if (!weekId) continue;
      const dt = m.get(GEOLOC_DETAILS_COLS.date) || '';
      const plate = m.get(GEOLOC_DETAILS_COLS.immat) || '';
      const st = m.get(GEOLOC_DETAILS_COLS.statutPointage) || '';

      const cur = byWeek.get(weekId) ?? {
        weekId,
        groupId: String(it.group?.id || ''),
        groupTitle: String(it.group?.title || weekId),
        minDate: dt,
        maxDate: dt,
        dayCount: 0,
        vehicleCount: 0,
        tripCount: 0,
        pointedCount: 0,
        nonCompliantCount: 0,
        isOlderThan6Months: false,
        plates: new Set<string>(),
      };

      cur.dayCount += 1;
      if (plate) cur.plates.add(plate);
      if (dt && (!cur.minDate || dt < cur.minDate)) cur.minDate = dt;
      if (dt && (!cur.maxDate || dt > cur.maxDate)) cur.maxDate = dt;
      if (st === 'Conforme' || st === 'Écart horaire') cur.pointedCount += 1;
      if (st === 'Écart horaire') cur.nonCompliantCount += 1;
      byWeek.set(weekId, cur);
    }

    const weeks: MondayDetailWeekSummary[] = Array.from(byWeek.values())
      .map(({ plates, ...rest }) => ({
        ...rest,
        vehicleCount: plates.size,
        isOlderThan6Months: Boolean(rest.maxDate && rest.maxDate < sixMonthsAgo),
      }))
      .sort((a, b) => b.weekId.localeCompare(a.weekId));

    return { weeks, totalActiveItems };
  });

export const loadMondayWeekDetails = createServerFn({ method: 'GET' })
  .validator(z.object({ weekId: z.string().min(1), forceRefresh: z.boolean().optional() }))
  .handler(async ({ data }): Promise<MondayWeekDetailsPayload> => {
    const colIds = Object.values(GEOLOC_DETAILS_COLS);
    const q = `query {
      boards(ids: [${GEOLOC_DETAILS_BOARD_ID}]) {
        items_page(limit: 500, query_params: { rules: [{ column_id: "${GEOLOC_DETAILS_COLS.semaine}", compare_value: ["${data.weekId.replace(/"/g, '')}"], operator: contains_text }] }) {
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

    if (data.forceRefresh) clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
    const res = await callMondayApi(q);
    let items: any[] = res?.boards?.[0]?.items_page?.items ?? res?.data?.boards?.[0]?.items_page?.items ?? [];
    let cursor: string | null = res?.boards?.[0]?.items_page?.cursor ?? res?.data?.boards?.[0]?.items_page?.cursor ?? null;

    while (cursor && items.length < 1500) {
      const nq = `query ($c: String!) {
        next_items_page(limit: 500, cursor: $c) {
          cursor
          items {
            id
            name
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) { id text value }
          }
        }
      }`;
      const nr = await callMondayApi(nq, { variables: { c: cursor } });
      const page = nr?.next_items_page ?? nr?.data?.next_items_page;
      if (!page?.items?.length) break;
      items = items.concat(page.items);
      cursor = page.cursor ?? null;
    }

    const annotationsByKey: Record<string, DayAnnotationState> = {};
    const itemIdByKey: Record<string, string> = {};
    let weekLabel = data.weekId;

    // Regroupement par véhicule pour reconstruire un GeoWorkbookResult complet (rechargement sans Excel !)
    const vehMap = new Map<
      string,
      {
        plate: string;
        vehicleLabel: string;
        driverName: string;
        days: GeoDailySummary[];
        trips: GeoTrip[];
      }
    >();

    let minDate = '';
    let maxDate = '';

    for (const it of items) {
      const byId = new Map<string, any>();
      for (const cv of it.column_values || []) byId.set(cv.id, cv);
      const txt = (id: string) => String(byId.get(id)?.text || '').trim();
      const sem = txt(GEOLOC_DETAILS_COLS.semaine);
      if (sem && sem !== data.weekId) continue;

      if (it.group?.title && weekLabel === data.weekId) weekLabel = it.group.title;

      const date = txt(GEOLOC_DETAILS_COLS.date);
      const plate = normalizePlate(txt(GEOLOC_DETAILS_COLS.immat));
      const plateKey = normalizePlateKey(plate);
      const vehicleLabel = txt(GEOLOC_DETAILS_COLS.vehicule) || plate;
      const driverName = txt(GEOLOC_DETAILS_COLS.conducteur) || vehicleLabel;
      if (!date || !plateKey) continue;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      const key = `${plateKey}::${date}`;
      itemIdByKey[key] = String(it.id);

      // Parse pointages
      let pointages: DriverPointageEntry[] = [];
      const rawPointage = parseLongTextVal(byId.get(GEOLOC_DETAILS_COLS.pointageJson));
      if (rawPointage) {
        try {
          const parsed = JSON.parse(rawPointage);
          if (Array.isArray(parsed)) pointages = parsed;
        } catch {
          // ignore
        }
      }

      // Parse trajets JSON
      const excludedIds: string[] = [];
      const dayTrips: GeoTrip[] = [];
      const rawTrips = parseLongTextVal(byId.get(GEOLOC_DETAILS_COLS.trajetsJson));
      const dow = new Date(`${date}T12:00:00`).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dayLabel = formatDayLabel(date, dow);

      if (rawTrips) {
        try {
          const parsed: CompactStoredTrip[] = JSON.parse(rawTrips);
          if (Array.isArray(parsed)) {
            const minToHHMM = (m: number) =>
              `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
            parsed.forEach((ct, idx) => {
              const sStr = ct.s || minToHHMM(ct.sm);
              const eStr = ct.e || minToHHMM(ct.em);
              const tid = ct.id || `${plate}_${date}_${sStr}_${idx}`;
              if (ct.ex) excludedIds.push(tid);
              dayTrips.push({
                id: tid,
                plate,
                vehicleLabel,
                driverName,
                fleet: 'Monday Archive',
                date,
                dayOfWeek: dow,
                dayLabel,
                isWeekend,
                startTime: sStr,
                startTimeFull: `${sStr}:00`,
                startMinutes: ct.sm,
                endTime: eStr,
                endTimeFull: `${eStr}:00`,
                endMinutes: ct.em,
                startAddress: ct.sa || '—',
                endAddress: ct.ea || '—',
                distanceKm: Number(ct.km) || 0,
                durationSec: Number(ct.d) || 0,
                durationLabel: formatSecondsToDuration(Number(ct.d) || 0),
                isPrivate: Boolean(ct.p),
              });
            });
          }
        } catch {
          // ignore
        }
      }

      annotationsByKey[key] = {
        excludedTripIds: excludedIds,
        pointages,
        mondayItemId: String(it.id),
      };

      if (dayTrips.length > 0) {
        dayTrips.sort((a, b) => a.startMinutes - b.startMinutes);
        const first = dayTrips[0];
        const last = dayTrips[dayTrips.length - 1];
        const ampMin = Math.max(0, last.endMinutes - first.startMinutes);
        const driveSec = dayTrips.reduce((s, t) => s + t.durationSec, 0);
        const driveMin = Math.round(driveSec / 60);
        const distKm = Math.round(dayTrips.reduce((s, t) => s + t.distanceKm, 0) * 100) / 100;
        const privCount = dayTrips.filter((t) => t.isPrivate).length;

        const daySummary: GeoDailySummary = {
          date,
          dayLabel,
          dayOfWeek: dow,
          isWeekend,
          firstDeparture: first.startTime,
          lastArrival: last.endTime,
          firstDepartureMin: first.startMinutes,
          lastArrivalMin: last.endMinutes,
          amplitudeMin: ampMin,
          amplitudeLabel: formatMinutesToDuration(ampMin),
          driveSec,
          driveLabel: formatSecondsToDuration(driveSec),
          onSiteStopMin: Math.max(0, ampMin - driveMin),
          tripCount: dayTrips.length,
          distanceKm: distKm,
          privateTripsCount: privCount,
          sitesVisited: Array.from(new Set(dayTrips.map((t) => t.endAddress).filter((a) => a && a !== '—'))),
          trips: dayTrips,
        };

        const curV = vehMap.get(plateKey) ?? {
          plate,
          vehicleLabel,
          driverName,
          days: [],
          trips: [],
        };
        curV.days.push(daySummary);
        curV.trips.push(...dayTrips);
        vehMap.set(plateKey, curV);
      }
    }

    // Reconstruire le GeoWorkbookResult si on a des trajets stockés
    let reconstructedWorkbook: GeoWorkbookResult | null = null;
    if (vehMap.size > 0) {
      const vehicles: GeoVehicleSummary[] = [];
      const allTrips: GeoTrip[] = [];
      let vIdx = 0;

      for (const v of vehMap.values()) {
        v.days.sort((a, b) => a.date.localeCompare(b.date));
        allTrips.push(...v.trips);
        const totalKm = Math.round(v.trips.reduce((s, t) => s + t.distanceKm, 0) * 100) / 100;
        const driveSec = v.trips.reduce((s, t) => s + t.durationSec, 0);
        const avgAmpH =
          v.days.length > 0
            ? Math.round((v.days.reduce((s, d) => s + d.amplitudeMin, 0) / v.days.length / 60) * 100) / 100
            : 0;
        const weekendDays = v.days.filter((d) => d.isWeekend).length;
        const hasWeekend = weekendDays > 0;
        const hasPrivate = v.trips.some((t) => t.isPrivate);
        const alertStatus: GeoAlertStatus = hasWeekend
          ? 'Week-end'
          : hasPrivate
            ? 'Vie privée'
            : 'Conforme';

        const avgFirstMin = Math.round(
          v.days.reduce((s, d) => s + d.firstDepartureMin, 0) / Math.max(1, v.days.length)
        );
        const avgLastMin = Math.round(
          v.days.reduce((s, d) => s + d.lastArrivalMin, 0) / Math.max(1, v.days.length)
        );
        const toT = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

        vehicles.push({
          id: `${v.plate}_mon_${vIdx++}`,
          plate: v.plate,
          vehicleLabel: v.vehicleLabel,
          fleetNumber: '',
          driverName: v.driverName,
          sheetName: v.plate,
          fleet: 'Archives Monday',
          fleetMondayLabel: 'Archives Monday',
          tripCount: v.trips.length,
          distanceKm: totalKm,
          distanceProKm: totalKm,
          distanceOffHoursKm: 0,
          driveDurationSec: driveSec,
          driveDurationHours: Math.round((driveSec / 3600) * 100) / 100,
          waitDurationSec: 0,
          waitDurationHours: 0,
          stopDurationSec: 0,
          stopDurationHours: 0,
          avgSpeedKmh: 0,
          daysActive: v.days.length,
          weekendDays,
          weekendTripsCount: v.trips.filter((t) => t.isWeekend).length,
          weekendKm: Math.round(v.trips.filter((t) => t.isWeekend).reduce((s, t) => s + t.distanceKm, 0) * 100) / 100,
          privateTripsCount: v.trips.filter((t) => t.isPrivate).length,
          privateKm: Math.round(v.trips.filter((t) => t.isPrivate).reduce((s, t) => s + t.distanceKm, 0) * 100) / 100,
          avgFirstDeparture: toT(avgFirstMin),
          avgLastArrival: toT(avgLastMin),
          earliestDeparture: v.days.reduce((best, d) => (!best || d.firstDeparture < best ? d.firstDeparture : best), '') || '—',
          latestArrival: v.days.reduce((best, d) => (!best || d.lastArrival > best ? d.lastArrival : best), '') || '—',
          avgAmplitudeHours: avgAmpH,
          alertStatus,
          hasOffHours: false,
          hasWeekend,
          hasPrivate,
          dailySummaryText: v.days.map((d) => `${d.dayLabel} : ${d.firstDeparture} → ${d.lastArrival} (${d.distanceKm} km)`).join('\n'),
          days: v.days,
          trips: v.trips,
        });
      }

      vehicles.sort((a, b) => b.distanceKm - a.distanceKm);
      const wkMatch = data.weekId.match(/^(\d{4})-S(\d{1,2})$/i);
      const yearNum = wkMatch ? parseInt(wkMatch[1], 10) : new Date().getFullYear();
      const weekNum = wkMatch ? parseInt(wkMatch[2], 10) : 1;
      const totalDriveHours = Math.round(vehicles.reduce((s, v) => s + v.driveDurationHours, 0) * 10) / 10;

      reconstructedWorkbook = {
        fileName: `Archive Monday — ${weekLabel}`,
        weekId: data.weekId,
        weekNumber: weekNum,
        year: yearNum,
        weekLabel,
        startDate: minDate,
        endDate: maxDate,
        sheetCount: vehicles.length + 1,
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.length,
        inactiveVehicles: 0,
        matchedDetailSheets: vehicles.length,
        totalTrips: allTrips.length,
        totalKm: Math.round(vehicles.reduce((s, v) => s + v.distanceKm, 0) * 100) / 100,
        totalKmPro: Math.round(vehicles.reduce((s, v) => s + v.distanceProKm, 0) * 100) / 100,
        totalKmOffHours: 0,
        totalDriveHours,
        alertVehiclesCount: vehicles.filter((v) => v.alertStatus !== 'Conforme' && v.alertStatus !== 'Inactif').length,
        offHoursVehiclesCount: 0,
        weekendVehiclesCount: vehicles.filter((v) => v.hasWeekend).length,
        privateVehiclesCount: vehicles.filter((v) => v.hasPrivate).length,
        fleets: ['Archives Monday'],
        vehicles,
        allTrips: allTrips.sort((a, b) => (a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date))),
      };
    }

    return {
      weekId: data.weekId,
      weekLabel,
      annotationsByKey,
      itemIdByKey,
      reconstructedWorkbook,
    };
  });

export const ensureDetailsWeekGroup = createServerFn({ method: 'POST' })
  .validator(z.object({ weekId: z.string().min(1), weekLabel: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ groupId: string }> => {
    clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
    const q = `query { boards(ids: [${GEOLOC_DETAILS_BOARD_ID}]) { groups { id title } } }`;
    const res = await callMondayApi(q);
    const groups: Array<{ id: string; title: string }> =
      res?.boards?.[0]?.groups ?? res?.data?.boards?.[0]?.groups ?? [];
    const targetLower = data.weekLabel.trim().toLowerCase();
    const found = groups.find(
      (g) =>
        g.title.trim().toLowerCase() === targetLower ||
        g.title.toLowerCase().includes(data.weekId.toLowerCase())
    );
    if (found) return { groupId: found.id };

    const m = `mutation ($b: ID!, $n: String!) { create_group(board_id: $b, group_name: $n, position_relative_method: before_at) { id } }`;
    const created = await callMondayApi(m, {
      variables: { b: GEOLOC_DETAILS_BOARD_ID, n: data.weekLabel },
    });
    const newId = created?.create_group?.id ?? created?.data?.create_group?.id;
    if (!newId) throw new Error(`Impossible de créer le groupe ${data.weekLabel}`);
    clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
    return { groupId: String(newId) };
  });

const dailyDetailRowSchema = z.object({
  groupId: z.string().min(1),
  existingItemId: z.string().optional(),
  weekId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plate: z.string().min(1),
  vehicleLabel: z.string(),
  driverName: z.string(),
  statutPointage: z.enum(['Non pointé', 'Conforme', 'Écart horaire']),
  ecartTotalMin: z.number(),
  amplitudeUtileH: z.number(),
  plageUtile: z.string(),
  kmUtiles: z.number(),
  trajetsExclus: z.number(),
  pointageJson: z.string(),
  trajetsJson: z.string(),
});

export const upsertDailyDetailRow = createServerFn({ method: 'POST' })
  .validator(dailyDetailRowSchema)
  .handler(async ({ data }): Promise<{ id: string; action: 'created' | 'updated' }> => {
    const colVals: Record<string, any> = {
      [GEOLOC_DETAILS_COLS.semaine]: data.weekId,
      [GEOLOC_DETAILS_COLS.date]: { date: data.date },
      [GEOLOC_DETAILS_COLS.immat]: data.plate,
      [GEOLOC_DETAILS_COLS.vehicule]: data.vehicleLabel.slice(0, 200),
      [GEOLOC_DETAILS_COLS.conducteur]: data.driverName.slice(0, 200),
      [GEOLOC_DETAILS_COLS.statutPointage]: { label: data.statutPointage },
      [GEOLOC_DETAILS_COLS.ecartTotalMin]: String(data.ecartTotalMin),
      [GEOLOC_DETAILS_COLS.amplitudeUtileH]: String(data.amplitudeUtileH),
      [GEOLOC_DETAILS_COLS.plageUtile]: data.plageUtile.slice(0, 80),
      [GEOLOC_DETAILS_COLS.kmUtiles]: String(data.kmUtiles),
      [GEOLOC_DETAILS_COLS.trajetsExclus]: String(data.trajetsExclus),
      [GEOLOC_DETAILS_COLS.pointageJson]: { text: data.pointageJson },
      [GEOLOC_DETAILS_COLS.trajetsJson]: { text: data.trajetsJson },
    };

    const itemName = `${data.plate} · ${data.date}`;

    if (data.existingItemId) {
      const m = `mutation ($b: ID!, $id: ID!, $vals: JSON!) {
        change_multiple_column_values(board_id: $b, item_id: $id, column_values: $vals, create_labels_if_missing: true) { id }
      }`;
      const res = await callMondayApi(m, {
        variables: { b: GEOLOC_DETAILS_BOARD_ID, id: data.existingItemId, vals: JSON.stringify(colVals) },
      });
      const uid = res?.change_multiple_column_values?.id ?? res?.data?.change_multiple_column_values?.id;
      if (!uid) throw new Error(`Échec mise à jour ${itemName}`);
      clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
      return { id: String(uid), action: 'updated' };
    }

    const m = `mutation ($b: ID!, $g: String!, $n: String!, $vals: JSON!) {
      create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $vals, create_labels_if_missing: true) { id }
    }`;
    const res = await callMondayApi(m, {
      variables: { b: GEOLOC_DETAILS_BOARD_ID, g: data.groupId, n: itemName, vals: JSON.stringify(colVals) },
    });
    const cid = res?.create_item?.id ?? res?.data?.create_item?.id;
    if (!cid) throw new Error(`Échec création ${itemName}`);
    clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
    return { id: String(cid), action: 'created' };
  });

/**
 * Batch GraphQL : regroupe jusqu'à 15 créations / mises à jour journalières en 1 SEUL appel API Monday
 * (divise par ~10 le nombre d'appels API et accélère l'archivage d'une semaine complète de ~25s à ~3s).
 */
export const upsertDailyDetailBatch = createServerFn({ method: 'POST' })
  .validator(z.object({ rows: z.array(dailyDetailRowSchema).min(1).max(15) }))
  .handler(async ({ data }): Promise<Array<{ key: string; id: string; action: 'created' | 'updated' }>> => {
    const vars: Record<string, any> = { b: GEOLOC_DETAILS_BOARD_ID };
    const defs: string[] = ['$b: ID!'];
    const muts: string[] = [];
    const meta: Array<{ alias: string; key: string; action: 'created' | 'updated' }> = [];

    data.rows.forEach((row, idx) => {
      const colVals: Record<string, any> = {
        [GEOLOC_DETAILS_COLS.semaine]: row.weekId,
        [GEOLOC_DETAILS_COLS.date]: { date: row.date },
        [GEOLOC_DETAILS_COLS.immat]: row.plate,
        [GEOLOC_DETAILS_COLS.vehicule]: row.vehicleLabel.slice(0, 200),
        [GEOLOC_DETAILS_COLS.conducteur]: row.driverName.slice(0, 200),
        [GEOLOC_DETAILS_COLS.statutPointage]: { label: row.statutPointage },
        [GEOLOC_DETAILS_COLS.ecartTotalMin]: String(row.ecartTotalMin),
        [GEOLOC_DETAILS_COLS.amplitudeUtileH]: String(row.amplitudeUtileH),
        [GEOLOC_DETAILS_COLS.plageUtile]: row.plageUtile.slice(0, 80),
        [GEOLOC_DETAILS_COLS.kmUtiles]: String(row.kmUtiles),
        [GEOLOC_DETAILS_COLS.trajetsExclus]: String(row.trajetsExclus),
        [GEOLOC_DETAILS_COLS.pointageJson]: { text: row.pointageJson },
        [GEOLOC_DETAILS_COLS.trajetsJson]: { text: row.trajetsJson },
      };

      const alias = `d${idx}`;
      const key = `${normalizePlateKey(row.plate)}::${row.date}`;
      vars[`v${idx}`] = JSON.stringify(colVals);
      defs.push(`$v${idx}: JSON!`);

      if (row.existingItemId) {
        vars[`id${idx}`] = row.existingItemId;
        defs.push(`$id${idx}: ID!`);
        muts.push(
          `${alias}: change_multiple_column_values(board_id: $b, item_id: $id${idx}, column_values: $v${idx}, create_labels_if_missing: true) { id }`,
        );
        meta.push({ alias, key, action: 'updated' });
      } else {
        vars[`g${idx}`] = row.groupId;
        vars[`n${idx}`] = `${row.plate} · ${row.date}`;
        defs.push(`$g${idx}: String!`, `$n${idx}: String!`);
        muts.push(
          `${alias}: create_item(board_id: $b, group_id: $g${idx}, item_name: $n${idx}, column_values: $v${idx}, create_labels_if_missing: true) { id }`,
        );
        meta.push({ alias, key, action: 'created' });
      }
    });

    const query = `mutation (${defs.join(', ')}) { ${muts.join(' ')} }`;
    const res = await callMondayApi(query, { variables: vars });
    const root = res?.data ?? res;
    clearBoardCache(GEOLOC_DETAILS_BOARD_ID);

    return meta.map((m) => ({
      key: m.key,
      id: String(root?.[m.alias]?.id || ''),
      action: m.action,
    }));
  });

export const archiveDetailsOlderThan6Months = createServerFn({ method: 'POST' })
  .validator(z.object({ groupIds: z.array(z.string().min(1)) }))
  .handler(async ({ data }): Promise<{ archivedGroups: number }> => {
    let archivedGroups = 0;
    for (const gid of data.groupIds) {
      const m = `mutation ($b: ID!, $g: String!) { archive_group(board_id: $b, group_id: $g) { id } }`;
      await callMondayApi(m, { variables: { b: GEOLOC_DETAILS_BOARD_ID, g: gid } });
      archivedGroups++;
    }
    clearBoardCache(GEOLOC_DETAILS_BOARD_ID);
    return { archivedGroups };
  });
