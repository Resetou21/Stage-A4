import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';
import { TableauCompletChantierBoard, VisitesClientsBoard, InventairesConsommablesBoard, callMondayApi } from '@api/BoardSDK';
import { BOARD_IDS } from '@api/columnMap';

function labelOf(name: string): string | null {
  const norm = name.toLowerCase().trim();
  if (norm.includes('natacha')) return 'Natacha THOMAS';
  if (norm.includes('ketty')) return 'Ketty PAULIN';
  if (norm.includes('emilie') || norm.includes('émilie')) return 'Emilie TOBIE';
  if (norm.includes('andre') || norm.includes('andré')) return 'Andre LEVESQUE';
  return null;
}

const BON = 'Globalement bon';

/**
 * Vérifie si une valeur de clé correspond à une vraie clé / badge / code d'accès,
 * et filtre les faux positifs textuels comme "Pas de clé", "Sans clé", "0", "-", etc.
 */
export function hasRealKey(cle: string | null | undefined): boolean {
  if (!cle) return false;
  const s = cle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents (clé -> cle)
    .trim();

  if (
    !s ||
    s === '-' ||
    s === '--' ||
    s === '/' ||
    s === '0' ||
    s === '00' ||
    s === 'non' ||
    s === 'aucun' ||
    s === 'aucune' ||
    s === 'rien' ||
    s === 'na' ||
    s === 'n/a' ||
    s === 'none' ||
    s === 'non renseigne' ||
    s.includes('pas de cle') ||
    s.includes('sans cle') ||
    s.includes('aucune cle') ||
    s.includes('pas cle')
  ) {
    return false;
  }
  return true;
}

export const ANIMATEURS_OPTIONS = [
  'Natacha THOMAS',
  'Ketty PAULIN',
  'Emilie TOBIE',
] as const;

export type AnimateurName = (typeof ANIMATEURS_OPTIONS)[number];

export const DEFAULT_VILLES_OPTIONS = [
  'BESNE',
  'BOUGUENAIS',
  'CAMPBON',
  'CHAUMES-EN-RETZ',
  'DONGES',
  'GUERANDE',
  'HERBIGNAC',
  'LA BAULE',
  'LA BERNERIE EN RETZ',
  'LA CHAPELLE DES MARAIS',
  'LE POULIGUEN',
  'MONTOIR DE BRETAGNE',
  'NANTES',
  'NANTES CEDEX',
  'PAIMBOEUF',
  'PONTCHATEAU',
  'PORNIC',
  'PORNICHET',
  'PRINQUIAU',
  'REZE',
  'SAINT ANDRE DES EAUX',
  'SAINT BREVIN LES PINS',
  'SAINT JOACHIM',
  'SAINT-MICHEL-CHEF-CHEF',
  'SAINT-NAZAIRE',
  'SAINT-NAZAIRE CEDEX',
  'SAINTE PAZANNE',
  'SAINTE REINE DE BRETAGNE',
  'TRIGNAC',
] as const;

export const DEFAULT_ACTIVITES_OPTIONS = [
  'PARTIES COMMUNES',
  'TERTIAIRE',
  'BUREAUX',
  'CABINET MEDICAL',
  'COMMERCE / RETAIL',
  'ECOLE / CRECHE',
  'INDUSTRIE',
  'LOGISTIQUE',
  'RESTAURATION',
  'SYNDIC',
] as const;

