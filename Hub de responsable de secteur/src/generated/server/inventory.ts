import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InventairesConsommablesBoard, TableauCompletChantierBoard } from '@api/BoardSDK';

const ANIMATEURS = ['Natacha THOMAS', 'Ketty PAULIN', 'Emilie TOBIE', 'Andre LEVESQUE'] as const;

const CONTRATS = [
  // Essuie-mains
  ['rechargeEmAutocutContrat', 'EM autocut'],
  ['EmFeuilleAFeuilleContrat', 'Feuille à f.'],
  ['EmBobineTextileContrat', 'Plus de bobine'],
  ['initial420705EmRouleaux160mCx6Contrat', 'EM rouleaux 160m'],

  // Savons
  ['Savon400MlContrat', 'Savon 400 ML'],
  ['savonMousse1lInventaireContrat', 'Savon mousse 1L'],
  ['SavonEcolab5lContrat', 'Savon 5L'],
  ['kalhygeS262RechAppaSavKlintV2lContrat', 'Savon KLINT V 2L'],
  ['kalhygeS713RechSavAEcomax4lContrat', 'Savon 4L'],
  ['initial95974SavonAtelierKrestoCitrus2lContrat', 'Savon atelier 2L'],

  // Papiers hygiéniques
  ['ph300mContrat', 'PH 300M'],
  ['Ph60mContrat', 'PH 60M'],
  ['ph22MContrat', 'PH 22 M'],

  // Hygiène & Sanitaire
  ['kalhygeS663RechDifpPwPassionMangContrat', 'Recharge parfum'],
  ['kalhygeS647RechDesfGrilUrinManguContrat', 'Grilles urinoir'],
  ['kalhygeS365RechAppaHygfDboCitronContrat', 'Hygiène féminine citron'],
] as const;

type ContratKey = (typeof CONTRATS)[number][0];

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const INVENTAIRES = [
  // Essuie-mains
  'rechargeEmAutocutInventaire',
  'EmFeuilleAFeuilleInventaire',
  'EmBobineTextileInventaire',
  'emRouleaux160m',

  // Savons
  'Savon400MlInventaire',
  'savonMousse1lInventaire',
  'SavonEcolab5lInventaire',
  'SavonKlintV2l',
  'Savon4l',
  'SavonAtelier2l',

  // Papiers hygiéniques
  'ph300mInventaire',
  'Ph60mInventaire',
  'ph22MInventaire',

  // Hygiène & Sanitaire
  'RechargeParfum',
  'GrillesUrinoir',
  'hygineFminineCitron',
] as const;
type InvKey = (typeof INVENTAIRES)[number];
type DueProduct = { name: string; key: string; inventaire: number | null };

export const updateInventoryValidated = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string().min(1), value: z.boolean() }))
  .handler(async ({ data }) => {
    await new InventairesConsommablesBoard().item(data.itemId).update({ inventaireValidOk: data.value }).execute();
    return { ok: true };
  });

export const validateInventory = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const board = new InventairesConsommablesBoard();
    const src = await board
      .item(data.itemId)
      .withColumns(['tableauCompletChantier', 'codeChantierFournisseur', 'familleDeProduits', ...INVENTAIRES])
      .execute();
    if (!src) throw new Error('Site introuvable');
    const rec = src as unknown as Record<string, unknown>;
    const quantities: Partial<Record<InvKey, number>> = {};
    for (const k of INVENTAIRES) {
      const v = rec[k];
      if (typeof v === 'number') quantities[k] = v;
    }
    const linked = src.tableauCompletChantier?.linkedItems ?? [];
    const [createdTopics, createdRealises] = await Promise.all([
      board
        .item()
        .create({
          name: src.name,
          codeChantierFournisseur: src.codeChantierFournisseur ?? null,
          familleDeProduits: src.familleDeProduits ?? [],
          dateInventaireActuel: new Date(),
          inventaireValidOk: false,
          ...(linked.length ? { tableauCompletChantier: { linkedItems: linked.map((l) => ({ id: l.id })) } } : {}),
          ...quantities,
        })
        .inGroup('topics')
        .execute(),
      board
        .item()
        .create({
          name: src.name,
          codeChantierFournisseur: src.codeChantierFournisseur ?? null,
          familleDeProduits: src.familleDeProduits ?? [],
          dateInventaireActuel: new Date(),
          inventaireValidOk: true,
          ...(linked.length ? { tableauCompletChantier: { linkedItems: linked.map((l) => ({ id: l.id })) } } : {}),
          ...quantities,
        })
        .inGroup('group_mm8adwxm')
        .execute(),
    ]);
    await board.item(data.itemId).archive().execute();
    return { ok: true, newId: createdRealises?.id ?? null };
  });

export const updateInventoryValue = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string().min(1), key: z.enum(INVENTAIRES), value: z.number().nullable() }))
  .handler(async ({ data }) => {
    const patch = { [data.key]: data.value } as Partial<Record<InvKey, number | null>>;
    await new InventairesConsommablesBoard().item(data.itemId).update(patch).execute();
    return { ok: true };
  });
