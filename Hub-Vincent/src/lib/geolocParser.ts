import ExcelJS from 'exceljs';

export type GeoAlertStatus =
  | 'Conforme'
  | 'Hors horaires'
  | 'Week-end'
  | 'Vie privée'
  | 'Hors horaires + WE'
  | 'Inactif';

export interface GeoTrip {
  id: string;
  plate: string;
  vehicleLabel: string;
  driverName: string;
  fleet: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Dim, 1=Lun .. 6=Sam
  dayLabel: string; // Lun 02/11
  isWeekend: boolean;
  startTime: string; // HH:MM
  startTimeFull: string; // HH:MM:SS
  startMinutes: number; // minutes from 00:00
  endTime: string; // HH:MM
  endTimeFull: string; // HH:MM:SS
  endMinutes: number; // minutes from 00:00
  startAddress: string;
  endAddress: string;
  distanceKm: number;
  durationSec: number;
  durationLabel: string; // ex: 0h24
  isPrivate: boolean;
}

export interface GeoDailySummary {
  date: string; // YYYY-MM-DD
  dayLabel: string; // Lun 02/11
  dayOfWeek: number;
  isWeekend: boolean;
  firstDeparture: string; // HH:MM
  firstDepartureMin: number;
  lastArrival: string; // HH:MM
  lastArrivalMin: number;
  amplitudeMin: number; // lastArrivalMin - firstDepartureMin
  amplitudeLabel: string; // ex: 9h14
  driveSec: number;
  driveLabel: string;
  onSiteStopMin: number; // temps d'arrêt cumulé entre trajets sur la journée
  tripCount: number;
  distanceKm: number;
  privateTripsCount: number;
  sitesVisited: string[];
  trips: GeoTrip[];
}

export interface GeoVehicleSummary {
  id: string;
  plate: string; // Plaque officielle AA-123-AA normalisée
  fleet: string;
  fleetMondayLabel: string;
  vehicleLabel: string; // Libellé brut de la colonne Véhicule
  fleetNumber: string; // ex: "35"
  driverName: string; // ex: "sanitaire" ou "CATHERINE ASTREINTE"
  sheetName: string | null;
  tripCount: number;
  distanceKm: number;
  distanceProKm: number;
  distanceOffHoursKm: number;
  driveDurationSec: number;
  driveDurationHours: number;
  avgSpeedKmh: number;
  waitDurationSec: number;
  waitDurationHours: number;
  stopDurationSec: number;
  stopDurationHours: number;
  daysActive: number;
  weekendDays: number;
  weekendTripsCount: number;
  weekendKm: number;
  privateTripsCount: number;
  privateKm: number;
  avgFirstDeparture: string; // HH:MM ou "—"
  avgLastArrival: string; // HH:MM ou "—"
  earliestDeparture: string; // HH:MM ou "—"
  latestArrival: string; // HH:MM ou "—"
  avgAmplitudeHours: number;
  alertStatus: GeoAlertStatus;
  hasOffHours: boolean;
  hasWeekend: boolean;
  hasPrivate: boolean;
  dailySummaryText: string;
  days: GeoDailySummary[];
  trips: GeoTrip[];
}

export interface GeoWorkbookResult {
  fileName: string;
  weekId: string; // ex: 2026-S45
  weekNumber: number;
  year: number;
  weekLabel: string; // ex: Semaine 45 · 02/11 → 08/11/2026
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  sheetCount: number;
  matchedDetailSheets: number;
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
  totalTrips: number;
  totalKm: number;
  totalKmPro: number;
  totalKmOffHours: number;
  totalDriveHours: number;
  alertVehiclesCount: number;
  offHoursVehiclesCount: number;
  weekendVehiclesCount: number;
  privateVehiclesCount: number;
  fleets: string[];
  vehicles: GeoVehicleSummary[];
  allTrips: GeoTrip[];
}

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const MONDAY_FLEET_LABELS = [
  'Flotte principale',
  'FLOTTE GROUPE FACILITY',
  'FLOTTE AGENT CONTRAT',
  'FLOTTE POLYVALENTE',
  'Autre',
] as const;