export async function fetchStatusColumnLabels(): Promise<{ villes: string[]; activites: string[] }> {
  try {
    const query = `
      query GetStatusColumnsLabels($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns(ids: ["color_mkrb1yqe", "color_mm0v1k6a"]) {
            id
            settings_str
          }
        }
      }
    `;
    const res: any = await callMondayApi(query, {
      variables: { boardId: [BOARD_IDS.TABLEAU_COMPLET_CHANTIER] },
    });

    const cols = res?.data?.boards?.[0]?.columns || res?.boards?.[0]?.columns || [];
    let villesFromMonday: string[] = [];
    let activitesFromMonday: string[] = [];

    for (const col of cols) {
      if (!col.settings_str) continue;
      try {
        const parsed = JSON.parse(col.settings_str);
        const labelsObj = parsed.labels || {};
        const labels = Object.values(labelsObj)
          .map((v: any) => String(v || '').trim())
          .filter(Boolean);

        if (col.id === 'color_mkrb1yqe') {
          villesFromMonday = labels;
        } else if (col.id === 'color_mm0v1k6a') {
          activitesFromMonday = labels;
        }
      } catch (e) {
        console.warn('Erreur parsing settings_str:', col.id, e);
      }
    }

    const allVilles = Array.from(new Set([...DEFAULT_VILLES_OPTIONS, ...villesFromMonday]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'));

    const allActivites = Array.from(new Set([...DEFAULT_ACTIVITES_OPTIONS, ...activitesFromMonday]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'));

    return {
      villes: allVilles,
      activites: allActivites,
    };
  } catch (err) {
    console.warn('[fetchStatusColumnLabels fallback]:', err);
    return {
      villes: [...DEFAULT_VILLES_OPTIONS],
      activites: [...DEFAULT_ACTIVITES_OPTIONS],
    };
  }
}

export interface ChantierItem {
  id: string;
  name: string;
  animateur: string | null;
  code: string | null;
  adresse: string | null;
  codePostal: number | null;
  ville: string | null;
  interlocuteur: string | null;
  telephone: string | null;
  email: string | null;
  cle: string | null;
  doubleCle: string | null;
  keycafe: string | null;
  cahierLiaison: string | null;
  c1: string | null;
  c2: string | null;
  c3: string | null;
  dernierControle: string | null;
  resultatDernierControle: string | null;
  stars: '3🌟' | '2🌟' | '1🌟' | '🙁' | null;
  heuresMois: number | null;
  activite: string | null;
  sensible: boolean;
  groupId: string;
  groupTitle: string;
  // Suivi des visites sur les 12 derniers mois (fusion calendrier passé + visites en cours)
  calExtractDates?: string | null;
  visites12MoisCount: number;
  visites12MoisDates: string[];
  totalVisitesHistoriqueCount: number;
}

interface ChantiersListCache {
  timestamp: number;
  data: ChantierItem[];
}
const chantiersListCache = new Map<string, ChantiersListCache>();
const inFlightChantiersList = new Map<string, Promise<ChantierItem[]>>();

export function clearChantiersListCache() {
  chantiersListCache.clear();
}

export async function getChantiersList({ data }: { data: { firstName: string } }): Promise<ChantierItem[]> {
  const k = data.firstName.toLowerCase();
  const cached = chantiersListCache.get(k);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }
  const inFlight = inFlightChantiersList.get(k);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const label = labelOf(data.firstName);
    if (!label) return [];

    const board = new TableauCompletChantierBoard();
    const res: ChantierItem[] = [];
    let cur: string | null | undefined = undefined;

    // Calcul de la période des 12 derniers mois
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Requête parallèle pour récupérer les visites enregistrées des 12 derniers mois (avec pagination complète et tri décroissant)
    const pVisits = (async () => {
      try {
        const map = new Map<string, string[]>();
        let vCursor: string | null = null;
        let pagesCount = 0;
        const maxPages = 5; // Au maximum 2500 visites (largement suffisant pour 12 mois)

        do {
          pagesCount++;
          const qInitial = `
            query GetVisits12M {
              boards(ids: [1977798116]) {
                items_page(limit: 500, query_params: {
                  order_by: [{ column_id: "date_mkrcgy18", direction: desc }],
                  rules: [
                    { column_id: "date_mkrcgy18", compare_value: ["${twelveMonthsAgo}"], operator: greater_than_or_equals }
                  ]
                }) {
                  cursor
                  items {
                    date: column_values(ids: ["date_mkrcgy18"]) { text }
                    ch: column_values(ids: ["board_relation_mktd1vha"]) { ... on BoardRelationValue { linked_item_ids display_value } }
                  }
                }
              }
            }
          `;
          const qWithCursor = `
            query GetVisits12MCursor($cursor: String!) {
              boards(ids: [1977798116]) {
                items_page(limit: 500, cursor: $cursor) {
                  cursor
                  items {
                    date: column_values(ids: ["date_mkrcgy18"]) { text }
                    ch: column_values(ids: ["board_relation_mktd1vha"]) { ... on BoardRelationValue { linked_item_ids display_value } }
                  }
                }
              }
            }
          `;

          const resV: any = vCursor
            ? await callMondayApi(qWithCursor, { variables: { cursor: vCursor } })
            : await callMondayApi(qInitial);

          const page = resV?.data?.boards?.[0]?.items_page || resV?.boards?.[0]?.items_page;
          const vItems = page?.items || [];
          for (const v of vItems) {
            const dt = v.date?.[0]?.text;
            const linkedIds = v.ch?.[0]?.linked_item_ids || [];
            if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) {
              for (const id of linkedIds) {
                const sid = String(id);
                if (!map.has(sid)) map.set(sid, []);
                map.get(sid)!.push(dt);
              }
            }
          }
          vCursor = page?.cursor || null;
        } while (vCursor && pagesCount < maxPages);

        return map;
      } catch (err) {
        console.warn('[getChantiersList] Warning fetching visits:', err);
        return new Map<string, string[]>();
      }
    })();

    const cols = [
      'animateur',
      'codeChantier',
      'adresse',
      'codePostal',
      'ville',
      'interlocuteur',
      'telephone',
      'email',
      'cle',
      'doubleCle',
      'keycafe',
      'cahierLiaison',
      'c1',
      'c2',
      'c3',
      'dernierContrle',
      'dernierContrle1',
      'rsultatDernierContrle',
      'column3',
      'column2',
      'column1',
      'column',
      'heuresMois',
      'activite',
      'sensible',
      'calExtractDates',
    ];

    // Attente simultanée des visites
    const visitsMap = await pVisits;

  do {
    const page: any = await board
      .items()
      .withColumns(cols)
      .where({ animateur: label, group: 'topics' })
      .orderBy({ column: 'name', direction: 'asc' })
      .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
      .execute();

    for (const it of page.items) {
      // Détermination des étoiles
      const f = [it.column3, it.column2, it.column1, it.column].map((v: any) =>
        v === null || v === undefined || String(v).trim() === '' ? null : Number(String(v).replace(',', '.'))
      );
      let stars: '3🌟' | '2🌟' | '1🌟' | '🙁' | null = null;
      if (f.some((v) => v !== null)) {
        if (f[0] === 1) stars = '3🌟';
        else if (f[1] === 1) stars = '2🌟';
        else if (f[2] === 1) stars = '1🌟';
        else if (f[3] === 1) stars = '🙁';
      } else {
        const c1Bon = it.c1 === BON;
        const c2Bon = it.c2 === BON;
        const c3Bon = it.c3 === BON;
        if (c1Bon && c2Bon && c3Bon) stars = '3🌟';
        else if (c1Bon && c2Bon) stars = '2🌟';
        else if (c1Bon) stars = '1🌟';
        else if (it.c1 === 'Bases non respectées' || it.c1 === "Plan d'action urgent") stars = '🙁';
      }

      const rawDate = it.dernierContrle ?? it.dernierContrle1 ?? null;
      const d = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;

      const toStr = (v: any) => {
        if (!v) return null;
        if (Array.isArray(v)) return v.filter(Boolean).join(', ') || null;
        return String(v).trim() || null;
      };

      // Fusion des visites : Ancien calendrier ("ce qu'elle avait avant") + Visites Monday ("ce qu'on a fait")
      const rawCal = toStr(it.calExtractDates) || '';
      const calDates = rawCal
        ? rawCal
            .split(/[,;/]|\r?\n/)
            .map((s) => s.trim())
            .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
        : [];

      const relDates = visitsMap.get(String(it.id)) || [];
      const allDatesSet = new Set<string>([...calDates, ...relDates]);
      if (d) {
        allDatesSet.add(d.toISOString().slice(0, 10));
      }

      const allDates = Array.from(allDatesSet).sort((a, b) => b.localeCompare(a));
      const visites12MoisDates = allDates.filter((dateStr) => dateStr >= twelveMonthsAgo && dateStr <= today);
      const visites12MoisCount = visites12MoisDates.length;
      const totalVisitesHistoriqueCount = allDates.length;

      res.push({
        id: String(it.id),
        name: String(it.name || '').trim(),
        animateur: toStr(it.animateur) || label,
        code: toStr(it.codeChantier),
        adresse: toStr(it.adresse),
        codePostal: typeof it.codePostal === 'number' ? it.codePostal : null,
        ville: toStr(it.ville),
        interlocuteur: toStr(it.interlocuteur),
        telephone: toStr(it.telephone),
        email: toStr(it.email),
        cle: toStr(it.cle),
        doubleCle: toStr(it.doubleCle),
        keycafe: toStr(it.keycafe),
        cahierLiaison: toStr(it.cahierLiaison),
        c1: toStr(it.c1),
        c2: toStr(it.c2),
        c3: toStr(it.c3),
        dernierControle: d ? d.toISOString().slice(0, 10) : null,
        resultatDernierControle: toStr(it.rsultatDernierContrle ?? it.c1),
        stars,
        heuresMois: typeof it.heuresMois === 'number' ? it.heuresMois : null,
        activite: toStr(it.activite),
        sensible: Boolean(it.sensible),
        groupId: it.group?.id || 'topics',
        groupTitle: it.group?.title || 'Chantiers en cours',
        calExtractDates: rawCal || null,
        visites12MoisCount,
        visites12MoisDates,
        totalVisitesHistoriqueCount,
      });
    }

    cur = page.cursor;
  } while (cur);

  // Fallback si Tableau complet chantier est bloqué sur mobile/tablette (board privé dans un autre workspace)
  if (res.length === 0) {
    try {
      const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const target = norm(label);
      const chMap = new Map<string, { id: string; name: string; lastDate?: string; qual?: string }>();

      // 1. Depuis Visites clients
      const vBoard = new VisitesClientsBoard();
      let vCur: string | null | undefined = undefined;
      do {
        const vPage: any = await vBoard
          .items()
          .withColumns(['dateVisiteClient', 'qualitDeLaPrestation', 'nomChantier', 'animateur', 'animatriceDirect'])
          .orderBy({ column: 'dateVisiteClient', direction: 'desc' })
          .withPagination(vCur ? { limit: 500, cursor: vCur } : { limit: 500 })
          .execute();

        for (const it of vPage.items || []) {
          const rawDisp = (it.animateur?.displayValue ?? '').trim();
          const names = rawDisp ? rawDisp.split(',').map(norm) : [];
          const matchByMirror = names.includes(target);

          const creatorName = (it.creator?.name || '').toLowerCase();
          const creatorEmail = (it.creator?.email || '').toLowerCase();
          const creatorId = String(it.creator?.id || '');

          const isTargetCreator =
            (target.includes('emilie') && (creatorId === '87318933' || creatorEmail.includes('etobie') || creatorName.includes('emilie') || creatorName.includes('émilie'))) ||
            (target.includes('ketty') && (creatorId === '76526955' || creatorEmail.includes('kpaulin') || creatorName.includes('ketty'))) ||
            (target.includes('natacha') && (creatorId === '87318941' || creatorEmail.includes('nthomas') || creatorName.includes('natacha'))) ||
            (target.includes('andre') && (creatorName.includes('andre') || creatorName.includes('andré')));

          const colAnim = it.animatriceDirect ? norm(String(it.animatriceDirect)) : '';
          const matchByColAnim = colAnim ? (colAnim.includes(target) || target.includes(colAnim)) : false;

          if (rawDisp) {
            if (!matchByMirror) continue;
          } else {
            if (!isTargetCreator && !matchByColAnim) continue;
          }

          const linked = it.nomChantier?.linkedItems || [];
          for (const l of linked) {
            const chId = String(l.id);
            const chName = String(l.name || '').trim();
            if (!chId || !chName) continue;
            if (!chMap.has(chId)) {
              const dt = it.dateVisiteClient instanceof Date ? it.dateVisiteClient.toISOString().slice(0, 10) : String(it.dateVisiteClient || '');
              chMap.set(chId, {
                id: chId,
                name: chName,
                lastDate: dt || undefined,
                qual: it.qualitDeLaPrestation || undefined,
              });
            }
          }
        }
        vCur = vPage.cursor;
      } while (vCur);

      // 2. Depuis Inventaires consommables
      const invBoard = new InventairesConsommablesBoard();
      let invCur: string | null | undefined = undefined;
      do {
        const invPage: any = await invBoard
          .items()
          .withColumns(['tableauCompletChantier', 'animateur'])
          .where({ animateur: label })
          .withPagination(invCur ? { limit: 500, cursor: invCur } : { limit: 500 })
          .execute();

        for (const it of invPage.items || []) {
          const linked = it.tableauCompletChantier?.linkedItems || [];
          for (const l of linked) {
            const chId = String(l.id);
            const chName = String(l.name || '').trim();
            if (!chId || !chName) continue;
            if (!chMap.has(chId)) {
              chMap.set(chId, { id: chId, name: chName });
            }
          }
        }
        invCur = invPage.cursor;
      } while (invCur);

      for (const [id, c] of chMap.entries()) {
        res.push({
          id,
          name: c.name,
          animateur: label,
          code: null,
          adresse: null,
          codePostal: null,
          ville: null,
          interlocuteur: null,
          telephone: null,
          email: null,
          cle: null,
          doubleCle: null,
          keycafe: null,
          cahierLiaison: null,
          c1: c.qual || null,
          c2: null,
          c3: null,
          dernierControle: c.lastDate || null,
          resultatDernierControle: c.qual || null,
          stars: c.qual === 'Globalement bon' ? '1🌟' : c.qual ? '🙁' : null,
          heuresMois: null,
          activite: null,
          sensible: false,
          groupId: 'topics',
          groupTitle: 'Chantiers en cours',
          calExtractDates: null,
          visites12MoisCount: c.lastDate ? 1 : 0,
          visites12MoisDates: c.lastDate ? [c.lastDate] : [],
          totalVisitesHistoriqueCount: c.lastDate ? 1 : 0,
        });
      }
      res.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } catch (e) {
      console.warn('[getChantiersList fallback error]:', e);
    }
  }

    chantiersListCache.set(k, { timestamp: Date.now(), data: res });
    return res;
  })();

  inFlightChantiersList.set(k, promise);
  try {
    return await promise;
  } finally {
    inFlightChantiersList.delete(k);
  }
}