type DueSite = { id: string; chantier: string; prochain: string | null; valide: boolean; products: DueProduct[] };

// [produit, colonne "À récupérer", colonne "Avenant"]
const ACTION_COLS = [
  // Essuie-mains
  ['EM autocut', 'emAutocutRcuprer', 's508EmAutocutAvenant'],
  ['Feuille à f.', 'emFeuilleAFeuilleRcuprer', 'emFeuilleAFeuilleAvenant'],
  ['Plus de bobine', 'emBobineTextileRcuprer', 'emBobineTextileAvenant'],
  ['EM rouleaux 160m', 'emRouleaux160mRcuprer', 'emRouleaux160mAvenant'],

  // Savons
  ['Savon 400 ML', 'savon400MlRcuprer', 'savon400MlAvenant'],
  ['Savon mousse 1L', 'savonMousse1lRcuprer', 'savonMousse1lAvenant'],
  ['Savon 5L', 'savonEcolab5lRcuprer', 'savonEcolab5lAvenant'],
  ['Savon KLINT V 2L', 'savonKlintV2lRcuprer', 'savonKlintV2lAvenant'],
  ['Savon 4L', 'savon4lRcuprer', 'savon4lAvenant'],
  ['Savon atelier 2L', 'savonAtelier2lRcuprer', 'savonAtelier2lAvenant'],

  // Papiers hygiéniques
  ['PH 300M', 'ph300mRcuprerAnimatrice', 'ph300mAvenantSamira'],
  ['PH 60M', 'ph60mRcuprer', 'ph60mAvenant'],
  ['PH 22 M', 'ph22MRcuprer', 'ph22MAvenant'],

  // Hygiène & Sanitaire
  ['Recharge parfum', 'rechargeParfumRcuprer', 'rechargeParfumAvenant'],
  ['Grilles urinoir', 'grillesUrinoirRcuprer', 'grillesUrinoirAvenant'],
  ['Hygiène féminine citron', 'hygineFminineCitronRcuprer', 'hygineFminineCitronAvenant'],
] as const;
type ActionKey = (typeof ACTION_COLS)[number][1] | ContratKey;
// Prix unitaires HT, dans le même ordre que ACTION_COLS
const PU_COLS = [
  // Essuie-mains
  'puHtEmAutocut',
  'puHtEmFeuilleAFeuille',
  'puHtEmBobineTextile',
  'puHtEmRouleaux160m',

  // Savons
  'puHtSavon400ml',
  'puHtSavonMousse1L',
  'puHtSavonEcolab5l',
  'puHtSavonKlintV2l',
  'puHtSavon4l',
  'puHtSavonAtelier2l',

  // Papiers hygiéniques
  'puHtPh300m',
  'puHt60m',
  'puHt22m',

  // Hygiène & Sanitaire
  'puHtRechargeParfum',
  'puHtGrilleUrinoir',
  'puHtHygineFminine',
] as const;
export type EcoSite = { 
  name: string; 
  directe: number; 
  contrat: number; 
  cumulDirecte?: number; 
  cumulContrat?: number; 
};
type EcoKey = 'dateInventaireActuel' | ContratKey | 'tableauCompletChantier'
  | (typeof ACTION_COLS)[number][1] | (typeof ACTION_COLS)[number][2] | (typeof PU_COLS)[number];
const isFilled = (v: string) => v !== '' && v !== 'null' && v !== '0';