export function normalizePlate(raw: string): string {
  const s = (raw || '').toUpperCase().trim();
  const m = s.match(/([A-Z]{2})[-\s]?(\d{3})[-\s]?([A-Z]{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s.replace(/\s+/g, '');
}

export function normalizePlateKey(raw: string): string {
  return normalizePlate(raw).replace(/[^A-Z0-9]/g, '');
}

function stripAlphaNum(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeHeader(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unwrapCellValue(val: unknown): unknown {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && !(val instanceof Date)) {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((p) => p.text || '').join('');
    }
    if ('result' in obj && obj.result !== undefined) {
      return unwrapCellValue(obj.result);
    }
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text;
    }
  }
  return val;
}

function cellToString(val: unknown): string {
  const u = unwrapCellValue(val);
  if (u === null || u === undefined) return '';
  if (u instanceof Date) return formatDateTimeUTC(u);
  return String(u).trim();
}

function cellToNumber(val: unknown): number {
  const u = unwrapCellValue(val);
  if (u === null || u === undefined || u === '') return 0;
  if (typeof u === 'number') return Number.isFinite(u) ? u : 0;
  const cleaned = String(u).replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pad2(n: number): string {
  return String(Math.floor(Math.abs(n))).padStart(2, '0');
}

function formatDateTimeUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function parseDurationToSeconds(val: unknown): number {
  const u = unwrapCellValue(val);
  if (u === null || u === undefined || u === '') return 0;

  if (typeof u === 'number') {
    if (!Number.isFinite(u) || u <= 0) return 0;
    // Fraction de journée Excel (ex: 0.5 = 12h)
    return Math.round(u * 86400);
  }

  if (u instanceof Date) {
    // Durée stockée comme Date Excel (autour de 1899-12-30)
    const epochMs = Date.UTC(1899, 11, 30, 0, 0, 0);
    const diff = u.getTime() - epochMs;
    if (diff >= 0 && diff < 365 * 86400 * 1000) {
      return Math.round(diff / 1000);
    }
    return u.getUTCHours() * 3600 + u.getUTCMinutes() * 60 + u.getUTCSeconds();
  }

  const str = String(u).trim();
  const m = str.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    return h * 3600 + min * 60 + sec;
  }
  return 0;
}

function parseTripDateTime(val: unknown): {
  date: string;
  timeShort: string;
  timeFull: string;
  minutes: number;
  dayOfWeek: number;
} | null {
  const u = unwrapCellValue(val);
  if (u === null || u === undefined || u === '') return null;

  if (u instanceof Date && !Number.isNaN(u.getTime())) {
    const y = u.getUTCFullYear();
    const mo = u.getUTCMonth() + 1;
    const da = u.getUTCDate();
    const h = u.getUTCHours();
    const mi = u.getUTCMinutes();
    const se = u.getUTCSeconds();
    const date = `${y}-${pad2(mo)}-${pad2(da)}`;
    const dayOfWeek = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
    return {
      date,
      timeShort: `${pad2(h)}:${pad2(mi)}`,
      timeFull: `${pad2(h)}:${pad2(mi)}:${pad2(se)}`,
      minutes: h * 60 + mi,
      dayOfWeek,
    };
  }

  if (typeof u === 'number' && u > 20000) {
    // Excel serial date
    const ms = Date.UTC(1899, 11, 30) + Math.round(u * 86400 * 1000);
    return parseTripDateTime(new Date(ms));
  }

  const str = String(u).trim();
  // Format YYYY-MM-DD HH:MM:SS
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10);
    const da = parseInt(iso[3], 10);
    const h = parseInt(iso[4], 10);
    const mi = parseInt(iso[5], 10);
    const se = iso[6] ? parseInt(iso[6], 10) : 0;
    const dayOfWeek = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
    return {
      date: `${y}-${pad2(mo)}-${pad2(da)}`,
      timeShort: `${pad2(h)}:${pad2(mi)}`,
      timeFull: `${pad2(h)}:${pad2(mi)}:${pad2(se)}`,
      minutes: h * 60 + mi,
      dayOfWeek,
    };
  }

  // Format DD/MM/YYYY HH:MM(:SS)
  const fr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (fr) {
    const da = parseInt(fr[1], 10);
    const mo = parseInt(fr[2], 10);
    const y = parseInt(fr[3], 10);
    const h = parseInt(fr[4], 10);
    const mi = parseInt(fr[5], 10);
    const se = fr[6] ? parseInt(fr[6], 10) : 0;
    const dayOfWeek = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
    return {
      date: `${y}-${pad2(mo)}-${pad2(da)}`,
      timeShort: `${pad2(h)}:${pad2(mi)}`,
      timeFull: `${pad2(h)}:${pad2(mi)}:${pad2(se)}`,
      minutes: h * 60 + mi,
      dayOfWeek,
    };
  }

  return null;
}

