import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DataSurVehiculeBoard } from '@api/BoardSDK';

type ColRes = { boards?: { columns?: { settings_str?: string }[] }[] };
type RawVehiculeItem = {
  id: string;
  name: string;
  group?: { id: string; title: string };
};

type ItemsRes = {
  boards?: { items_page?: { cursor?: string | null; items?: RawVehiculeItem[] } }[];
  next_items_page?: { cursor?: string | null; items?: RawVehiculeItem[] };
};

export interface VehiculeItem {
  id: string;
  name: string; // Immatriculation pure (ex: "CW-637-NE")
  rawName: string; // Nom brut Monday (ex: "#2|CW-637-NE")
  immat: string; // Immatriculation pure (ex: "CW-637-NE")
  num: number | null; // Numéro de flotte (ex: 2)
  groupId?: string;
  groupTitle: string; // "Véhicules en service" ou "Véhicule restitué"
  isRestitue: boolean;
}

// Cache mémoire haute performance (60s)
let _cachedVehicules: VehiculeItem[] | null = null;
let _cachedVehiculesTime = 0;
const VEHICULES_TTL = 60_000;

export const invalidateVehiculesCache = () => {
  _cachedVehicules = null;
  _cachedVehiculesTime = 0;
};

/**
 * Extrait uniquement l'immatriculation du véhicule, sans le préfixe "#1 |" ou "#1|"
 */
export function extractCleanImmat(raw: string): string {
  if (!raw) return '';
  if (raw.includes('|')) {
    const parts = raw.split('|');
    return parts.slice(1).join('|').trim();
  }
  const clean = raw.replace(/^#?\d+\s*[-:–—]\s*/, '').trim();
  if (clean) return clean;
  const cleanSpace = raw.replace(/^#?\d+\s+/, '').trim();
  if (cleanSpace) return cleanSpace;
  return raw.trim();
}

/**
 * Extrait le numéro de véhicule éventuel pour le tri ou la recherche
 */
export function extractVehiculeNum(raw: string): number | null {
  if (!raw) return null;
  if (raw.includes('|')) {
    const first = raw.split('|')[0];
    const m = first.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  const m = raw.match(/#?(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

// Liste des véhicules du tableau relié (5092005027), nettoyés, triés et mis en cache
export const getVehicules = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    if (_cachedVehicules && Date.now() - _cachedVehiculesTime < VEHICULES_TTL) {
      return { vehicules: _cachedVehicules };
    }

    const board = new DataSurVehiculeBoard();
    const col = (await board.executeGraphQL(
      `query { boards(ids: [5092124669]) { columns(ids: ["board_relation_mm0rm9h1"]) { settings_str } } }`, {}
    )) as ColRes;

    const settings = JSON.parse(col.boards?.[0]?.columns?.[0]?.settings_str ?? '{}') as { boardIds?: number[] };
    const ids = settings.boardIds ?? [5092005027];
    if (!ids.length) return { vehicules: [] as VehiculeItem[] };

    const targetBoardId = ids[0];
    const rawItems: RawVehiculeItem[] = [];
    let cursor: string | null = null;
    let first = true;

    while (first || cursor) {
      let res: ItemsRes;
      if (first) {
        res = (await board.executeGraphQL(
          `query { boards(ids: [${targetBoardId}]) { items_page(limit: 500) { cursor items { id name group { id title } } } } }`, {}
        )) as ItemsRes;
      } else {
        res = (await board.executeGraphQL(
          `query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { id name group { id title } } } }`, { c: cursor }
        )) as ItemsRes;
      }

      const page = first ? res.boards?.[0]?.items_page : res.next_items_page;
      first = false;

      for (const it of page?.items ?? []) {
        if (it?.id && it?.name) rawItems.push(it);
      }
      cursor = page?.cursor ?? null;
    }

    // Extraction de l'immatriculation pure, détection du groupe Monday et tri
    const vehicules: VehiculeItem[] = rawItems
      .map((it) => {
        const cleanImmat = extractCleanImmat(it.name);
        const num = extractVehiculeNum(it.name);
        const groupTitle = it.group?.title?.trim() || 'Véhicules en service';
        const isRestitue = /restitu/i.test(groupTitle);
        return {
          id: it.id,
          name: cleanImmat, // Uniquement l'immatriculation
          rawName: it.name,
          immat: cleanImmat,
          num,
          groupId: it.group?.id,
          groupTitle,
          isRestitue,
        };
      })
      .sort((a, b) => {
        // En service d'abord, restitué ensuite
        if (a.isRestitue !== b.isRestitue) {
          return a.isRestitue ? 1 : -1;
        }
        return a.immat.localeCompare(b.immat, 'fr', { numeric: true, sensitivity: 'base' });
      });

    _cachedVehicules = vehicules;
    _cachedVehiculesTime = Date.now();

    return { vehicules };
  });

// Création d'une nouvelle saisie véhicule avec date et montant obligatoires
export const createSaisieVehicule = createServerFn({ method: 'POST' })
  .validator(z.object({
    vehiculeId: z.string().min(1, 'Véhicule obligatoire'),
    vehiculeName: z.string().min(1, 'Nom du véhicule obligatoire'),
    dateInfo: z.string().min(1, 'Date obligatoire'),
    montantHt: z.number().positive('Le montant doit être supérieur à 0'),
    kmRelev: z.number().nullable().optional(),
    fournisseur: z.string().optional(),
    prestation: z.string().optional(),
    menuDeSaisie: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const board = new DataSurVehiculeBoard();
    const d = new Date(data.dateInfo);

    const res = await board.item().create({
      name: data.vehiculeName,
      immat: data.vehiculeName,
      vhiculeConcern: { linkedItems: [{ id: data.vehiculeId }] },
      dateInfo: d,
      montantHt: data.montantHt,
      ...(data.kmRelev != null ? { kmRelev: data.kmRelev } : {}),
      ...(data.fournisseur ? { fournisseur: [data.fournisseur] } : {}),
      ...(data.prestation ? { prestationRalise: [data.prestation] } : {}),
      ...(data.menuDeSaisie ? { menuDeSaisie: data.menuDeSaisie } : {}),
    }).inGroup('topics').execute();

    // Invalider le cache après création
    invalidateVehiculesCache();

    return { id: res?.id ?? null };
  });