export const getInventoryActions = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Row = { id: string; itemId: string; itemIds: string[]; chantier: string; type: 'À récupérer' | 'Avenant'; values: { name: string; value: string }[] };
    let columns: string[] = [];
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { count: 0, columns, rows: [] as Row[] };
    const chantiers = new TableauCompletChantierBoard();
    const ids: string[] = [];
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string }[]; cursor?: string | null } = await chantiers
        .items().withColumns(['animateur']).where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 }).execute();
      ids.push(...res.items.map((i) => i.id));
      c = res.cursor;
    } while (c);
    if (ids.length === 0) return { count: 0, columns, rows: [] as Row[] };

    const board = new InventairesConsommablesBoard();
    const rows: Row[] = [];
    const latest = new Map<string, { t: number; it: Record<string, unknown> }>();
    let cur: string | null | undefined = undefined;
    do {
      const res: {
        items: Array<{ id: string; name: string; dateInventaireActuel?: Date | string | null; tableauCompletChantier?: { linkedItems?: { id: string; name: string }[] } | null }>;
        cursor?: string | null;
      } = await board
        .items().withColumns(['tableauCompletChantier', 'dateInventaireActuel', 'rcuprationRalise', 'avenantRalis', ...([...ACTION_COLS.map(([, r]) => r), ...CONTRATS.map(([k]) => k), ...INVENTAIRES] as any[])])
        .where({ tableauCompletChantier: { itemIds: ids }, group: 'group_mm8adwxm' })
        .orderBy({ column: 'name', direction: 'asc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 }).execute();
      for (const it of res.items) {
        const link = it.tableauCompletChantier as { linkedItems?: { id: string }[] } | null | undefined;
        const siteNameNorm = String(it.name ?? '').replace(/^🆕\s*/i, '').trim().toLowerCase();
        const key = link?.linkedItems?.map((l) => l.id).join(',') || siteNameNorm || String(it.id);
        const raw = it.dateInventaireActuel;
        const createdRaw = (it as any).createdAt;
        const createdT = createdRaw ? new Date(createdRaw).getTime() : 0;
        const dateInvT = raw ? new Date(raw as string | Date).getTime() : 0;
        const t = createdT > 0 ? createdT : (Number.isNaN(dateInvT) ? 0 : dateInvT);
        const prev = latest.get(key);
        if (!prev) {
          latest.set(key, { t, it: it as unknown as Record<string, unknown> });
        } else if (t > prev.t) {
          prev.t = t;
          prev.it = it as unknown as Record<string, unknown>;
        }
      }
      cur = res.cursor;
    } while (cur);

    for (const { it } of latest.values()) {
      const rec = it as unknown as Record<string, unknown>;
      const link = rec.tableauCompletChantier as { linkedItems?: { name: string }[] } | null | undefined;
      const chantier = link?.linkedItems?.map((l) => l.name).join(', ') || String(rec.name ?? '').replace(/^🆕\s*/i, '');
      const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
      // Quantité (nb de mois) : À récupérer / (contrat annuel / 12)
      const rec_ = ACTION_COLS.map(([name, r], i) => {
        const raw = String(rec[r] ?? "").trim();
        const contratKey = CONTRATS[i]?.[0];
        const contrat = contratKey ? num((rec[contratKey] as { displayValue?: string | null } | null)?.displayValue) : 0;
        const invKey = INVENTAIRES[i];
        const inv = invKey ? num(rec[invKey]) : 0;
        const stockMini = contrat > 0 ? Math.max(1, Math.round((contrat / 12) * 2)) : 0;
        const recupMonday = num(raw);
        const recupFinal = recupMonday > 0 ? recupMonday : (stockMini > 0 && inv > stockMini ? Math.round(inv - stockMini) : 0);
        const mois = contrat > 0 && recupFinal > 0 ? Math.round((recupFinal * 12 / contrat) * 10) / 10 : null;
        const value = mois !== null ? `${recupFinal} (${mois.toLocaleString("fr-FR")} mois)` : String(recupFinal);
        return { name: `${name} - À récupérer`, value, recup: recupFinal };
      }).filter((v) => v.recup > 0).map(({ name, value }) => ({ name, value }));
      // Avenant calculé : min(À récupérer, 25 % du contrat arrondi à l'entier)
      const ave = ACTION_COLS.map(([name, r], i) => {
        const contratKey = CONTRATS[i]?.[0];
        const contrat = contratKey ? num((rec[contratKey] as { displayValue?: string | null } | null)?.displayValue) : 0;
        const invKey = INVENTAIRES[i];
        const inv = invKey ? num(rec[invKey]) : 0;
        const stockMini = contrat > 0 ? Math.max(1, Math.round((contrat / 12) * 2)) : 0;
        const recupMonday = num(rec[r]);
        const recupFinal = recupMonday > 0 ? recupMonday : (stockMini > 0 && inv > stockMini ? Math.round(inv - stockMini) : 0);
        const cap = Math.round(contrat * 0.25);
        const value = recupFinal > contrat * 0.25 ? cap : recupFinal;
        return { name: `${name} - Avenant`, value: String(value) };
      }).filter((v) => Number(v.value) > 0);
      const itId = String(rec.id);
      if (rec_.length && rec.rcuprationRalise !== true) rows.push({ id: `${itId}-r`, itemId: itId, itemIds: [itId], chantier, type: 'À récupérer', values: rec_ });
      if (ave.length && rec.avenantRalis !== true) rows.push({ id: `${itId}-a`, itemId: itId, itemIds: [itId], chantier, type: 'Avenant', values: ave });
    }
    // Par produit : À récupérer puis Avenant
    const all = ACTION_COLS.flatMap(([n]) => [`${n} - À récupérer`, `${n} - Avenant`]);
    columns = all.filter((n) => rows.some((r) => r.values.some((v) => v.name === n)));
    return { count: rows.length, columns, rows };
  });