export function formatMinutesToHHMM(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '—';
  const rounded = Math.round(min);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatMinutesToDuration(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '0h00';
  const rounded = Math.round(min);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h${pad2(m)}`;
}

export function formatSecondsToDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0h00';
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${pad2(m)}`;
}

export function formatDayLabel(dateStr: string, dayOfWeek: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${DAY_SHORT[dayOfWeek] || ''} ${parts[2]}/${parts[1]}`;
}

function formatDateFrShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function formatDateFrFull(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getIsoWeek(dateStr: string): { year: number; week: number } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    const now = new Date();
    return { year: now.getFullYear(), week: 1 };
  }
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function extractDriverName(vehicleLabel: string, plate: string): { fleetNumber: string; driverName: string } {
  const numMatch = vehicleLabel.match(/^\s*0?(\d{1,3})\s*[/\-|]/);
  const fleetNumber = numMatch ? numMatch[1] : '';

  const parenMatch = vehicleLabel.match(/\(([^)]+)\)?/);
  if (parenMatch && parenMatch[1]?.trim()) {
    return { fleetNumber, driverName: parenMatch[1].trim() };
  }

  let cleaned = vehicleLabel
    .replace(/^\s*\d{1,3}\s*[/\-|]\s*/, '')
    .replace(new RegExp(plate.replace(/-/g, '[-\\s]?'), 'i'), '')
    .replace(/[()]/g, '')
    .trim();

  if (!cleaned) cleaned = plate || vehicleLabel;
  return { fleetNumber, driverName: cleaned };
}

function resolveMondayFleetLabel(rawFleet: string): string {
  const norm = normalizeHeader(rawFleet);
  for (const label of MONDAY_FLEET_LABELS) {
    if (normalizeHeader(label) === norm) return label;
  }
  if (norm.includes('principale')) return 'Flotte principale';
  if (norm.includes('facility')) return 'FLOTTE GROUPE FACILITY';
  if (norm.includes('contrat')) return 'FLOTTE AGENT CONTRAT';
  if (norm.includes('polyvalente')) return 'FLOTTE POLYVALENTE';
  return 'Autre';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function parseGeolocWorkbook(
  data: ArrayBuffer | Uint8Array,
  fileName: string = 'Export_GPS.xlsx',
): Promise<GeoWorkbookResult> {
  const wb = new ExcelJS.Workbook();
  const buffer = data instanceof ArrayBuffer ? data : (data.buffer as ArrayBuffer);
  await wb.xlsx.load(buffer);

  if (wb.worksheets.length === 0) {
    throw new Error('Le fichier Excel ne contient aucun onglet.');
  }

  // 1. Trouver l'onglet Résumé
  const summarySheet =
    wb.worksheets.find((ws) => normalizeHeader(ws.name).includes('resume')) || wb.worksheets[0];
  const detailSheets = wb.worksheets.filter((ws) => ws !== summarySheet);

  // 2. Détecter les indices de colonnes de l'onglet Résumé
  const headerRow = summarySheet.getRow(1);
  const colIdx = {
    fleet: 1,
    vehicle: 2,
    plate: 3,
    trips: 4,
    distance: 5,
    driveDuration: 6,
    avgSpeed: 7,
    waitDuration: 8,
    stopDuration: 9,
    distancePro: 10,
    distanceOff: 11,
  };

  headerRow.eachCell((cell, colNumber) => {
    const h = normalizeHeader(cellToString(cell.value));
    if (h === 'flotte') colIdx.fleet = colNumber;
    else if (h === 'vehicule') colIdx.vehicle = colNumber;
    else if (h.includes('matricul')) colIdx.plate = colNumber;
    else if (h.includes('nombre') && h.includes('trajet')) colIdx.trips = colNumber;
    else if (h === 'distance parcourue') colIdx.distance = colNumber;
    else if (h.includes('duree totale')) colIdx.driveDuration = colNumber;
    else if (h.includes('vitesse')) colIdx.avgSpeed = colNumber;
    else if (h.includes('attente')) colIdx.waitDuration = colNumber;
    else if (h.includes('arret')) colIdx.stopDuration = colNumber;
    else if (h.includes('pendant') && h.includes('horaire')) colIdx.distancePro = colNumber;
    else if (h.includes('hors') && h.includes('horaire')) colIdx.distanceOff = colNumber;
  });

  // 3. Lire toutes les lignes de l'onglet Résumé
  type RawSummaryRow = {
    fleet: string;
    vehicleLabel: string;
    plate: string;
    tripCount: number;
    distanceKm: number;
    driveDurationSec: number;
    avgSpeedKmh: number;
    waitDurationSec: number;
    stopDurationSec: number;
    distanceProKm: number;
    distanceOffHoursKm: number;
  };

  const rawRows: RawSummaryRow[] = [];
  for (let r = 2; r <= summarySheet.rowCount; r++) {
    const row = summarySheet.getRow(r);
    const fleet = cellToString(row.getCell(colIdx.fleet).value);
    const vehicleLabel = cellToString(row.getCell(colIdx.vehicle).value);
    const rawPlate = cellToString(row.getCell(colIdx.plate).value);
    if (!vehicleLabel && !rawPlate) continue;

    const plate = normalizePlate(rawPlate || vehicleLabel);
    const tripCount = Math.round(cellToNumber(row.getCell(colIdx.trips).value));
    const distanceKm = round2(cellToNumber(row.getCell(colIdx.distance).value));
    const driveDurationSec = parseDurationToSeconds(row.getCell(colIdx.driveDuration).value);
    const avgSpeedKmh = round1(cellToNumber(row.getCell(colIdx.avgSpeed).value));
    const waitDurationSec = parseDurationToSeconds(row.getCell(colIdx.waitDuration).value);
    const stopDurationSec = parseDurationToSeconds(row.getCell(colIdx.stopDuration).value);
    const distanceProKm = round2(cellToNumber(row.getCell(colIdx.distancePro).value));
    const distanceOffHoursKm = round2(cellToNumber(row.getCell(colIdx.distanceOff).value));

    rawRows.push({
      fleet: fleet || 'Autre',
      vehicleLabel: vehicleLabel || plate,
      plate,
      tripCount,
      distanceKm,
      driveDurationSec,
      avgSpeedKmh,
      waitDurationSec,
      stopDurationSec,
      distanceProKm,
      distanceOffHoursKm,
    });
  }

  // 4. Associer chaque onglet de détail à sa ligne Résumé
  const usedSheets = new Set<ExcelJS.Worksheet>();
  const sheetByRowIndex = new Map<number, ExcelJS.Worksheet>();

  // Passe 1 : correspondance exacte / préfixe sur libellé alphanumérique
  for (let i = 0; i < rawRows.length; i++) {
    const normLabel = stripAlphaNum(rawRows[i].vehicleLabel);
    if (!normLabel) continue;
    const match = detailSheets.find((ws) => {
      if (usedSheets.has(ws)) return false;
      const normWs = stripAlphaNum(ws.name);
      return normWs.length >= 4 && (normLabel.startsWith(normWs) || normWs.startsWith(normLabel));
    });
    if (match) {
      sheetByRowIndex.set(i, match);
      usedSheets.add(match);
    }
  }

  // Passe 2 : correspondance par plaque d'immatriculation
  for (let i = 0; i < rawRows.length; i++) {
    if (sheetByRowIndex.has(i)) continue;
    const plateKey = normalizePlateKey(rawRows[i].plate);
    if (!plateKey || plateKey.length < 6) continue;
    const match = detailSheets.find((ws) => {
      if (usedSheets.has(ws)) return false;
      return stripAlphaNum(ws.name).includes(plateKey.toLowerCase());
    });
    if (match) {
      sheetByRowIndex.set(i, match);
      usedSheets.add(match);
    }
  }

  // 5. Parser les trajets de chaque véhicule et calculer les KPI horaires & alertes
  const vehicles: GeoVehicleSummary[] = [];
  const allTrips: GeoTrip[] = [];
  let minTripDate = '';
  let maxTripDate = '';
  let matchedDetailSheets = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const ws = sheetByRowIndex.get(i) || null;
    if (ws) matchedDetailSheets++;

    const { fleetNumber, driverName } = extractDriverName(raw.vehicleLabel, raw.plate);
    const trips: GeoTrip[] = [];

    if (ws) {
      // Détecter colonnes de l'onglet détail
      const dHeader = ws.getRow(1);
      const dCol = { startDt: 1, startAddr: 2, endDt: 3, endAddr: 4, dist: 5, dur: 6 };
      dHeader.eachCell((cell, colNumber) => {
        const h = normalizeHeader(cellToString(cell.value));
        if (h.includes('date') && h.includes('depart')) dCol.startDt = colNumber;
        else if ((h.includes('adresse') || h.includes('site')) && h.includes('depart')) dCol.startAddr = colNumber;
        else if (h.includes('date') && h.includes('arrive')) dCol.endDt = colNumber;
        else if ((h.includes('adresse') || h.includes('site')) && h.includes('arrive')) dCol.endAddr = colNumber;
        else if (h.includes('distance')) dCol.dist = colNumber;
        else if (h.includes('duree')) dCol.dur = colNumber;
      });

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const startParsed = parseTripDateTime(row.getCell(dCol.startDt).value);
        const endParsed = parseTripDateTime(row.getCell(dCol.endDt).value);
        if (!startParsed) continue;

        const startAddress = cellToString(row.getCell(dCol.startAddr).value);
        const endAddress = cellToString(row.getCell(dCol.endAddr).value);
        const distanceKm = round2(cellToNumber(row.getCell(dCol.dist).value));
        let durationSec = parseDurationToSeconds(row.getCell(dCol.dur).value);
        if (durationSec === 0 && endParsed) {
          const diffMin = endParsed.minutes - startParsed.minutes;
          if (diffMin > 0) durationSec = diffMin * 60;
        }

        const isWeekend = startParsed.dayOfWeek === 0 || startParsed.dayOfWeek === 6;
        const isPrivate =
          startAddress.toLowerCase().includes('vie privée') ||
          startAddress.toLowerCase().includes('vie privee') ||
          endAddress.toLowerCase().includes('vie privée') ||
          endAddress.toLowerCase().includes('vie privee');

        if (!minTripDate || startParsed.date < minTripDate) minTripDate = startParsed.date;
        if (!maxTripDate || startParsed.date > maxTripDate) maxTripDate = startParsed.date;

        const trip: GeoTrip = {
          id: `${raw.plate}_${startParsed.date}_${startParsed.timeFull}_${r}`,
          plate: raw.plate,
          vehicleLabel: raw.vehicleLabel,
          driverName,
          fleet: raw.fleet,
          date: startParsed.date,
          dayOfWeek: startParsed.dayOfWeek,
          dayLabel: formatDayLabel(startParsed.date, startParsed.dayOfWeek),
          isWeekend,
          startTime: startParsed.timeShort,
          startTimeFull: startParsed.timeFull,
          startMinutes: startParsed.minutes,
          endTime: endParsed?.timeShort || startParsed.timeShort,
          endTimeFull: endParsed?.timeFull || startParsed.timeFull,
          endMinutes: endParsed?.minutes ?? startParsed.minutes,
          startAddress: startAddress || '—',
          endAddress: endAddress || '—',
          distanceKm,
          durationSec,
          durationLabel: formatSecondsToDuration(durationSec),
          isPrivate,
        };

        trips.push(trip);
        allTrips.push(trip);
      }
    }

    // Regroupement jour par jour
    const byDate = new Map<string, GeoTrip[]>();
    for (const t of trips) {
      const arr = byDate.get(t.date) || [];
      arr.push(t);
      byDate.set(t.date, arr);
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    const days: GeoDailySummary[] = sortedDates.map((date) => {
      const dayTrips = (byDate.get(date) || []).sort((a, b) => a.startMinutes - b.startMinutes);
      const first = dayTrips[0];
      const last = dayTrips[dayTrips.length - 1];
      const firstMin = first.startMinutes;
      const lastMin = Math.max(last.endMinutes, firstMin);
      const amplitudeMin = Math.max(0, lastMin - firstMin);
      const driveSec = dayTrips.reduce((s, t) => s + t.durationSec, 0);
      const distanceKm = round2(dayTrips.reduce((s, t) => s + t.distanceKm, 0));

      let onSiteStopMin = 0;
      for (let k = 1; k < dayTrips.length; k++) {
        const gap = dayTrips[k].startMinutes - dayTrips[k - 1].endMinutes;
        if (gap > 0) onSiteStopMin += gap;
      }

      const sitesSet = new Set<string>();
      for (const t of dayTrips) {
        if (!t.isPrivate && t.endAddress && t.endAddress !== '—') {
          sitesSet.add(t.endAddress);
        }
      }

      const privateTripsCount = dayTrips.filter((t) => t.isPrivate).length;

      return {
        date,
        dayLabel: first.dayLabel,
        dayOfWeek: first.dayOfWeek,
        isWeekend: first.isWeekend,
        firstDeparture: first.startTime,
        firstDepartureMin: firstMin,
        lastArrival: last.endTime,
        lastArrivalMin: lastMin,
        amplitudeMin,
        amplitudeLabel: formatMinutesToDuration(amplitudeMin),
        driveSec,
        driveLabel: formatSecondsToDuration(driveSec),
        onSiteStopMin,
        tripCount: dayTrips.length,
        distanceKm,
        privateTripsCount,
        sitesVisited: Array.from(sitesSet),
        trips: dayTrips,
      };
    });

    const daysActive = days.length;
    const weekendDays = days.filter((d) => d.isWeekend).length;
    const weekendTrips = trips.filter((t) => t.isWeekend);
    const weekendTripsCount = weekendTrips.length;
    const weekendKm = round2(weekendTrips.reduce((s, t) => s + t.distanceKm, 0));
    const privateTrips = trips.filter((t) => t.isPrivate);
    const privateTripsCount = privateTrips.length;
    const privateKm = round2(privateTrips.reduce((s, t) => s + t.distanceKm, 0));

    const avgFirstDeparture =
      daysActive > 0
        ? formatMinutesToHHMM(days.reduce((s, d) => s + d.firstDepartureMin, 0) / daysActive)
        : '—';
    const avgLastArrival =
      daysActive > 0
        ? formatMinutesToHHMM(days.reduce((s, d) => s + d.lastArrivalMin, 0) / daysActive)
        : '—';
    const earliestDeparture =
      daysActive > 0 ? formatMinutesToHHMM(Math.min(...days.map((d) => d.firstDepartureMin))) : '—';
    const latestArrival =
      daysActive > 0 ? formatMinutesToHHMM(Math.max(...days.map((d) => d.lastArrivalMin))) : '—';
    const avgAmplitudeHours =
      daysActive > 0 ? round2(days.reduce((s, d) => s + d.amplitudeMin, 0) / daysActive / 60) : 0;

    const effectiveTripCount = raw.tripCount || trips.length;
    const effectiveDistanceKm = raw.distanceKm || round2(trips.reduce((s, t) => s + t.distanceKm, 0));
    const hasOffHours = raw.distanceOffHoursKm > 0.05;
    const hasWeekend = weekendTripsCount > 0;
    const hasPrivate = privateTripsCount > 0;

    let alertStatus: GeoAlertStatus = 'Conforme';
    if (effectiveTripCount === 0 && effectiveDistanceKm === 0) {
      alertStatus = 'Inactif';
    } else if (hasOffHours && hasWeekend) {
      alertStatus = 'Hors horaires + WE';
    } else if (hasOffHours) {
      alertStatus = 'Hors horaires';
    } else if (hasWeekend) {
      alertStatus = 'Week-end';
    } else if (hasPrivate) {
      alertStatus = 'Vie privée';
    }

    const dailySummaryText =
      days.length > 0
        ? days
            .map((d) => {
              const tags = [
                d.isWeekend ? 'WE' : '',
                d.privateTripsCount > 0 ? `${d.privateTripsCount} vie privée` : '',
              ]
                .filter(Boolean)
                .join(', ');
              return `${d.dayLabel} : ${d.firstDeparture} → ${d.lastArrival} (ampl. ${d.amplitudeLabel} · ${d.tripCount} tr. · ${d.distanceKm} km${tags ? ` · ${tags}` : ''})`;
            })
            .join('\n')
        : 'Aucun trajet enregistré sur la période.';

    vehicles.push({
      id: `${raw.plate}_${i}`,
      plate: raw.plate,
      fleet: raw.fleet,
      fleetMondayLabel: resolveMondayFleetLabel(raw.fleet),
      vehicleLabel: raw.vehicleLabel,
      fleetNumber,
      driverName,
      sheetName: ws?.name || null,
      tripCount: effectiveTripCount,
      distanceKm: effectiveDistanceKm,
      distanceProKm: raw.distanceProKm,
      distanceOffHoursKm: raw.distanceOffHoursKm,
      driveDurationSec: raw.driveDurationSec,
      driveDurationHours: round2(raw.driveDurationSec / 3600),
      avgSpeedKmh: raw.avgSpeedKmh,
      waitDurationSec: raw.waitDurationSec,
      waitDurationHours: round2(raw.waitDurationSec / 3600),
      stopDurationSec: raw.stopDurationSec,
      stopDurationHours: round2(raw.stopDurationSec / 3600),
      daysActive,
      weekendDays,
      weekendTripsCount,
      weekendKm,
      privateTripsCount,
      privateKm,
      avgFirstDeparture,
      avgLastArrival,
      earliestDeparture,
      latestArrival,
      avgAmplitudeHours,
      alertStatus,
      hasOffHours,
      hasWeekend,
      hasPrivate,
      dailySummaryText,
      days,
      trips,
    });
  }

  // 6. Déterminer la période (nom de fichier en priorité, sinon min/max trajets)
  const fileDates = fileName.match(/(\d{4}-\d{2}-\d{2})/g);
  const startDate =
    fileDates && fileDates.length >= 1
      ? fileDates[0]
      : minTripDate || new Date().toISOString().slice(0, 10);
  const endDate =
    fileDates && fileDates.length >= 2
      ? fileDates[1]
      : maxTripDate || startDate;

  const { year, week } = getIsoWeek(startDate);
  const weekId = `${year}-S${pad2(week)}`;
  const weekLabel = `Semaine ${pad2(week)} · ${formatDateFrShort(startDate)} → ${formatDateFrFull(endDate)}`;

  const activeVehicles = vehicles.filter((v) => v.tripCount > 0 || v.distanceKm > 0).length;
  const fleets = Array.from(new Set(vehicles.map((v) => v.fleet).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );

  return {
    fileName,
    weekId,
    weekNumber: week,
    year,
    weekLabel,
    startDate,
    endDate,
    sheetCount: wb.worksheets.length,
    matchedDetailSheets,
    totalVehicles: vehicles.length,
    activeVehicles,
    inactiveVehicles: vehicles.length - activeVehicles,
    totalTrips: vehicles.reduce((s, v) => s + v.tripCount, 0),
    totalKm: round2(vehicles.reduce((s, v) => s + v.distanceKm, 0)),
    totalKmPro: round2(vehicles.reduce((s, v) => s + v.distanceProKm, 0)),
    totalKmOffHours: round2(vehicles.reduce((s, v) => s + v.distanceOffHoursKm, 0)),
    totalDriveHours: round1(vehicles.reduce((s, v) => s + v.driveDurationHours, 0)),
    alertVehiclesCount: vehicles.filter(
      (v) => v.alertStatus !== 'Conforme' && v.alertStatus !== 'Inactif',
    ).length,
    offHoursVehiclesCount: vehicles.filter((v) => v.hasOffHours).length,
    weekendVehiclesCount: vehicles.filter((v) => v.hasWeekend).length,
    privateVehiclesCount: vehicles.filter((v) => v.hasPrivate).length,
    fleets,
    vehicles: vehicles.sort((a, b) => b.distanceKm - a.distanceKm),
    allTrips: allTrips.sort((a, b) =>
      a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date),
    ),
  };
}