export interface UpdateChantierPayload {
  itemId: string;
  name?: string;
  animateur?: string;
  code?: string;
  adresse?: string;
  codePostal?: number | null;
  ville?: string;
  interlocuteur?: string;
  telephone?: string;
  email?: string;
  cle?: string;
  doubleCle?: string;
  keycafe?: string;
  cahierLiaison?: string;
  heuresMois?: number | null;
  activite?: string;
  sensible?: boolean;
}

export async function updateChantierDetails(payload: UpdateChantierPayload): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  try {
    const { itemId, name, interlocuteur, telephone, email, ...standardFields } = payload;
    if (!itemId) throw new Error('itemId manquant');

    const warnings: string[] = [];

    // 1. Mise à jour des colonnes standards (Statuts, Textes, Nombres, Checkboxes)
    const standardPatch: Record<string, any> = {};
    if (name !== undefined) standardPatch.name = name;
    if (standardFields.animateur !== undefined) standardPatch.animateur = standardFields.animateur;
    if (standardFields.code !== undefined) standardPatch.codeChantier = standardFields.code;
    if (standardFields.adresse !== undefined) standardPatch.adresse = standardFields.adresse;
    if (standardFields.codePostal !== undefined) standardPatch.codePostal = standardFields.codePostal;
    if (standardFields.ville !== undefined) standardPatch.ville = standardFields.ville;
    if (standardFields.cle !== undefined) standardPatch.cle = standardFields.cle;
    if (standardFields.doubleCle !== undefined) standardPatch.doubleCle = standardFields.doubleCle;
    if (standardFields.keycafe !== undefined) standardPatch.keycafe = standardFields.keycafe;
    if (standardFields.cahierLiaison !== undefined) standardPatch.cahierLiaison = standardFields.cahierLiaison;
    if (standardFields.heuresMois !== undefined) standardPatch.heuresMois = standardFields.heuresMois;
    if (standardFields.activite !== undefined) standardPatch.activite = standardFields.activite;
    if (standardFields.sensible !== undefined) standardPatch.sensible = standardFields.sensible;

    if (Object.keys(standardPatch).length > 0) {
      const board = new TableauCompletChantierBoard();
      await board.item(itemId).update(standardPatch).execute();
    }

    // 2. Traitement des colonnes Dropdown (Téléphone, Interlocuteur, Email) avec isolation
    const dropdownCols: Array<{ key: string; colId: string; val: string | undefined; label: string }> = [
      { key: 'telephone', colId: 'dropdown_mkrbfhrg', val: telephone, label: 'téléphone' },
      { key: 'interlocuteur', colId: 'dropdown_mkrb9ma', val: interlocuteur, label: 'interlocuteur' },
      { key: 'email', colId: 'dropdown_mkrbwbya', val: email, label: 'email' },
    ];

    for (const item of dropdownCols) {
      if (item.val === undefined) continue;

      const boardId = TableauCompletChantierBoard.boardId;
      const cleanVal = item.val.trim();

      try {
        // Tentative 1 : change_simple_column_value avec create_labels_if_missing
        const simpleMutation = `
          mutation UpdateDropdownSimple($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
            change_simple_column_value(
              board_id: $boardId,
              item_id: $itemId,
              column_id: $columnId,
              value: $value,
              create_labels_if_missing: true
            ) {
              id
            }
          }
        `;
        const resSimple = await callMondayApi(simpleMutation, {
          variables: {
            boardId,
            itemId,
            columnId: item.colId,
            value: cleanVal,
          },
        });

        if (!resSimple?.errors || resSimple.errors.length === 0) {
          continue;
        }

        // Tentative 2 : change_multiple_column_values avec create_labels_if_missing
        const labelsList = cleanVal
          ? cleanVal.split(/[,;/]|\r?\n/).map((s) => s.trim()).filter(Boolean)
          : [];

        const multiMutation = `
          mutation UpdateDropdownMulti($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
            change_multiple_column_values(
              board_id: $boardId,
              item_id: $itemId,
              column_values: $columnValues,
              create_labels_if_missing: true
            ) {
              id
            }
          }
        `;
        const resMulti = await callMondayApi(multiMutation, {
          variables: {
            boardId,
            itemId,
            columnValues: JSON.stringify({
              [item.colId]: labelsList.length > 0 ? { labels: labelsList } : { labels: [] },
            }),
          },
        });

        if (resMulti?.errors && resMulti.errors.length > 0) {
          const msg = resMulti.errors[0]?.message || '';
          console.warn(`[updateChantierDetails] Dropdown ${item.label} non créé :`, msg);
          warnings.push(`Le champ ${item.label} ("${cleanVal}") n'a pas pu être ajouté aux étiquettes du menu déroulant Monday (droits requis).`);
        }
      } catch (err: any) {
        console.warn(`[updateChantierDetails] Dropdown ${item.label} exception :`, err);
        warnings.push(`Le champ ${item.label} n'a pas pu être enregistré dans les options déroulantes Monday.`);
      }
    }

    clearChantiersListCache();
    return { 
      success: true, 
      warnings: warnings.length > 0 ? warnings : undefined 
    };
  } catch (err: any) {
    console.error('[updateChantierDetails Error]:', err);
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour du chantier' };
  }
}