export const getInventoryDue = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { count: 0, sites: [] as DueSite[], order: [] as string[] };
    const chantiers = new TableauCompletChantierBoard();
    const ids: string[] = [];
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string }[]; cursor?: string | null } = await chantiers
        .items().withColumns(['animateur']).where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 }).execute();
      ids.push(...res.items.map((i) => i.id));
      c = res.cursor;
    } while (c);
    if (ids.length === 0) return { count: 0, sites: [] as DueSite[], order: [] as string[] };

    const board = new InventairesConsommablesBoard();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sites: DueSite[] = [];
    const keys = [...CONTRATS.map(([k]) => k), ...INVENTAIRES] as (ContratKey | InvKey)[];
    let cur: string | null | undefined = undefined;
    do {
      const res: {
        items: Array<{ id: string; name: string; dateInventaireActuel?: Date | null; inventaireValidOk?: boolean | null; tableauCompletChantier?: { linkedItems?: { name: string }[] } | null }>;
        cursor?: string | null;
      } = await board
        .items().withColumns(['dateInventaireActuel', 'tableauCompletChantier', 'inventaireValidOk', ...keys])
        .where({ tableauCompletChantier: { itemIds: ids }, group: 'topics' })
        .orderBy({ column: 'name', direction: 'asc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 }).execute();
      for (const it of res.items) {
        const d0 = it.dateInventaireActuel ? new Date(it.dateInventaireActuel) : null;
        const d = d0 && !Number.isNaN(d0.getTime()) ? d0 : null;
        if (it.inventaireValidOk === true) continue;
        // Revient 182 jours après la date du dernier inventaire
        if (d && d.getTime() + 182 * 86400000 > today.getTime()) continue;
        const rec = it as unknown as Record<string, unknown>;
        const products: DueProduct[] = [];
        CONTRATS.forEach(([k, name], i) => {
          const v = (rec[k] as { displayValue?: string | null } | null)?.displayValue?.trim() ?? '';
          if (v === '' || v === 'null') return;
          products.push({ name, key: INVENTAIRES[i] ?? '', inventaire: null as number | null });
        });
        sites.push({
          id: it.id,
          chantier: it.tableauCompletChantier?.linkedItems?.map((l) => l.name).join(', ') || it.name,
          prochain: d ? d.toISOString() : null,
          valide: false,
          products,
        });
      }
      cur = res.cursor;
    } while (cur);
    return { count: sites.length, sites, order: CONTRATS.map(([, n]) => n as string) };
  });

export const getSitesCount = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { count: 0 };
    const ids: string[] = [];
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string }[]; cursor?: string | null } = await new TableauCompletChantierBoard()
        .items().withColumns(['animateur']).where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 }).execute();
      ids.push(...res.items.map((i) => i.id));
      c = res.cursor;
    } while (c);
    if (ids.length === 0) return { count: 0 };
    let count = 0;
    let cur: string | null | undefined = undefined;
    do {
      const res: { items: { id: string }[]; cursor?: string | null } = await new InventairesConsommablesBoard()
        .items().withColumns(['tableauCompletChantier'])
        .where({ tableauCompletChantier: { itemIds: ids }, group: 'topics' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 }).execute();
      count += res.items.length;
      cur = res.cursor;
    } while (cur);
    return { count };
  });

export const getInventory = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1), cursor: z.string().nullable().optional(), search: z.string().optional() }))
  .handler(async ({ data }) => {
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { items: [], cursor: null as string | null };

    const chantiers = new TableauCompletChantierBoard();
    const ids: string[] = [];
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string }[]; cursor?: string | null } = await chantiers
        .items()
        .withColumns(['animateur'])
        .where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 })
        .execute();
      ids.push(...res.items.map((i) => i.id));
      c = res.cursor;
    } while (c);

    if (ids.length === 0) return { items: [], cursor: null as string | null };

    const keys = CONTRATS.map(([k]) => k) as ContratKey[];
    const term = normalize(data.search ?? '');
    const board = new InventairesConsommablesBoard();
    const allRawItems: any[] = [];
    let cur: string | null | undefined = undefined;
    do {
      const page = await board
        .items()
        .withColumns(['dateInventaireActuel', 'fournisseur', 'tableauCompletChantier', ...keys])
        .where({ tableauCompletChantier: { itemIds: ids }, group: 'topics' })
        .orderBy({ column: 'name', direction: 'asc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();
      allRawItems.push(...page.items);
      cur = page.cursor;
    } while (cur);

    let filtered = allRawItems;
    if (term) {
      filtered = filtered.filter((it) =>
        normalize(it.tableauCompletChantier?.linkedItems?.map((l: any) => l.name).join(', ') || it.name).includes(term)
      );
    }

    const items = filtered.map((it) => {
      const rec = it as unknown as Record<string, { displayValue?: string | null } | null>;
      const contrats = CONTRATS.map(([k, name]) => ({ name, value: rec[k]?.displayValue?.trim() ?? '' }))
        .filter((x) => x.value !== '' && x.value !== 'null');
      const linked = it.tableauCompletChantier?.linkedItems;
      const chantierId = linked?.[0]?.id || String(it.id);
      return {
        id: it.id,
        chantierId,
        name: it.name,
        chantier: linked?.map((l: any) => l.name).join(', ') || it.name,
        fournisseur: it.fournisseur?.displayValue ?? null,
        dateInventaire: (() => { const x = it.dateInventaireActuel ? new Date(it.dateInventaireActuel) : null; return x && !Number.isNaN(x.getTime()) ? x.toISOString() : null; })(),
        contrats,
      };
    });
    return { items, cursor: null as string | null };
  });

/* ---------- Historique des inventaires réalisés d'un site & Anticipation 2027 ---------- */

export type HistoryProduct = {
  name: string;
  contrat: number;
  stockReel: number;
  stockMini: number;
  aRecuperer: number;
  moisConso: number | null;
  avenant: number;
};

export type HistoryEntry = {
  id: string;
  date: string | null;
  dateFormatted: string;
  year: number | null;
  recuperationRealisee: boolean;
  avenantRealise: boolean;
  products: HistoryProduct[];
  totalSurplus: number;
  totalStockReel: number;
  totalAvenant: number;
};

export type SiteHistoryResult = {
  history: HistoryEntry[];
  recommendation: string | null;
  trend: 'surstock' | 'equilibre' | 'sous-stock';
};

const toNum = (v: unknown) => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const mirrorNum = (v: unknown) => toNum((v as { displayValue?: string | null } | null)?.displayValue);

export function processSiteHistory(rawItems: any[]): SiteHistoryResult {
  // 1. Déduplication par date calendaire (YYYY-MM-DD)
  // Si plusieurs relevés ont la même date calendaire (tests ou double saisie le même jour), on ne garde que le plus récent (ID le plus élevé)
  const byDate = new Map<string, any>();
  for (const it of rawItems) {
    const rawDate = it.dateInventaireActuel;
    const d = rawDate ? new Date(rawDate as string | Date) : null;
    const dateKey = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : `item-${it.id}`;
    const existing = byDate.get(dateKey);
    if (!existing || Number(it.id) > Number(existing.id)) {
      byDate.set(dateKey, it);
    }
  }

  // 2. Tri du plus récent au plus ancien
  const sortedItems = Array.from(byDate.values()).sort((a, b) => {
    const da = a.dateInventaireActuel ? new Date(a.dateInventaireActuel).getTime() : 0;
    const db = b.dateInventaireActuel ? new Date(b.dateInventaireActuel).getTime() : 0;
    if (db !== da) return db - da;
    return Number(b.id) - Number(a.id);
  });

  const history: HistoryEntry[] = [];
  for (const it of sortedItems) {
    const rec = it as unknown as Record<string, unknown>;
    const rawDate = rec.dateInventaireActuel;
    const d = rawDate ? new Date(rawDate as string | Date) : null;
    const dateIso = d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    const dateFormatted = d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Date inconnue';
    const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;

    const prods: HistoryProduct[] = [];
    let totalSurplus = 0;
    let totalStockReel = 0;
    let totalAvenant = 0;

    CONTRATS.forEach(([k, name], i) => {
      const contrat = mirrorNum(rec[k]);
      const invKey = INVENTAIRES[i];
      const stockReel = invKey ? toNum(rec[invKey]) : 0;

      // Si contrat = 0 et stockReel = 0, le produit ne concerne pas ce site
      if (contrat === 0 && stockReel === 0) return;

      const stockMini = contrat > 0 ? Math.max(1, Math.round((contrat / 12) * 2)) : 0;
      const recupMonday = toNum(rec[ACTION_COLS[i]?.[1] ?? '']);
      const aRecuperer = recupMonday > 0 ? recupMonday : (stockMini > 0 && stockReel > stockMini ? Math.round(stockReel - stockMini) : 0);
      const mois = contrat > 0 && aRecuperer > 0 ? Math.round((aRecuperer * 12 / contrat) * 10) / 10 : null;
      const avenant = aRecuperer > contrat * 0.25 ? Math.round(contrat * 0.25) : aRecuperer;

      totalSurplus += aRecuperer;
      totalStockReel += stockReel;
      totalAvenant += avenant;

      prods.push({
        name,
        contrat,
        stockReel,
        stockMini,
        aRecuperer,
        moisConso: mois,
        avenant,
      });
    });

    if (prods.length > 0 || dateIso) {
      history.push({
        id: String(rec.id),
        date: dateIso,
        dateFormatted,
        year,
        recuperationRealisee: rec.rcuprationRalise === true,
        avenantRealise: rec.avenantRalis === true,
        products: prods,
        totalSurplus,
        totalStockReel,
        totalAvenant,
      });
    }
  }

  // 3. Calcul de la recommandation d'anticipation pour 2027
  let recommendation: string | null = null;
  let trend: 'surstock' | 'equilibre' | 'sous-stock' = 'equilibre';
  if (history.length > 0) {
    const avgSurplus = Math.round(history.reduce((s, h) => s + h.totalSurplus, 0) / history.length);
    const latestPassage = history[0];
    const surplusDernier = latestPassage.totalSurplus;

    if (surplusDernier > 0 || avgSurplus > 5) {
      trend = 'surstock';
      recommendation = `Surstock récurrent constaté (~${surplusDernier || avgSurplus} unités en excédent lors des relevés). Pour le contrat 2027, préconisation d'un réajustement à la baisse d'environ 15 à 25 % sur les références excédentaires pour assainir les réserves sans risquer de rupture.`;
    } else if (surplusDernier === 0 && avgSurplus === 0) {
      trend = 'equilibre';
      recommendation = `Consommation saine et fluide. Le stock tourne régulièrement sans surplus résiduel : contrat 2026 parfaitement calibré, à reconduire à l'identique pour 2027.`;
    } else {
      trend = 'equilibre';
      recommendation = `Stock résiduel minime. La dotation actuelle répond aux besoins du chantier.`;
    }
  }

  return { history, recommendation, trend };
}