export interface ChantierVisitHistoryItem {
  id: string;
  date: string | null;
  qualite: string | null;
}

const chantierVisitsHistoryCache = new Map<string, { timestamp: number; data: ChantierVisitHistoryItem[] }>();

export const getChantierVisitsHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ chantierId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const cached = chantierVisitsHistoryCache.get(data.chantierId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return { visits: cached.data };
    }

    try {
      const q1 = `
        query ($id: [ID!]) {
          items(ids: $id) {
            id
            cal: column_values(ids: ["text_mkx19mqq"]) { text }
            date1: column_values(ids: ["date_mkzy6s01"]) { text }
            date2: column_values(ids: ["date_mkzy5nw9"]) { text }
            c1: column_values(ids: ["color_mkzyz3ay"]) { text ... on StatusValue { label } }
            c2: column_values(ids: ["color_mkzyx621"]) { text ... on StatusValue { label } }
            c3: column_values(ids: ["color_mkzycd34"]) { text ... on StatusValue { label } }
            relations: column_values(ids: ["board_relation_mktdcjqv", "board_relation_mkv1fqqk", "board_relation_mkvgvrd3"]) {
              id
              ... on BoardRelationValue { linked_item_ids }
            }
          }
        }
      `;
      const res1: any = await callMondayApi(q1, { variables: { id: [data.chantierId] } });
      const item = res1?.data?.items?.[0];
      const rels = item?.relations || [];
      let linkedIds: string[] = [];
      for (const cv of rels) {
        if (cv.linked_item_ids && Array.isArray(cv.linked_item_ids) && cv.linked_item_ids.length > 0) {
          linkedIds.push(...cv.linked_item_ids.map(String));
        }
      }
      linkedIds = Array.from(new Set(linkedIds)).filter(Boolean);

      let visits: ChantierVisitHistoryItem[] = [];

      if (linkedIds.length > 0) {
        const q2 = `
          query ($ids: [ID!]) {
            items(ids: $ids) {
              id
              date: column_values(ids: ["date_mkrcgy18"]) { text }
              qual: column_values(ids: ["status"]) { text ... on StatusValue { label } }
            }
          }
        `;
        const res2: any = await callMondayApi(q2, { variables: { ids: linkedIds } });
        visits = (res2?.data?.items || []).map((it: any) => ({
          id: String(it.id),
          date: it.date?.[0]?.text || null,
          qualite: it.qual?.[0]?.label || it.qual?.[0]?.text || null,
        })).filter((v: any) => v.date || v.qualite);

        visits.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      }

      // Si aucune visite liée n'a été trouvée dans les relations, fallback sur les colonnes C1/C2/C3 de l'élément
      if (visits.length === 0 && item) {
        const lastDate = item.date1?.[0]?.text || item.date2?.[0]?.text || null;
        const c1Val = item.c1?.[0]?.label || item.c1?.[0]?.text || null;
        const c2Val = item.c2?.[0]?.label || item.c2?.[0]?.text || null;
        const c3Val = item.c3?.[0]?.label || item.c3?.[0]?.text || null;

        if (lastDate || c1Val) {
          visits.push({
            id: 'c1',
            date: lastDate,
            qualite: c1Val,
          });
        }
        if (c2Val) {
          visits.push({
            id: 'c2',
            date: null,
            qualite: c2Val,
          });
        }
        if (c3Val) {
          visits.push({
            id: 'c3',
            date: null,
            qualite: c3Val,
          });
        }
      }

      // Ajout des passages du calendrier antérieur s'ils ne sont pas déjà répertoriés
      const rawCal = item?.cal?.[0]?.text || '';
      if (rawCal) {
        const calDates = rawCal
          .split(/[,;/]|\r?\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s));
        for (const cd of calDates) {
          if (!visits.some((v) => v.date === cd)) {
            visits.push({
              id: `cal-${cd}`,
              date: cd,
              qualite: 'Passage calendrier',
            });
          }
        }
      }
      visits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      chantierVisitsHistoryCache.set(data.chantierId, { timestamp: Date.now(), data: visits });
      return { visits };
    } catch (err) {
      console.error('Erreur getChantierVisitsHistory:', err);
      return { visits: [] as ChantierVisitHistoryItem[] };
    }
  });