export const getAllSitesHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { historyBySite: {} as Record<string, SiteHistoryResult> };

    const chantiers = new TableauCompletChantierBoard();
    const ids: string[] = [];
    const siteNames = new Set<string>();
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string; name: string }[]; cursor?: string | null } = await chantiers
        .items()
        .withColumns(['animateur'])
        .where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 })
        .execute();
      for (const it of res.items) {
        ids.push(it.id);
        if (it.name) siteNames.add(normalize(it.name));
      }
      c = res.cursor;
    } while (c);

    if (ids.length === 0) return { historyBySite: {} as Record<string, SiteHistoryResult> };

    const board = new InventairesConsommablesBoard();
    const keys = [
      'dateInventaireActuel',
      'rcuprationRalise',
      'avenantRalis',
      'tableauCompletChantier',
      ...CONTRATS.map(([k]) => k),
      ...INVENTAIRES,
      ...ACTION_COLS.map(([, r]) => r),
    ] as any[];

    const rawItemsByGroup = new Map<string, any[]>();
    const addToGroup = (key: string, item: any) => {
      if (!key) return;
      const arr = rawItemsByGroup.get(key) ?? [];
      arr.push(item);
      rawItemsByGroup.set(key, arr);
    };

    let cur: string | null | undefined = undefined;
    do {
      const res: { items: any[]; cursor?: string | null } = await board
        .items()
        .withColumns(keys)
        .where({ tableauCompletChantier: { itemIds: ids }, group: 'group_mm8adwxm' })
        .orderBy({ column: 'dateInventaireActuel', direction: 'desc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();

      for (const it of res.items) {
        const link = it.tableauCompletChantier as { linkedItems?: { id: string; name: string }[] } | null | undefined;
        const linkedIds = link?.linkedItems?.map((l) => String(l.id)) || [];
        const linkedNames = link?.linkedItems?.map((l) => normalize(l.name)) || [];
        const itNormName = normalize(it.name || '');

        linkedIds.forEach((id) => addToGroup(id, it));
        linkedNames.forEach((n) => addToGroup(n, it));
        if (itNormName) addToGroup(itNormName, it);
        addToGroup(String(it.id), it);
      }
      cur = res.cursor;
    } while (cur);

    const historyBySite: Record<string, SiteHistoryResult> = {};
    for (const [key, items] of rawItemsByGroup.entries()) {
      historyBySite[key] = processSiteHistory(items);
    }

    return { historyBySite };
  });

export const getSiteInventoryHistory = createServerFn({ method: 'GET' })
  .validator(z.object({
    chantierId: z.string().min(1),
    chantierName: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const board = new InventairesConsommablesBoard();
    const keys = [
      'dateInventaireActuel',
      'rcuprationRalise',
      'avenantRalis',
      'tableauCompletChantier',
      ...CONTRATS.map(([k]) => k),
      ...INVENTAIRES,
      ...ACTION_COLS.map(([, r]) => r),
    ] as any[];

    let cur: string | null | undefined = undefined;
    const rawItems: any[] = [];
    do {
      const page: any = await board
        .items()
        .withColumns(keys)
        .where({ tableauCompletChantier: { itemIds: [data.chantierId] }, group: 'group_mm8adwxm' })
        .orderBy({ column: 'dateInventaireActuel', direction: 'desc' })
        .withPagination(cur ? { limit: 250, cursor: cur } : { limit: 250 })
        .execute();
      rawItems.push(...page.items);
      cur = page.cursor;
    } while (cur);

    let items = rawItems;
    // Fallback par nom de chantier si besoin
    if (items.length === 0 && data.chantierName) {
      const normTarget = normalize(data.chantierName);
      let curFallback: string | null | undefined = undefined;
      do {
        const page: any = await board
          .items()
          .withColumns(keys)
          .where({ group: 'group_mm8adwxm' })
          .orderBy({ column: 'dateInventaireActuel', direction: 'desc' })
          .withPagination(curFallback ? { limit: 250, cursor: curFallback } : { limit: 250 })
          .execute();
        const matched = page.items.filter((it: any) => {
          const cName = it.tableauCompletChantier?.linkedItems?.map((l: any) => l.name).join(', ') || it.name;
          return normalize(cName).includes(normTarget) || normTarget.includes(normalize(cName));
        });
        items.push(...matched);
        curFallback = page.cursor;
      } while (curFallback && items.length === 0);
    }

    return processSiteHistory(items);
  });

export const markActionDone = createServerFn({ method: 'POST' })
  .validator(z.object({
    itemId: z.string().min(1),
    itemIds: z.array(z.string()).optional(),
    type: z.enum(['À récupérer', 'Avenant']),
    done: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const patch = data.type === 'Avenant' ? { avenantRalis: data.done } : { rcuprationRalise: data.done };
    const board = new InventairesConsommablesBoard();
    const ids = Array.from(new Set([data.itemId, ...(data.itemIds || [])]));
    await Promise.all(
      ids.map((id) =>
        board.item(id).update(patch).execute().catch((err) => {
          console.warn(`[markActionDone] Update skipped for item ${id}:`, err?.message || err);
        })
      )
    );
    return { ok: true };
  });

export const getEconomies = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) {
      return {
        cumulDirecte: 0,
        cumulDouzeMois: 0,
        dernierDirecte: 0,
        dernierDouzeMois: 0,
        directe: 0,
        douzeMois: 0,
        year: new Date().getFullYear(),
        passagesCount: 0,
        sitesDernier: [] as EcoSite[],
        sitesCumul: [] as EcoSite[],
        sites: [] as EcoSite[],
      };
    }

    const chantiers = new TableauCompletChantierBoard();
    const ids: string[] = [];
    const siteNames = new Set<string>();
    let c: string | null | undefined = undefined;
    do {
      const res: { items: { id: string; name: string }[]; cursor?: string | null } = await chantiers
        .items()
        .withColumns(['animateur'])
        .where({ animateur: label })
        .withPagination(c ? { limit: 500, cursor: c } : { limit: 500 })
        .execute();
      for (const it of res.items) {
        ids.push(it.id);
        if (it.name) siteNames.add(normalize(it.name));
      }
      c = res.cursor;
    } while (c);

    if (ids.length === 0) {
      return {
        cumulDirecte: 0,
        cumulDouzeMois: 0,
        dernierDirecte: 0,
        dernierDouzeMois: 0,
        directe: 0,
        douzeMois: 0,
        year: new Date().getFullYear(),
        passagesCount: 0,
        sitesDernier: [] as EcoSite[],
        sitesCumul: [] as EcoSite[],
        sites: [] as EcoSite[],
      };
    }

    const ecoKeys = [
      'tableauCompletChantier',
      'dateInventaireActuel',
      'economieDirecte',
      'economie12Mois',
      ...ACTION_COLS.map(([, r]) => r),
      ...PU_COLS,
      ...CONTRATS.map(([k]) => k),
      ...INVENTAIRES,
    ] as any[];

    // Récupération de tous les inventaires réalisés
    const allRealises: any[] = [];
    let cur: string | null | undefined = undefined;
    do {
      const res: { items: Array<Record<string, unknown>>; cursor?: string | null } = await new InventairesConsommablesBoard()
        .items()
        .withColumns(ecoKeys)
        .where({ group: 'group_mm8adwxm' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute() as unknown as { items: Array<Record<string, unknown>>; cursor?: string | null };
      allRealises.push(...res.items);
      cur = res.cursor;
    } while (cur);

    // Filtrer les inventaires appartenant aux chantiers de l'animatrice
    const matchedItems: any[] = [];
    for (const it of allRealises) {
      const link = it.tableauCompletChantier as { linkedItems?: { id: string; name: string }[] } | null | undefined;
      const linkedIds = link?.linkedItems?.map((l) => String(l.id)) || [];
      const linkedNames = link?.linkedItems?.map((l) => normalize(l.name)) || [];
      const itNormName = normalize(String(it.name ?? '').replace(/^🆕\s*/i, ''));

      const belongs =
        linkedIds.some((id) => ids.includes(id)) ||
        linkedNames.some((n) => siteNames.has(n)) ||
        siteNames.has(itNormName) ||
        Array.from(siteNames).some((sn) => (itNormName && sn.includes(itNormName)) || (itNormName && itNormName.includes(sn)));

      if (belongs) {
        matchedItems.push(it);
      }
    }

    // Dédupliquer par date calendaire pour un même site (évite les doublons lors des tests ou double validation)
    const bySiteAndDate = new Map<string, any>();
    for (const it of matchedItems) {
      const link = it.tableauCompletChantier as { linkedItems?: { id: string; name: string }[] } | null | undefined;
      const siteKey = link?.linkedItems?.[0]?.id || normalize(String(it.name ?? '').replace(/^🆕\s*/i, '')) || String(it.id);
      const raw = it.dateInventaireActuel;
      const createdRaw = (it as any).createdAt;
      const d = raw ? new Date(raw as string | Date) : (createdRaw ? new Date(createdRaw) : null);
      const dateKey = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : `item-${it.id}`;
      const uniqueKey = `${siteKey}_${dateKey}`;
      const existing = bySiteAndDate.get(uniqueKey);
      if (!existing || Number(it.id) > Number(existing.id)) {
        bySiteAndDate.set(uniqueKey, it);
      }
    }

    const uniquePassages = Array.from(bySiteAndDate.values());
    const currentYear = new Date().getFullYear();

    // 1. Calcul du DERNIER inventaire de chaque site (situation instantanée)
    const latestBySite = new Map<string, { t: number; name: string; directe: number; contrat: number }>();

    // 2. Calcul du CUMUL annuel (somme de tous les passages de l'année en cours)
    let cumulDirecte = 0;
    let cumulDouzeMois = 0;
    const cumulBySite = new Map<string, { name: string; directe: number; contrat: number }>();
    const passagesInYear: any[] = [];

    for (const it of uniquePassages) {
      const rec = it as unknown as Record<string, unknown>;
      const link = rec.tableauCompletChantier as { linkedItems?: { id: string; name: string }[] } | null | undefined;
      const siteKey = link?.linkedItems?.[0]?.id || normalize(String(rec.name ?? '').replace(/^🆕\s*/i, '')) || String(rec.id);
      const siteName = link?.linkedItems?.[0]?.name || String(rec.name ?? '').replace(/^🆕\s*/i, '').trim();

      const raw = rec.dateInventaireActuel;
      const createdRaw = (rec as any).createdAt;
      const createdT = createdRaw ? new Date(createdRaw).getTime() : 0;
      const d = raw ? new Date(raw as string | Date) : (createdRaw ? new Date(createdRaw) : null);
      const dateInvT = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
      const t = createdT > 0 ? createdT : dateInvT;
      const itemYear = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : currentYear;

      // On prend en priorité directe les formules calculées par Monday sur la ligne
      const mondayDirecte = toNum(rec.economieDirecte);
      const mondayContrat = toNum(rec.economie12Mois);

      // Vrais prix unitaires de Monday (colonne miroir PU HT) — 0 si vide ou inconnu (ex: PLG)
      const pu = (i: number) => mirrorNum(rec[PU_COLS[i] ?? '']);

      const getRecup = (i: number) => {
        const recupMonday = toNum(rec[ACTION_COLS[i][1]]);
        if (recupMonday > 0) return recupMonday;
        const contrat = mirrorNum(rec[CONTRATS[i]?.[0] ?? '']);
        const inv = toNum(rec[INVENTAIRES[i] ?? '']);
        const stockMini = contrat > 0 ? Math.max(1, Math.round((contrat / 12) * 2)) : 0;
        return stockMini > 0 && inv > stockMini ? Math.round(inv - stockMini) : 0;
      };

      // Économie directe = Σ (À récupérer × PU HT réel Monday)
      const sumDirecte = () => ACTION_COLS.reduce((s, _, i) => s + getRecup(i) * pu(i), 0);
      // Économie contrat = Σ (avenant calculé × PU HT réel Monday)
      const sumContrat = () => ACTION_COLS.reduce((s, _, i) => {
        const recup = getRecup(i);
        const contrat = mirrorNum(rec[CONTRATS[i]?.[0] ?? '']);
        const avenant = recup > contrat * 0.25 ? Math.round(contrat * 0.25) : recup;
        return s + avenant * pu(i);
      }, 0);

      // Valeur réelle : colonne Monday si présente, sinon calcul avec les vrais PU Monday
      const d1 = mondayDirecte > 0 ? mondayDirecte : sumDirecte();
      const d2 = mondayContrat > 0 ? mondayContrat : sumContrat();

      // Gestion du dernier relevé par site
      const prev = latestBySite.get(siteKey);
      if (!prev || t > prev.t) {
        latestBySite.set(siteKey, { t, name: siteName, directe: d1, contrat: d2 });
      }

      // Gestion du cumul annuel (année courante, ou tous si aucun passage de l'année)
      if (itemYear === currentYear || uniquePassages.every((p) => {
        const pDate = p.dateInventaireActuel ? new Date(p.dateInventaireActuel) : null;
        return !pDate || pDate.getFullYear() !== currentYear;
      })) {
        passagesInYear.push(it);
        cumulDirecte += d1;
        cumulDouzeMois += d2;

        const prevCumul = cumulBySite.get(siteKey) || { name: siteName, directe: 0, contrat: 0 };
        prevCumul.directe += d1;
        prevCumul.contrat += d2;
        cumulBySite.set(siteKey, prevCumul);
      }
    }

    // Calculs totaux situation actuelle (dernier relevé)
    let dernierDirecte = 0;
    let dernierDouzeMois = 0;
    const sitesDernier: EcoSite[] = [];
    for (const item of latestBySite.values()) {
      dernierDirecte += item.directe;
      dernierDouzeMois += item.contrat;
      sitesDernier.push({
        name: item.name,
        directe: Math.round(item.directe * 100) / 100,
        contrat: Math.round(item.contrat * 100) / 100,
      });
    }

    const sitesCumul: EcoSite[] = Array.from(cumulBySite.values()).map((s) => ({
      name: s.name,
      directe: Math.round(s.directe * 100) / 100,
      contrat: Math.round(s.contrat * 100) / 100,
    }));

    return {
      cumulDirecte: Math.round(cumulDirecte * 100) / 100,
      cumulDouzeMois: Math.round(cumulDouzeMois * 100) / 100,
      dernierDirecte: Math.round(dernierDirecte * 100) / 100,
      dernierDouzeMois: Math.round(dernierDouzeMois * 100) / 100,
      directe: Math.round((cumulDirecte > 0 ? cumulDirecte : dernierDirecte) * 100) / 100,
      douzeMois: Math.round((cumulDouzeMois > 0 ? cumulDouzeMois : dernierDouzeMois) * 100) / 100,
      year: currentYear,
      passagesCount: passagesInYear.length,
      sitesDernier,
      sitesCumul,
      sites: sitesCumul.length > 0 ? sitesCumul : sitesDernier,
    };
  });
