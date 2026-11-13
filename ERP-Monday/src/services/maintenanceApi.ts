import monday from './monday';
import type { ParsedSupplierOrder } from './supplierPdfParser';

export const MAINTENANCE_BOARD_IDS = {
  LISTE_MACHINES: '5106585240',
  REFERENTIEL_POINTS: '5107261391',
  FICHE_CONTROLE: '5107262948',
  REPARATION_MACHINES: '5106693291',
  PLANNING: '5106585296',
  COMMUNICATION_ANIMATRICES: '5044808167',
} as const;

export const COMMUNICATION_GROUP_ID = 'group_mkzb19j1';

export const SECTEUR_RESPONSABLES = [
  'Natacha THOMAS',
  'Emilie TOBIE',
  'Ketty PAULIN',
  'Andre LEVESQUE',
] as const;

export const MONTH_COLUMN_IDS: Record<number, { id: string; label: string; short: string }> = {
  1: { id: 'boolean_mm8tw6vh', label: 'Janvier', short: 'Jan' },
  2: { id: 'boolean_mm8t9qw9', label: 'Février', short: 'Fév' },
  3: { id: 'boolean_mm8tq7wc', label: 'Mars', short: 'Mar' },
  4: { id: 'boolean_mm8tbh9d', label: 'Avril', short: 'Avr' },
  5: { id: 'boolean_mm8t3vm5', label: 'Mai', short: 'Mai' },
  6: { id: 'boolean_mm8tp8x7', label: 'Juin', short: 'Juin' },
  7: { id: 'boolean_mm8tjh3w', label: 'Juillet', short: 'Juil' },
  8: { id: 'boolean_mm8ttrt3', label: 'Août', short: 'Août' },
  9: { id: 'boolean_mm8td8pj', label: 'Septembre', short: 'Sept' },
  10: { id: 'boolean_mm8tk93x', label: 'Octobre', short: 'Oct' },
  11: { id: 'boolean_mm8tf8cp', label: 'Novembre', short: 'Nov' },
  12: { id: 'boolean_mm8t4bz2', label: 'Décembre', short: 'Déc' },
};

export interface TechnicienLabel {
  name: string;
  color?: string;
  border?: string;
}

export const DEFAULT_TECHNICIEN_LABELS: TechnicienLabel[] = [
  { name: 'Christophe', color: '#0073ea', border: '#0060b9' },
  { name: 'Guillaume', color: '#00c875', border: '#00b461' },
  { name: 'Technicien Externe', color: '#fdab3d', border: '#e99729' },
];

export async function fetchTechnicienStatusLabels(): Promise<TechnicienLabel[]> {
  try {
    const res: any = await (monday as any).api(
      `query GetTechnicienColumn($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
            settings_str
          }
        }
      }`,
      { variables: { boardId: [MAINTENANCE_BOARD_IDS.FICHE_CONTROLE] } }
    );
    const cols: any[] = res?.data?.boards?.[0]?.columns || [];
    const techCol = cols.find(
      (c) =>
        c.id === 'color_mm91aa35' ||
        (c.title && c.title.toLowerCase().includes('technicien'))
    );
    if (techCol?.settings_str) {
      const parsed = JSON.parse(techCol.settings_str);
      const labelsObj = parsed?.labels || {};
      const colorsObj = parsed?.labels_colors || {};
      const list: TechnicienLabel[] = [];
      for (const [key, name] of Object.entries(labelsObj)) {
        const strName = String(name || '').trim();
        if (!strName) continue;
        const lower = strName.toLowerCase();
        if (lower === 'test' || lower.startsWith('testet') || lower.includes('testtest')) {
          continue;
        }
        const colorData = colorsObj[key] || {};
        list.push({
          name: strName,
          color: colorData.color || '#0073ea',
          border: colorData.border || '#0060b9',
        });
      }
      if (list.length > 0) {
        const existingNames = new Set(list.map((l) => l.name.toLowerCase()));
        for (const def of DEFAULT_TECHNICIEN_LABELS) {
          if (!existingNames.has(def.name.toLowerCase())) {
            list.push(def);
          }
        }
        return list;
      }
    }
  } catch (err) {
    console.warn('Erreur récupération étiquettes technicien depuis Monday:', err);
  }
  return DEFAULT_TECHNICIEN_LABELS;
}

export interface ReferentielSubItem {
  id: string;
  name: string;
  categories?: {
    controle: boolean;
    nettoyage: boolean;
    usee: boolean;
    cassee: boolean;
  };
}

export interface ReferentielPoint {
  id: string;
  name: string;
  groupTitle: string;
  groupId: string;
  categories?: {
    controle: boolean;
    nettoyage: boolean;
    usee: boolean;
    cassee: boolean;
  };
  subitems?: ReferentielSubItem[];
}

export interface FicheControleSubmission {
  machineId: string;
  machineName: string;
  machineType: string;
  machineSite?: string;
  technicienName?: string;
  pastilleConforme?: boolean;
  noteSurDix?: number;
  date: string; // YYYY-MM-DD
  etatGeneral: 'OK' | 'Moyen' | 'Non conforme';
  decisionFinale?: 'Favorable' | 'A voir animatrice' | 'Non conforme';
  categorieIntervention?: string;
  proprete?: 'Propre' | 'Sale';
  entretienRegulier?: 'Entretenue' | 'Négligée';
  ficheSurSite?: 'Oui' | 'Non';
  tempsPasseMinutes?: number;
  heuresCompteur?: number;
  anomaliesText?: string;
  remarqueAnimatrice?: string;
  targetAnimatrice?: string;
  typeReparation?: 'Interne' | 'Fournisseur';
  machineVetuste?: boolean;
  besoinRevisite?: boolean;
  dateRevisite?: string;
  ncActions?: Record<string, string>;
  pointsEvaluations: Record<string, 'OK' | 'Moyen' | 'NC'>;
}

export interface RealisedControle {
  id: string;
  name: string;
  machineName: string;
  machineId?: string;
  date: string;
  etatGeneral: string;
  noteSurDix?: number;
  technicienName?: string;
  pastilleConforme?: string;
  decisionFinale?: string;
  categorieIntervention?: string;
  proprete?: string;
  entretienRegulier?: string;
  ficheSurSite?: string;
  tempsPasse?: string;
  anomalies?: string;
  evaluations?: Record<string, string>;
}

type HubColumnType = 'numbers' | 'text' | 'long_text' | 'status' | 'date' | 'checkbox';

interface HubColumnSpec {
  key: string;
  title: string;
  type: HubColumnType;
  matchAny: string[];
}

const FICHE_HUB_SPECS: HubColumnSpec[] = [
  { key: 'noteSurDix', title: 'Note (/10)', type: 'numbers', matchAny: ['note 10', 'note /10', 'note'] },
  { key: 'technicien', title: 'Technicien', type: 'status', matchAny: ['technicien', 'controleur'] },
  { key: 'pastille', title: 'Pastille Facility', type: 'status', matchAny: ['pastille'] },
  { key: 'decision', title: 'Décision finale', type: 'status', matchAny: ['decision'] },
  { key: 'modeReparation', title: 'Mode réparation', type: 'text', matchAny: ['mode reparation'] },
  { key: 'vetuste', title: 'Machine vétuste', type: 'checkbox', matchAny: ['vetuste'] },
  { key: 'revisite', title: 'Revisite demandée', type: 'checkbox', matchAny: ['revisite demandee'] },
  { key: 'dateRevisite', title: 'Date revisite', type: 'date', matchAny: ['date revisite'] },
  { key: 'remarqueResp', title: 'Remarque Resp. Secteur', type: 'long_text', matchAny: ['remarque resp', 'remarque animatrice', 'responsable secteur'] },
];

const MACHINE_HUB_SPECS: HubColumnSpec[] = [
  { key: 'derniereNote', title: 'Dernière note (/10)', type: 'numbers', matchAny: ['derniere note'] },
  { key: 'dernierEtat', title: 'Dernier état contrôle', type: 'status', matchAny: ['dernier etat'] },
  { key: 'dateDernierControle', title: 'Date dernier contrôle', type: 'date', matchAny: ['date dernier controle', 'dernier controle'] },
  { key: 'pastille', title: 'Pastille Facility', type: 'status', matchAny: ['pastille'] },
  { key: 'vetuste', title: 'Machine vétuste', type: 'checkbox', matchAny: ['vetuste'] },
  { key: 'prochaineRevisite', title: 'Prochaine revisite', type: 'date', matchAny: ['prochaine revisite', 'date revisite'] },
  { key: 'remarqueResp', title: 'Remarque Resp. Secteur', type: 'long_text', matchAny: ['remarque resp', 'remarque animatrice'] },
];

const REPAIR_HUB_SPECS: HubColumnSpec[] = [
  { key: 'fournisseur', title: 'Fournisseur / Prestataire', type: 'text', matchAny: ['fournisseur', 'prestataire'] },
  { key: 'numeroBon', title: 'N° Bon / OS', type: 'text', matchAny: ['n bon', 'numero bon', 'ordre de service'] },
  { key: 'sousGarantie', title: 'Sous garantie', type: 'checkbox', matchAny: ['sous garantie', 'garantie'] },
  { key: 'site', title: "Site d'intervention", type: 'text', matchAny: ['site d intervention', 'site client'] },
  { key: 'noteControle', title: 'Note (/10) contrôle', type: 'numbers', matchAny: ['note 10 controle', 'note controle', 'note /10'] },
  { key: 'piecesRemplacees', title: 'Pièces remplacées', type: 'long_text', matchAny: ['pieces remplacees'] },
];

const FICHE_SUBITEM_SPECS: HubColumnSpec[] = [
  { key: 'resultat', title: 'Résultat', type: 'status', matchAny: ['resultat', 'statut', 'etat'] },
  { key: 'categorie', title: 'Catégorie', type: 'text', matchAny: ['categorie', 'type'] },
  { key: 'action', title: 'Action / Remarque', type: 'text', matchAny: ['action', 'remarque'] },
];

const hubColumnsPromiseCache: Record<string, Promise<Record<string, string>> | undefined> = {};
const hubColumnsTypeByBoardId: Record<string, Record<string, string>> = {};

function normalizeColMatch(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function ensureHubBoardColumns(
  boardId: string,
  specs: HubColumnSpec[]
): Promise<Record<string, string>> {
  const cacheKey = `${boardId}:${specs.map((s) => s.key).join(',')}`;
  const cached = hubColumnsPromiseCache[cacheKey];
  if (cached) {
    return cached;
  }

  const run = (async () => {
    const resolved: Record<string, string> = {};
    if (!hubColumnsTypeByBoardId[boardId]) hubColumnsTypeByBoardId[boardId] = {};
    try {
      const res: any = await (monday as any).api(
        `query GetHubBoardCols($boardId: [ID!]) {
          boards(ids: $boardId) {
            columns {
              id
              title
              type
            }
          }
        }`,
        { variables: { boardId: [boardId] } }
      );

      const existingCols: Array<{ id: string; title: string; type: string }> =
        res?.data?.boards?.[0]?.columns || [];

      for (const ec of existingCols) {
        hubColumnsTypeByBoardId[boardId][String(ec.id)] = String(ec.type || '').toLowerCase();
      }

      for (const spec of specs) {
        const targetNorm = normalizeColMatch(spec.title);
        const found = existingCols.find((c) => {
          const cNorm = normalizeColMatch(c.title || '');
          if (cNorm === targetNorm) return true;
          return spec.matchAny.some((m) => cNorm.includes(normalizeColMatch(m)));
        });

        if (found) {
          resolved[spec.key] = String(found.id);
          continue;
        }

        try {
          const createRes: any = await (monday as any).api(
            `mutation CreateHubCol($boardId: ID!, $title: String!, $colType: ColumnType!) {
              create_column(board_id: $boardId, title: $title, column_type: $colType) {
                id
              }
            }`,
            {
              variables: {
                boardId,
                title: spec.title,
                colType: spec.type,
              },
            }
          );
          if (createRes?.data?.create_column?.id) {
            const newId = String(createRes.data.create_column.id);
            resolved[spec.key] = newId;
            hubColumnsTypeByBoardId[boardId][newId] = spec.type;
          }
        } catch (colErr) {
          console.warn(`Colonne "${spec.title}" non créée sur ${boardId}:`, colErr);
        }
      }
    } catch (err) {
      console.warn(`Erreur vérification colonnes Hub sur ${boardId}:`, err);
    }
    return resolved;
  })();

  hubColumnsPromiseCache[cacheKey] = run;
  return run;
}

/**
 * S'assure au chargement que toutes les colonnes dédiées du Hub existent sur les tableaux Monday.
 */
export async function syncAllHubColumns(): Promise<void> {
  await Promise.allSettled([
    ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.FICHE_CONTROLE, FICHE_HUB_SPECS),
    ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.LISTE_MACHINES, MACHINE_HUB_SPECS),
    ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.REPARATION_MACHINES, REPAIR_HUB_SPECS),
  ]);
}

async function discoverExistingFicheSubBoardId(): Promise<string | null> {
  try {
    const res: any = await (monday as any).api(
      `query GetFicheSubBoard($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            type
            settings_str
          }
        }
      }`,
      { variables: { boardId: [MAINTENANCE_BOARD_IDS.FICHE_CONTROLE] } }
    );
    const cols: any[] = res?.data?.boards?.[0]?.columns || [];
    const subtasksCol = cols.find((c) => c.type === 'subtasks');
    if (subtasksCol?.settings_str) {
      const parsed = JSON.parse(subtasksCol.settings_str);
      if (Array.isArray(parsed?.boardIds) && parsed.boardIds[0]) {
        return String(parsed.boardIds[0]);
      }
    }
  } catch {}
  return null;
}

async function createFicheControlSubitems(
  parentItemId: string,
  submission: FicheControleSubmission
): Promise<void> {
  const entries = Object.entries(submission.pointsEvaluations || {});
  if (entries.length === 0) return;

  const buildPayload = (subCols: Record<string, string>, pointName: string, evalStatus: 'OK' | 'Moyen' | 'NC') => {
    const payload: Record<string, any> = {};
    if (subCols.resultat) {
      payload[subCols.resultat] = { label: evalStatus };
    }
    if (subCols.categorie) {
      payload[subCols.categorie] = submission.categorieIntervention || 'Contrôle simple';
    }
    if (subCols.action && evalStatus === 'NC') {
      payload[subCols.action] = submission.ncActions?.[pointName]?.trim() || 'Anomalie à traiter';
    }
    return payload;
  };

  const createSingleSubitem = async (pointName: string, columnValues?: Record<string, any>) => {
    const hasCols = columnValues && Object.keys(columnValues).length > 0;
    const mutation = hasCols
      ? `mutation CreateFicheSub($parentId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_subitem(
            parent_item_id: $parentId,
            item_name: $itemName,
            column_values: $columnValues,
            create_labels_if_missing: true
          ) {
            id
            board { id }
          }
        }`
      : `mutation CreateFicheSubBase($parentId: ID!, $itemName: String!) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName) {
            id
            board { id }
          }
        }`;

    const vars: Record<string, any> = {
      parentId: parentItemId,
      itemName: pointName.slice(0, 250),
    };
    if (hasCols) vars.columnValues = JSON.stringify(columnValues);

    const res: any = await (monday as any).api(mutation, { variables: vars });
    return res?.data?.create_subitem || null;
  };

  let subBoardId = await discoverExistingFicheSubBoardId();
  let subCols: Record<string, string> = subBoardId
    ? await ensureHubBoardColumns(subBoardId, FICHE_SUBITEM_SPECS)
    : {};

  let remainingEntries = entries;

  if (!subBoardId) {
    const [firstName, firstStatus] = entries[0];
    const firstCreated = await createSingleSubitem(firstName);
    if (firstCreated?.board?.id) {
      subBoardId = String(firstCreated.board.id);
      subCols = await ensureHubBoardColumns(subBoardId, FICHE_SUBITEM_SPECS);
      const firstPayload = buildPayload(subCols, firstName, firstStatus);
      if (firstCreated.id && Object.keys(firstPayload).length > 0) {
        await (monday as any).api(
          `mutation UpdateFirstSubitem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
            change_multiple_column_values(
              board_id: $boardId,
              item_id: $itemId,
              column_values: $columnValues,
              create_labels_if_missing: true
            ) {
              id
            }
          }`,
          {
            variables: {
              boardId: subBoardId,
              itemId: firstCreated.id,
              columnValues: JSON.stringify(firstPayload),
            },
          }
        );
      }
    }
    remainingEntries = entries.slice(1);
  }

  for (let i = 0; i < remainingEntries.length; i += 4) {
    const batch = remainingEntries.slice(i, i + 4);
    await Promise.allSettled(
      batch.map(([ptName, evalStatus]) => createSingleSubitem(ptName, buildPayload(subCols, ptName, evalStatus)))
    );
  }
}

// 0. Vérifier et créer automatiquement les 4 colonnes cases à cocher dans le Référentiel (5107261391) et dans sa table de sous-éléments si présente
export async function ensureReferentielColumnsExist(subBoardId?: string): Promise<void> {
  const targetBoardId = subBoardId || MAINTENANCE_BOARD_IDS.REFERENTIEL_POINTS;
  try {
    const query = `
      query CheckCols($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
          }
        }
      }
    `;

    const res: any = await (monday as any).api(query, {
      variables: { boardId: [targetBoardId] },
    });

    const existingCols = res?.data?.boards?.[0]?.columns || [];
    const existingTitles = existingCols.map((c: any) => (c.title || '').toLowerCase().trim());

    const neededColumns = [
      { title: 'Contrôle simple', match: 'contrôle' },
      { title: 'Nettoyage', match: 'nettoyage' },
      { title: 'Pièce usée', match: 'usée' },
      { title: 'Pièce cassée', match: 'cassée' },
    ];

    for (const needed of neededColumns) {
      const exists = existingTitles.some((t: string) => t.includes(needed.match) || t.includes(needed.match.replace('é', 'e')));
      if (!exists) {
        await (monday as any).api(`
          mutation CreateCol($boardId: ID!, $title: String!) {
            create_column(board_id: $boardId, title: $title, column_type: checkbox) {
              id
            }
          }
        `, {
          variables: {
            boardId: targetBoardId,
            title: needed.title,
          },
        });
      }
    }
  } catch (err) {
    console.warn('Erreur vérification colonnes Référentiel:', err);
  }
}

export function classifyPointCategories(pointName: string): {
  controle: boolean;
  nettoyage: boolean;
  usee: boolean;
  cassee: boolean;
} {
  const n = (pointName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isNettoyage =
    /nettoyage|filtre|cuve|propret|odeur|bac|reservoir|suceur|bavette|poussiere|eau\b|lavage|flotteur|lance|buse/i.test(n) &&
    !/c[âa]ble|batterie|commande|timon|prise/i.test(n);

  const isUsee =
    /usure|usee?|brosse|disque|suceur|bavette|roue|roulette|lance|buse|filtre|flexible|tube|tampon|patin|c[âa]ble|batterie|niveau d'huile|fixation du plateau/i.test(n);

  const isCassee =
    /casse|panne|commande|c[âa]ble|batterie|chargeur|flexible|poignee|timon|fixation|fuite|serrage|frein|moteur|pompe|structure|fissur|perc|tiroir|prise|buse/i.test(n);

  return {
    controle: true,
    nettoyage: isNettoyage,
    usee: isUsee,
    cassee: isCassee,
  };
}

// 1. Récupérer l'intégralité du Référentiel des points de contrôle (groupé par type de machine + sous-éléments + colonnes de catégories)
export async function fetchReferentielPoints(): Promise<ReferentielPoint[]> {
  // S'assurer d'abord que les 4 colonnes de tag existent sur Monday
  await ensureReferentielColumnsExist();

  const queryWithSubitems = `
    query GetReferentiel($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
        items_page(limit: 500) {
          items {
            id
            name
            group {
              id
              title
            }
            column_values {
              id
              text
              value
              ... on BoardRelationValue {
                linked_item_ids
              }
            }
            subitems {
              id
              name
              board {
                id
                columns {
                  id
                  title
                }
              }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    }
  `;

  let res: any = null;
  try {
    res = await (monday as any).api(queryWithSubitems, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.REFERENTIEL_POINTS] },
    });
  } catch {
    res = null;
  }

  // Fallback si la requête subitems pose problème sur une ancienne version API
  if (!res?.data?.boards?.[0]) {
    const fallbackQuery = `
      query GetReferentielBase($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
          }
          items_page(limit: 500) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    res = await (monday as any).api(fallbackQuery, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.REFERENTIEL_POINTS] },
    });
  }

  const board = res?.data?.boards?.[0];
  const cols = board?.columns || [];
  const items = board?.items_page?.items || [];

  const findCategoryCols = (columnsList: any[]) => ({
    controle: columnsList.find((c: any) => c.title.toLowerCase().includes('contrôle') || c.title.toLowerCase().includes('controle'))?.id,
    nettoyage: columnsList.find((c: any) => c.title.toLowerCase().includes('nettoyage'))?.id,
    usee: columnsList.find((c: any) => c.title.toLowerCase().includes('usée') || c.title.toLowerCase().includes('usee'))?.id,
    cassee: columnsList.find((c: any) => c.title.toLowerCase().includes('cassée') || c.title.toLowerCase().includes('cassee') || c.title.toLowerCase().includes('répar') || c.title.toLowerCase().includes('repar'))?.id,
  });

  const parentColsMap = findCategoryCols(cols);

  // Vérifier si un sous-tableau existe déjà et lui ajouter aussi les 4 colonnes s'il en manque
  let subBoardChecked = false;
  for (const it of items) {
    if (!subBoardChecked && Array.isArray(it.subitems) && it.subitems.length > 0 && it.subitems[0]?.board?.id) {
      subBoardChecked = true;
      ensureReferentielColumnsExist(it.subitems[0].board.id).catch(() => {});
    }
  }

  const isColChecked = (columnValues: any[], colId?: string) => {
    if (!colId || !columnValues) return false;
    const cv = columnValues.find((c: any) => c.id === colId);
    let valChecked = false;
    if (cv?.value) {
      try {
        const parsed = typeof cv.value === 'string' ? JSON.parse(cv.value) : cv.value;
        valChecked = parsed?.checked === true || parsed?.checked === 'true' || parsed?.checked === 1;
      } catch {}
    }
    const txt = (cv?.text || '').toLowerCase().trim();
    const txtChecked = txt.includes('v') || txt.includes('true') || txt === '1' || txt.includes('coch');
    return valChecked || txtChecked;
  };

  return items.map((it: any) => {
    const parsedSubitems: ReferentielSubItem[] = Array.isArray(it.subitems)
      ? it.subitems.map((sub: any) => {
          const subCols = sub.board?.columns || [];
          const subColsMap = findCategoryCols(subCols);
          const hasManualCheck =
            isColChecked(sub.column_values, subColsMap.controle) ||
            isColChecked(sub.column_values, subColsMap.nettoyage) ||
            isColChecked(sub.column_values, subColsMap.usee) ||
            isColChecked(sub.column_values, subColsMap.cassee);
          const autoCat = classifyPointCategories(sub.name);
          return {
            id: sub.id,
            name: sub.name,
            categories: hasManualCheck
              ? {
                  controle: isColChecked(sub.column_values, subColsMap.controle),
                  nettoyage: isColChecked(sub.column_values, subColsMap.nettoyage),
                  usee: isColChecked(sub.column_values, subColsMap.usee),
                  cassee: isColChecked(sub.column_values, subColsMap.cassee),
                }
              : autoCat,
          };
        })
      : [];

    const hasParentManualCheck =
      isColChecked(it.column_values, parentColsMap.controle) ||
      isColChecked(it.column_values, parentColsMap.nettoyage) ||
      isColChecked(it.column_values, parentColsMap.usee) ||
      isColChecked(it.column_values, parentColsMap.cassee);
    const parentAutoCat = classifyPointCategories(it.name);

    return {
      id: it.id,
      name: it.name,
      groupTitle: it.group?.title || 'Général',
      groupId: it.group?.id || '',
      categories: hasParentManualCheck
        ? {
            controle: isColChecked(it.column_values, parentColsMap.controle),
            nettoyage: isColChecked(it.column_values, parentColsMap.nettoyage),
            usee: isColChecked(it.column_values, parentColsMap.usee),
            cassee: isColChecked(it.column_values, parentColsMap.cassee),
          }
        : parentAutoCat,
      subitems: parsedSubitems.length > 0 ? parsedSubitems : undefined,
    };
  });
}

// Trouver les points de contrôle qui correspondent à un type de machine ET à la catégorie d'intervention
export function filterPointsByMachineType(
  points: ReferentielPoint[],
  machineType: string,
  selectedCategory?: string
): ReferentielPoint[] {
  const typeLower = (machineType || '').toLowerCase().trim();

  // Mapping intelligent du type de machine vers le groupe du référentiel (via ID de groupe et/ou titre)
  let targetGroupId = '';
  let targetGroupTitle = '';

  if (typeLower.includes('autolaveuse')) {
    targetGroupId = 'group_mm8td794'; // Autolaveuse
    targetGroupTitle = 'autolaveuse';
  } else if (typeLower.includes('monobrosse') || typeLower.includes('balayeuse')) {
    targetGroupId = 'group_mm8tcssq'; // Monobrosse
    targetGroupTitle = 'monobrosse';
  } else if (typeLower.includes('aspirateur') || typeLower.includes('injecteur') || typeLower.includes('moquette')) {
    targetGroupId = 'group_mm8t56kz'; // Aspirateur (groupe contenant les points d'aspiration)
    targetGroupTitle = 'aspirateur';
  } else if (
    typeLower.includes('haute pression') ||
    typeLower.includes('hp') ||
    typeLower.includes('vapeur') ||
    typeLower.includes('pompe') ||
    typeLower.includes('pulvérisateur') ||
    typeLower.includes('eau pure')
  ) {
    targetGroupId = 'group_mm8tket6'; // Nettoyeur HP / Pression
    targetGroupTitle = 'haute pression';
  } else if (
    typeLower.includes('chariot') ||
    typeLower.includes('manutention') ||
    typeLower.includes('escabeau') ||
    typeLower.includes('échafaudage')
  ) {
    targetGroupId = 'group_mm8tkaq1'; // Chariot / Manutention
    targetGroupTitle = 'chariot';
  }

  // 1. Filtrage prioritaire par Group ID (garantit le match même si les groupes ont le même nom dans Monday)
  let basePoints: ReferentielPoint[] = [];
  if (targetGroupId) {
    basePoints = points.filter((p) => p.groupId === targetGroupId);
  }
  if (basePoints.length === 0 && targetGroupTitle) {
    basePoints = points.filter((p) => p.groupTitle.toLowerCase().includes(targetGroupTitle));
  }
  if (basePoints.length === 0) {
    const fallback = points.filter((p) => p.groupTitle.toLowerCase().includes('autolaveuse') || p.groupId === 'group_mm8td794');
    basePoints = fallback.length > 0 ? fallback : points;
  }

  // 2. Filtrage par Catégorie d'intervention si spécifiée
  if (selectedCategory && basePoints.length > 0) {
    const catLower = selectedCategory.toLowerCase();
    let matchingCat: 'controle' | 'nettoyage' | 'usee' | 'cassee' = 'controle';
    if (catLower.includes('nettoyage')) matchingCat = 'nettoyage';
    else if (catLower.includes('usée') || catLower.includes('usee')) matchingCat = 'usee';
    else if (catLower.includes('cassée') || catLower.includes('cassee') || catLower.includes('répar')) matchingCat = 'cassee';

    if (matchingCat === 'controle') {
      return basePoints;
    }

    const filtered: ReferentielPoint[] = basePoints.flatMap((p) => {
      const parentTagged = Boolean(p.categories && p.categories[matchingCat]);
      const matchingSubitems = p.subitems?.filter((s) => s.categories && s.categories[matchingCat]);
      if (parentTagged || (matchingSubitems && matchingSubitems.length > 0)) {
        const pointCopy: ReferentielPoint = {
          ...p,
          ...(p.subitems ? { subitems: matchingSubitems && matchingSubitems.length > 0 ? matchingSubitems : p.subitems } : {}),
        };
        return [pointCopy];
      }
      return [];
    });

    if (filtered.length > 0) {
      return filtered;
    }
  }

  return basePoints;
}

// 2. Récupérer les contrôles déjà réalisés (Fiche de contrôle 5107262948)
export async function fetchRealisedControles(): Promise<RealisedControle[]> {
  const query = `
    query GetControles($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
              value
              ... on BoardRelationValue {
                linked_item_ids
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.FICHE_CONTROLE] },
    });

    const ficheCols = await ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.FICHE_CONTROLE, FICHE_HUB_SPECS);

    const items = res?.data?.boards?.[0]?.items_page?.items || [];
    return items
      .map((it: any) => {
        const getCol = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text || '';
        const getDateVal = (id: string) => {
          const col = it.column_values?.find((c: any) => c.id === id);
          if (col?.value) {
            try {
              const parsed = JSON.parse(col.value);
              if (parsed?.date) return parsed.date;
            } catch {}
          }
          return col?.text || '';
        };

        const dateStr = getDateVal('date_mm8txw52');
        const etat = getCol('color_mm8tmqfc') || 'OK';
        const machineRelCol = it.column_values?.find((c: any) => c.id === 'board_relation_mm8txvw9');
        const machineText = machineRelCol?.text || '';
        let linkedMachineId: string | undefined = Array.isArray(machineRelCol?.linked_item_ids) && machineRelCol.linked_item_ids[0]
          ? String(machineRelCol.linked_item_ids[0])
          : undefined;
        if (!linkedMachineId && machineRelCol?.value) {
          try {
            const parsedRel = JSON.parse(machineRelCol.value);
            const firstId = parsedRel?.linkedPulseIds?.[0]?.linkedPulseId;
            if (firstId) linkedMachineId = String(firstId);
          } catch {}
        }
        const rawNote = ficheCols.noteSurDix ? getCol(ficheCols.noteSurDix) : '';
        const parsedNote = rawNote !== '' && !Number.isNaN(Number(rawNote)) ? Number(rawNote) : undefined;

        return {
          id: it.id,
          name: it.name,
          machineName: machineText || it.name,
          machineId: linkedMachineId,
          date: dateStr,
          etatGeneral: etat,
          noteSurDix: parsedNote,
          technicienName: ficheCols.technicien ? getCol(ficheCols.technicien) || undefined : undefined,
          pastilleConforme: ficheCols.pastille ? getCol(ficheCols.pastille) || undefined : undefined,
          decisionFinale: ficheCols.decision ? getCol(ficheCols.decision) || undefined : undefined,
          categorieIntervention: getCol('dropdown_mm8ty165') || 'Contrôle simple',
          proprete: getCol('color_mm8thp7f') || 'Propre',
          entretienRegulier: getCol('color_mm8t1swv') || 'Entretenue',
          ficheSurSite: getCol('color_mm8tqegk') || 'Oui',
          tempsPasse: getCol('numeric_mm8tg9cz'),
          anomalies: getCol('long_text_mm8tjqkm'),
        };
      })
      .filter((c: RealisedControle) => c.date); // Seulement ceux qui ont une date valide
  } catch (err) {
    console.warn('Erreur lors du chargement des fiches de contrôle:', err);
    return [];
  }
}

// 3. Soumettre une Fiche de Contrôle (créer un item dans 5107262948)
export async function submitFicheControle(submission: FicheControleSubmission): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const formattedDate = submission.date;
    const itemName = `Contrôle - ${submission.machineName} - ${formattedDate}`;

    // Mapping de l'état général vers les labels réels Monday ('Vert', 'Orange', 'Rouge')
    let etatLabel = 'Vert';
    const etatRaw = (submission.etatGeneral || '').toLowerCase();
    if (etatRaw.includes('rouge') || etatRaw.includes('non') || etatRaw === 'nc') {
      etatLabel = 'Rouge';
    } else if (etatRaw.includes('orange') || etatRaw.includes('moyen')) {
      etatLabel = 'Orange';
    }

    const ficheCols = await ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.FICHE_CONTROLE, FICHE_HUB_SPECS);

    // Préparation des valeurs de colonnes sur Fiche de Contrôle (5107262948)
    const columnValuesObj: Record<string, any> = {
      date_mm8txw52: { date: formattedDate },
      color_mm8tmqfc: { label: etatLabel },
      // 4 critères d'inspection terrain
      dropdown_mm8ty165: { labels: [submission.categorieIntervention || 'Contrôle simple'] },
      color_mm8thp7f: { label: submission.proprete || 'Propre' },
      color_mm8t1swv: { label: submission.entretienRegulier || 'Entretenue' },
      color_mm8tqegk: { label: submission.ficheSurSite || 'Oui' },
    };

    if (ficheCols.noteSurDix && submission.noteSurDix !== undefined) {
      columnValuesObj[ficheCols.noteSurDix] = submission.noteSurDix;
    }
    if (ficheCols.technicien && submission.technicienName?.trim()) {
      const techColType = hubColumnsTypeByBoardId[MAINTENANCE_BOARD_IDS.FICHE_CONTROLE]?.[ficheCols.technicien];
      const cleanTech = submission.technicienName.trim();
      columnValuesObj[ficheCols.technicien] =
        techColType === 'status' || techColType === 'color' ? { label: cleanTech } : cleanTech;
    }
    if (ficheCols.pastille) {
      columnValuesObj[ficheCols.pastille] = {
        label: submission.pastilleConforme !== false ? 'Conforme' : 'Non conforme',
      };
    }
    if (ficheCols.decision && submission.decisionFinale) {
      const decLabel =
        submission.decisionFinale === 'A voir animatrice'
          ? 'À voir Resp. Secteur'
          : submission.decisionFinale;
      columnValuesObj[ficheCols.decision] = { label: decLabel };
    }
    if (ficheCols.modeReparation && submission.typeReparation) {
      columnValuesObj[ficheCols.modeReparation] = submission.typeReparation;
    }
    if (ficheCols.vetuste) {
      columnValuesObj[ficheCols.vetuste] = submission.machineVetuste ? { checked: 'true' } : null;
    }
    if (ficheCols.revisite) {
      columnValuesObj[ficheCols.revisite] = submission.besoinRevisite ? { checked: 'true' } : null;
    }
    if (ficheCols.dateRevisite && submission.besoinRevisite && submission.dateRevisite) {
      columnValuesObj[ficheCols.dateRevisite] = { date: submission.dateRevisite };
    }
    if (ficheCols.remarqueResp && submission.remarqueAnimatrice?.trim()) {
      columnValuesObj[ficheCols.remarqueResp] = { text: submission.remarqueAnimatrice.trim() };
    }

    if (submission.tempsPasseMinutes !== undefined && submission.tempsPasseMinutes > 0) {
      columnValuesObj.numeric_mm8tg9cz = submission.tempsPasseMinutes;
    }

    if (submission.heuresCompteur !== undefined && submission.heuresCompteur > 0) {
      // numeric_mm8v3mw : Heures compteur sur Fiche de Contrôle (5107262948)
      columnValuesObj.numeric_mm8v3mw = submission.heuresCompteur;
    }

    // Récapitulatif des anomalies pour faciliter l'automatisation Monday vers Réparations
    const ncList = Object.entries(submission.pointsEvaluations)
      .filter(([_, st]) => st === 'NC')
      .map(([pt]) => {
        const customAction = submission.ncActions?.[pt]?.trim();
        return customAction
          ? `• NON CONFORME : ${pt}\n  ➜ Action à entreprendre : ${customAction}`
          : `• NON CONFORME : ${pt}`;
      });

    const moyenList = Object.entries(submission.pointsEvaluations)
      .filter(([_, st]) => st === 'Moyen')
      .map(([pt]) => `• À SURVEILLER (Moyen) : ${pt}`);

    // Récapitulatif complet de la fiche pour Monday
    let fullAnomaliesText = '';

    if (submission.technicienName || submission.noteSurDix !== undefined || submission.pastilleConforme !== undefined) {
      fullAnomaliesText += `SYNTHÈSE DU CONTRÔLE TECHNIQUE :\n`;
      fullAnomaliesText += `• Technicien : ${submission.technicienName || 'Christophe'}\n`;
      fullAnomaliesText += `• Pastille Facility : ${submission.pastilleConforme !== false ? 'Conforme' : 'Non conforme / Manquante'}\n`;
      if (submission.noteSurDix !== undefined) {
        fullAnomaliesText += `• Note état général : ${submission.noteSurDix}/10\n`;
      }
      if (submission.decisionFinale) {
        const decisionText =
          submission.decisionFinale === 'A voir animatrice'
            ? 'À voir avec le Responsable de Secteur'
            : submission.decisionFinale;
        fullAnomaliesText += `• Décision à l'issue : ${decisionText}\n`;
      }
      if (submission.machineVetuste) {
        fullAnomaliesText += `• Vétusté : Machine vétuste (demande de renouvellement)\n`;
      }
      if (submission.besoinRevisite && submission.dateRevisite) {
        fullAnomaliesText += `• Revisite programmée le : ${submission.dateRevisite}\n`;
      }
      if (submission.typeReparation) {
        fullAnomaliesText += `• Mode réparation : ${submission.typeReparation === 'Fournisseur' ? 'Intervention fournisseur (machine 500 kg / lourde)' : 'Réparation en interne'}\n`;
      }
      fullAnomaliesText += `\n`;
    }

    if (submission.remarqueAnimatrice?.trim()) {
      fullAnomaliesText += `📢 MESSAGE & ALERTE POUR LE RESPONSABLE DE SECTEUR :\n${submission.remarqueAnimatrice.trim()}\n\n`;
    }

    if (ncList.length > 0) {
      fullAnomaliesText += `ACTIONS CURATIVES À ENTREPRENDRE (POINTS NON CONFORMES) :\n${ncList.join('\n')}\n\n`;
    }
    if (moyenList.length > 0) {
      fullAnomaliesText += `POINTS À SURVEILLER (MOYEN) :\n${moyenList.join('\n')}\n\n`;
    }
    if (submission.anomaliesText?.trim()) {
      fullAnomaliesText += `REMARQUES COMPLÉMENTAIRES :\n${submission.anomaliesText.trim()}`;
    }

    if (fullAnomaliesText.trim()) {
      columnValuesObj.long_text_mm8tjqkm = { text: fullAnomaliesText.trim() };
    }

    // Liaison relationnelle machine vers Liste des machines
    if (submission.machineId) {
      columnValuesObj.board_relation_mm8txvw9 = {
        item_ids: [Number(submission.machineId)],
      };
    }

    // Mapping des points vers les 7 colonnes statuts d'organes de la fiche de contrôle
    // Règle de priorité des statuts : 'NC' > 'Moyen' > 'OK'
    const statusPriority = { NC: 3, Moyen: 2, OK: 1 };
    const organStatuses: Record<string, 'OK' | 'Moyen' | 'NC'> = {};

    const updateOrganStatus = (colKey: string, newStatus: 'OK' | 'Moyen' | 'NC') => {
      const current = organStatuses[colKey];
      if (!current || statusPriority[newStatus] > statusPriority[current]) {
        organStatuses[colKey] = newStatus;
      }
    };

    for (const [pointName, evalStatus] of Object.entries(submission.pointsEvaluations)) {
      const pLower = pointName.toLowerCase();

      // 1. Bavettes / Suceurs
      if (pLower.includes('suceur') || pLower.includes('bavette')) {
        updateOrganStatus('color_mm8tnjtd', evalStatus);
      }
      // 2. État des brosses
      if (pLower.includes('brosse') || pLower.includes('plateau')) {
        updateOrganStatus('color_mm8t6n09', evalStatus);
      }
      // 3. Filtres et cuves
      if (pLower.includes('filtre') || pLower.includes('cuve')) {
        updateOrganStatus('color_mm8tkhav', evalStatus);
      }
      // 4. État des batteries / câbles
      if (pLower.includes('batterie') || pLower.includes('câble') || pLower.includes('cable') || pLower.includes('chargeur')) {
        updateOrganStatus('color_mm8tbmpe', evalStatus);
      }
      // 5. Roues & Roulettes (NEW)
      if (pLower.includes('roue') || pLower.includes('roulette') || pLower.includes('chariot')) {
        updateOrganStatus('color_mm8vmnff', evalStatus);
      }
      // 6. Flexibles, Lances & Buses (NEW)
      if (pLower.includes('flexible') || pLower.includes('lance') || pLower.includes('buse') || pLower.includes('tube') || pLower.includes('raccord')) {
        updateOrganStatus('color_mm8v31da', evalStatus);
      }
      // 7. Commandes & Mécanique (NEW)
      if (
        pLower.includes('commande') ||
        pLower.includes('timon') ||
        pLower.includes('poignée') ||
        pLower.includes('poignee') ||
        pLower.includes('moteur') ||
        pLower.includes('pompe') ||
        pLower.includes('réservoir') ||
        pLower.includes('reservoir') ||
        pLower.includes('huile') ||
        pLower.includes('mécanique') ||
        pLower.includes('mecanique')
      ) {
        updateOrganStatus('color_mm8vkxty', evalStatus);
      }
    }

    // Injecter les statuts finaux calculés dans columnValuesObj
    for (const [colId, st] of Object.entries(organStatuses)) {
      columnValuesObj[colId] = { label: st };
    }

    const mutation = `
      mutation CreateFiche($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
          id
        }
      }
    `;

    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.FICHE_CONTROLE,
        itemName,
        columnValues: JSON.stringify(columnValuesObj),
      },
    });

    if (res?.data?.create_item?.id) {
      const createdId = res.data.create_item.id;

      // Créer les sous-éléments détaillés des points contrôlés sur la Fiche de Contrôle (évite 100 colonnes sur le tableau parent)
      try {
        await createFicheControlSubitems(String(createdId), submission);
      } catch (subErr) {
        console.warn('Erreur création sous-éléments points contrôlés:', subErr);
      }

      // Mettre à jour les colonnes récapitulatives de la machine dans Liste des machines (5106585240)
      if (submission.machineId) {
        try {
          const machineCols = await ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.LISTE_MACHINES, MACHINE_HUB_SPECS);
          const machineUpdates: Record<string, any> = {};

          if (submission.heuresCompteur !== undefined && submission.heuresCompteur > 0) {
            machineUpdates.numeric_mm8v97ja = submission.heuresCompteur; // Heures compteur (dernier relevé)
          }
          if (machineCols.derniereNote && submission.noteSurDix !== undefined) {
            machineUpdates[machineCols.derniereNote] = submission.noteSurDix;
          }
          if (machineCols.dernierEtat) {
            machineUpdates[machineCols.dernierEtat] = { label: etatLabel };
          }
          if (machineCols.dateDernierControle && formattedDate) {
            machineUpdates[machineCols.dateDernierControle] = { date: formattedDate };
          }
          if (machineCols.pastille) {
            machineUpdates[machineCols.pastille] = {
              label: submission.pastilleConforme !== false ? 'Conforme' : 'Non conforme',
            };
          }
          if (machineCols.vetuste) {
            machineUpdates[machineCols.vetuste] = submission.machineVetuste ? { checked: 'true' } : null;
          }
          if (machineCols.prochaineRevisite && submission.besoinRevisite && submission.dateRevisite) {
            machineUpdates[machineCols.prochaineRevisite] = { date: submission.dateRevisite };
          }
          if (machineCols.remarqueResp && submission.remarqueAnimatrice?.trim()) {
            machineUpdates[machineCols.remarqueResp] = { text: submission.remarqueAnimatrice.trim() };
          }

          if (Object.keys(machineUpdates).length > 0) {
            await (monday as any).api(
              `mutation UpdateMachineSummary($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
                change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues, create_labels_if_missing: true) {
                  id
                }
              }`,
              {
                variables: {
                  boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
                  itemId: submission.machineId,
                  columnValues: JSON.stringify(machineUpdates),
                },
              }
            );
          }
        } catch (machineSyncErr) {
          console.warn('Erreur mise à jour synthèse machine sur Liste des machines:', machineSyncErr);
        }
      }

      // =========================================================================
      // CRÉATION AUTOMATIQUE DE LA RÉPARATION CURATIVE DANS LE TABLEAU 4 (5106693291)
      // Si au moins 1 point non conforme (NC) a été détecté
      // =========================================================================
      const ncEntries = Object.entries(submission.pointsEvaluations).filter(([_, st]) => st === 'NC');
      if (ncEntries.length > 0 && submission.machineId) {
        try {
          const repairExtraCols = await ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.REPARATION_MACHINES, REPAIR_HUB_SPECS);
          const repairItemName = `Réparation Curative - ${submission.machineName} - ${formattedDate}`;
          const repairDescriptionText = ncEntries
            .map(([pt]) => {
              const customAction = submission.ncActions?.[pt]?.trim();
              return customAction ? `☐ ${pt} : ${customAction}` : `☐ ${pt} (Non conforme)`;
            })
            .join('\n');

          const repairColValues: Record<string, any> = {
            board_relation_mm8gc4mh: { item_ids: [Number(submission.machineId)] },
            color_mm8gs7c7: { label: 'Curative' },
            date_mm8g4vq6: { date: formattedDate },
            color_mm8vp2nd: { label: 'À traiter' },
            text_mm8vhwst: repairDescriptionText,
          };

          if (repairExtraCols.fournisseur) {
            repairColValues[repairExtraCols.fournisseur] =
              submission.typeReparation === 'Fournisseur' ? 'Fournisseur agréé' : `Interne (${submission.technicienName || 'Christophe'})`;
          }
          if (repairExtraCols.site && submission.machineSite?.trim()) {
            repairColValues[repairExtraCols.site] = submission.machineSite.trim();
          }
          if (repairExtraCols.noteControle && submission.noteSurDix !== undefined) {
            repairColValues[repairExtraCols.noteControle] = submission.noteSurDix;
          }

          const repairMeta = await fetchRepairBoardMeta();
          const repairMutation = repairMeta.inRepairGroupId
            ? `
              mutation CreateRepairWithGroup($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON!) {
                create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
                  id
                }
              }
            `
            : `
              mutation CreateRepair($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
                create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
                  id
                }
              }
            `;

          const repairVars: Record<string, any> = {
            boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
            itemName: repairItemName,
            columnValues: JSON.stringify(repairColValues),
          };
          if (repairMeta.inRepairGroupId) {
            repairVars.groupId = repairMeta.inRepairGroupId;
          }

          const repairRes: any = await (monday as any).api(repairMutation, {
            variables: repairVars,
          });

          // Post d'un compte-rendu formaté dans la bulle d'activité Monday de l'item de réparation
          if (repairRes?.data?.create_item?.id) {
            await syncMachineRepairLifecycleStatus(submission.machineId, 'En réparation');
            const repairItemId = repairRes.data.create_item.id;
            const updateHtml = `🔧 <b>Intervention curative générée automatiquement suite au contrôle technique du ${formattedDate}</b><br><br>` +
              `<b>Technicien :</b> ${submission.technicienName || 'Christophe'}<br>` +
              `<b>Machine :</b> ${submission.machineName} (${submission.machineType})<br>` +
              `<b>État général :</b> ${etatLabel} ${submission.noteSurDix !== undefined ? `(${submission.noteSurDix}/10)` : ''}<br>` +
              `<b>Catégorie d'intervention :</b> ${submission.categorieIntervention || 'Contrôle simple'}<br>` +
              `<b>Mode de réparation :</b> ${submission.typeReparation === 'Fournisseur' ? '🏭 Fournisseur agréé (machine 500 kg / lourde)' : '🔧 En interne par l\'équipe'}<br>` +
              `<b>Propreté :</b> ${submission.proprete || 'Propre'} | <b>Entretien :</b> ${submission.entretienRegulier || 'Entretenue'} | <b>Fiche site :</b> ${submission.ficheSurSite || 'Oui'}<br><br>` +
              (submission.remarqueAnimatrice?.trim() ? `<div style="background:#FFF8EC;border-left:4px solid #F7AC37;padding:8px 12px;margin:8px 0;">📢 <b>Alerte / Remarque pour le Responsable de Secteur :</b><br>${submission.remarqueAnimatrice.trim()}</div><br>` : '') +
              `<b>Points non conformes détectés &amp; Actions à entreprendre :</b><br>` +
              ncEntries
                .map(([pt]) => {
                  const act = submission.ncActions?.[pt]?.trim() || 'À diagnostiquer et réparer';
                  return `• <b>${pt}</b> : <span style="color:#e2445c;font-weight:bold;">NC</span> ➔ <i>${act}</i>`;
                })
                .join('<br>') +
              (submission.anomaliesText?.trim() ? `<br><br><b>Remarques complémentaires :</b><br>${submission.anomaliesText.trim()}` : '');

            await (monday as any).api(`
              mutation PostUpdate($itemId: ID!, $body: String!) {
                create_update(item_id: $itemId, body: $body) {
                  id
                }
              }
            `, {
              variables: {
                itemId: repairItemId,
                body: updateHtml,
              },
            });
          }
        } catch (repairErr) {
          console.warn('Erreur lors de la création automatique de la réparation:', repairErr);
        }
      }

      // =========================================================================
      // COMMUNICATION AUTOMATIQUE VERS LE RESPONSABLE DE SECTEUR (FICHE + MACHINE + ALERTE 5044808167)
      // =========================================================================
      if (submission.remarqueAnimatrice?.trim() || submission.decisionFinale === 'A voir animatrice') {
        try {
          const alertText =
            submission.remarqueAnimatrice?.trim() ||
            `Décision contrôle : ${submission.decisionFinale || 'À voir avec le Responsable de Secteur'}`;
          await sendMaintenanceAlert({
            recipientPerson: submission.targetAnimatrice?.trim() || 'Natacha THOMAS',
            machineName: submission.machineName,
            siteName: submission.machineSite,
            message: alertText,
            senderName: submission.technicienName || 'Christophe',
          });
        } catch (alertErr) {
          console.warn('Erreur envoi alerte vers Communication animatrices:', alertErr);
        }
      }
      if (
        submission.machineId &&
        (submission.remarqueAnimatrice?.trim() ||
          submission.decisionFinale === 'A voir animatrice' ||
          submission.machineVetuste ||
          submission.besoinRevisite)
      ) {
        try {
          const decisionLabel =
            submission.decisionFinale === 'A voir animatrice'
              ? 'À voir avec le Responsable de Secteur'
              : submission.decisionFinale;
          const animUpdateHtml =
            `📢 <b>Compte-rendu Contrôle Technique (${formattedDate}) — ${submission.technicienName || 'Christophe'}</b><br><br>` +
            `<b>Note état général :</b> ${submission.noteSurDix ?? 8}/10 (${etatLabel})<br>` +
            `<b>Pastille Facility :</b> ${submission.pastilleConforme !== false ? '✅ Conforme' : '⚠️ Non conforme / Manquante'}<br>` +
            (decisionLabel ? `<b>Décision :</b> ${decisionLabel}<br>` : '') +
            (submission.machineVetuste ? `<b>⚠️ Vétusté :</b> Machine jugée trop vieille / vétuste (renouvellement recommandé)<br>` : '') +
            (submission.besoinRevisite && submission.dateRevisite ? `<b>🔄 Revisite programmée le :</b> ${submission.dateRevisite}<br>` : '') +
            (submission.remarqueAnimatrice?.trim()
              ? `<br><div style="background:#FFF8EC;border-left:4px solid #F7AC37;padding:8px 12px;"><b>💬 Message pour le Responsable de Secteur :</b><br>${submission.remarqueAnimatrice.trim()}</div>`
              : '');

          await (monday as any).api(`
            mutation PostMachineAnimUpdate($itemId: ID!, $body: String!) {
              create_update(item_id: $itemId, body: $body) {
                id
              }
            }
          `, {
            variables: {
              itemId: submission.machineId,
              body: animUpdateHtml,
            },
          });
        } catch (animErr) {
          console.warn('Erreur post remarque animatrice sur machine:', animErr);
        }
      }

      return { success: true, id: createdId };
    }
    return { success: false, error: res?.errors?.[0]?.message || 'Erreur inconnue lors de la création.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur réseau lors de la soumission.' };
  }
}

// 4. Mettre à jour une case à cocher d'un mois sur la Liste des machines (5106585240)
export async function toggleMachineMonth(
  machineId: string,
  monthNumber: number,
  isChecked: boolean
): Promise<{ success: boolean; error?: string }> {
  const colMeta = MONTH_COLUMN_IDS[monthNumber];
  if (!colMeta) return { success: false, error: 'Mois invalide' };

  const mutation = `
    mutation UpdateMonth($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
        itemId: machineId,
        columnValues: JSON.stringify({
          [colMeta.id]: isChecked ? { checked: 'true' } : null,
        }),
      },
    });
    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: res?.errors?.[0]?.message || 'Erreur Monday' };
  } catch (err: any) {
    console.error('Erreur mise à jour mois machine:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}

// 5. Cocher ou décocher l'ensemble des 12 mois en 1 seule opération
export async function setMachineAllMonths(
  machineId: string,
  checkAll: boolean
): Promise<{ success: boolean; error?: string }> {
  const colValuesObj: Record<string, any> = {};
  for (let m = 1; m <= 12; m++) {
    const colId = MONTH_COLUMN_IDS[m].id;
    colValuesObj[colId] = checkAll ? { checked: 'true' } : null;
  }

  const mutation = `
    mutation UpdateAllMonths($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
        itemId: machineId,
        columnValues: JSON.stringify(colValuesObj),
      },
    });
    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: res?.errors?.[0]?.message || 'Erreur Monday' };
  } catch (err: any) {
    console.error('Erreur mise à jour tous les mois:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}

// 6. Mettre à jour la case "Maintenance Préventive" ou la Fréquence
export async function updateMachinePreventiveSettings(
  machineId: string,
  settings: { maintenancePreventive?: boolean; frequence?: string }
): Promise<{ success: boolean; error?: string }> {
  const colValuesObj: Record<string, any> = {};

  if (settings.maintenancePreventive !== undefined) {
    colValuesObj.boolean_mm8tv8zy = settings.maintenancePreventive ? { checked: 'true' } : null;
  }
  if (settings.frequence) {
    colValuesObj.color_mm8t3v6z = { label: settings.frequence };
  }

  const mutation = `
    mutation UpdatePreventive($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
        itemId: machineId,
        columnValues: JSON.stringify(colValuesObj),
      },
    });
    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: res?.errors?.[0]?.message || 'Erreur Monday' };
  } catch (err: any) {
    console.error('Erreur mise à jour paramètres préventifs:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}

// 6b. Mettre à jour le statut d'une machine sur Liste des machines (5106585240)
export async function updateMachineStatus(
  machineId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  const mutation = `
    mutation UpdateMachineStatus($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
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

  try {
    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
        itemId: machineId,
        columnValues: JSON.stringify({
          color_mm8dremb: { label: newStatus },
        }),
      },
    });
    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    console.error('Erreur mise à jour statut machine:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}

// 6c. Synchronisation automatique du statut machine ("En réparation" <-> "En service") selon les tickets curatifs
async function syncMachineRepairLifecycleStatus(
  machineId: string | undefined,
  desiredStatus: 'En réparation' | 'En service',
  excludeTicketId?: string
): Promise<void> {
  if (!machineId || !/^\d+$/.test(String(machineId).trim())) return;
  try {
    const machineQuery = `
      query GetMachineStatus($ids: [ID!]) {
        items(ids: $ids) {
          id
          column_values(ids: ["color_mm8dremb"]) {
            id
            text
          }
        }
      }
    `;
    const mRes: any = await (monday as any).api(machineQuery, { variables: { ids: [machineId] } });
    const currentStatus = (mRes?.data?.items?.[0]?.column_values?.[0]?.text || '').toLowerCase();
    // Ne jamais modifier une machine explicitement "Sortie" ou "Hors service"
    if (currentStatus.includes('sortie') || currentStatus.includes('hors')) {
      return;
    }

    if (desiredStatus === 'En service') {
      const tickets = await fetchRepairTickets();
      const stillHasOpenTicket = tickets.some((t) => {
        if (excludeTicketId && String(t.id) === String(excludeTicketId)) return false;
        if (String(t.machineId || '') !== String(machineId)) return false;
        const stNorm = normalizeLabelMatch(t.status);
        const grpNorm = normalizeLabelMatch(t.groupTitle || '');
        const isClosed = stNorm.includes('repare') || grpNorm.includes('repare');
        return !isClosed;
      });
      if (stillHasOpenTicket) return;
    }

    await updateMachineStatus(machineId, desiredStatus);
  } catch (err) {
    console.warn('Erreur synchronisation statut machine depuis réparation:', err);
  }
}

// 7. Structure & Récupération des tickets de réparation curatives (Tableau 4 - 5106693291)
export interface RepairChecklistItem {
  id: string;
  label: string;
  action?: string;
  checked: boolean;
}

export interface RepairTicket {
  id: string;
  name: string;
  machineName: string;
  machineId?: string;
  groupId?: string;
  groupTitle?: string;
  date: string;
  updatedAt?: string;
  repairedDate?: string;
  type: string;
  status: string; // 'À traiter' | 'En attente de devis' | 'En cours de réparation' | 'Réparée'
  description: string;
  cost?: number;
  checklist?: RepairChecklistItem[];
  fournisseur?: string;
  numeroBon?: string;
  site?: string;
  underWarranty?: boolean;
}

export function parseRepairChecklist(desc: string): RepairChecklistItem[] {
  if (!desc) return [];
  const items: RepairChecklistItem[] = [];
  const lines = desc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Ignorer les tags techniques
    if (/^\[(Co[ûu]t|R[ée]par[ée]e\s+le)/i.test(line)) continue;

    let checked: boolean | null = null;
    let body = '';
    if (line.startsWith('☑') || line.startsWith('✅') || /^\[x\]/i.test(line)) {
      checked = true;
      body = line.replace(/^(☑|✅|\[x\])\s*/i, '').trim();
    } else if (line.startsWith('☐') || /^\[ \]/i.test(line)) {
      checked = false;
      body = line.replace(/^(☐|\[ \])\s*/i, '').trim();
    } else if (line.startsWith('•') || line.startsWith('- ')) {
      checked = false;
      body = line.replace(/^(•|-)\s*/, '').trim();
    }

    if (checked !== null && body) {
      // Ne pas transformer l'entête synthétique en tâche s'il contient ' · ' fournisseur sans ':' et que c'est une ligne courte d'en-tête
      const cleanBody = body.replace(/\s*\(Non conforme\)$/i, '').trim();
      const colonIdx = cleanBody.indexOf(':');
      if (colonIdx > 0 && colonIdx < cleanBody.length - 1) {
        const lbl = cleanBody.slice(0, colonIdx).trim();
        const act = cleanBody.slice(colonIdx + 1).trim();
        items.push({ id: `chk-${i}`, label: lbl, action: act, checked });
      } else {
        items.push({ id: `chk-${i}`, label: cleanBody, checked });
      }
    }
  }
  return items;
}

export function extractCostFromRepairData(
  desc: string,
  colValues: any[],
  boardColumns: Array<{ id: string; title: string; type: string }>
): number | undefined {
  // 1. Tag explicite [Coût: 123.45 €] dans la description
  const tagMatch = (desc || '').match(/\[Co[ûu]t\s*:\s*([\d\s.,]+)\s*€?\]/i);
  if (tagMatch) {
    const v = Number(tagMatch[1].replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isNaN(v)) return v;
  }

  // 2. Recherche sur d'éventuelles colonnes existantes Coût / Montant / Prix sur le tableau Monday
  for (const colMeta of boardColumns) {
    const tNorm = normalizeColMatch(colMeta.title || '');
    if (
      tNorm.includes('cout') ||
      tNorm.includes('montant') ||
      tNorm.includes('prix') ||
      tNorm.includes('facture') ||
      tNorm.includes('tarif')
    ) {
      const valObj = colValues?.find((c: any) => c.id === colMeta.id);
      if (valObj?.text) {
        const numStr = String(valObj.text).replace(/[^\d.,-]/g, '').replace(',', '.');
        const v = Number(numStr);
        if (numStr && !Number.isNaN(v)) return v;
      }
    }
  }

  // 3. Mention libre dans description ex: "Montant : 250 € HT"
  const freeMatch = (desc || '').match(/(?:co[ûu]t|montant|facture|total\s*ht)\s*[:\-]?\s*([\d\s.,]+)\s*€/i);
  if (freeMatch) {
    const v = Number(freeMatch[1].replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isNaN(v)) return v;
  }

  return undefined;
}

export function extractRepairedDate(desc: string, status: string, groupTitle: string | undefined, updatedAt?: string): string | undefined {
  const tagMatch = (desc || '').match(/\[R[ée]par[ée]e\s+le\s+(\d{4}-\d{2}-\d{2})\]/i);
  if (tagMatch) return tagMatch[1];

  const isRepaired =
    normalizeLabelMatch(status).includes('repare') ||
    normalizeLabelMatch(groupTitle || '').includes('repare');
  if (isRepaired && updatedAt) {
    return updatedAt.slice(0, 10);
  }
  return undefined;
}

export async function fetchRepairTickets(): Promise<RepairTicket[]> {
  const query = `
    query GetRepairs($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
        items_page(limit: 500) {
          items {
            id
            name
            updated_at
            group {
              id
              title
            }
            column_values {
              id
              text
              value
              ... on BoardRelationValue {
                linked_item_ids
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.REPARATION_MACHINES] },
    });

    const boardColumns: Array<{ id: string; title: string; type: string }> =
      res?.data?.boards?.[0]?.columns || [];
    const items = res?.data?.boards?.[0]?.items_page?.items || [];

    const findColTextByTitle = (colValues: any[], matchAny: string[]) => {
      for (const cMeta of boardColumns) {
        const norm = normalizeColMatch(cMeta.title || '');
        if (matchAny.some((m) => norm.includes(m))) {
          const val = colValues?.find((cv: any) => cv.id === cMeta.id)?.text || '';
          if (val) return val;
        }
      }
      return '';
    };

    return items.map((it: any) => {
      const colValues = it.column_values || [];
      const getCol = (id: string) => colValues.find((c: any) => c.id === id)?.text || '';
      const getDateVal = (id: string) => {
        const col = colValues.find((c: any) => c.id === id);
        if (col?.value) {
          try {
            const parsed = JSON.parse(col.value);
            if (parsed?.date) return parsed.date;
          } catch {}
        }
        return col?.text || '';
      };

      const dateStr = getDateVal('date_mm8g4vq6');
      const machineRelCol = colValues.find((c: any) => c.id === 'board_relation_mm8gc4mh');
      const machineRel = machineRelCol?.text || '';
      let linkedMachineIds: string[] = Array.isArray(machineRelCol?.linked_item_ids)
        ? machineRelCol.linked_item_ids.map(String)
        : [];
      if (linkedMachineIds.length === 0 && machineRelCol?.value) {
        try {
          const parsedRel = JSON.parse(machineRelCol.value);
          if (Array.isArray(parsedRel?.linkedPulseIds)) {
            linkedMachineIds = parsedRel.linkedPulseIds.map((p: any) => String(p?.linkedPulseId || '')).filter(Boolean);
          }
        } catch {}
      }
      const statusStr = getCol('color_mm8vp2nd') || 'À traiter';
      const desc = getCol('text_mm8vhwst');
      const updatedAt = it.updated_at ? String(it.updated_at) : undefined;
      const repairedDate = extractRepairedDate(desc, statusStr, it.group?.title, updatedAt);
      const cost = extractCostFromRepairData(desc, colValues, boardColumns);
      const checklist = parseRepairChecklist(desc);
      const fournisseur = findColTextByTitle(colValues, ['fournisseur', 'prestataire']);
      const numeroBon = findColTextByTitle(colValues, ['numero bon', 'n bon', 'ordre de service']);
      const site = findColTextByTitle(colValues, ['site']);
      const warrantyText = findColTextByTitle(colValues, ['garantie']);
      const underWarranty =
        warrantyText === 'v' ||
        warrantyText.toLowerCase().includes('oui') ||
        warrantyText.toLowerCase().includes('true') ||
        desc.toLowerCase().includes('sous garantie');

      return {
        id: it.id,
        name: it.name,
        machineName: machineRel || it.name,
        machineId: linkedMachineIds[0],
        groupId: it.group?.id,
        groupTitle: it.group?.title,
        date: dateStr,
        updatedAt,
        repairedDate,
        type: getCol('color_mm8gs7c7') || 'Curative',
        status: statusStr,
        description: desc,
        cost,
        checklist,
        fournisseur: fournisseur || undefined,
        numeroBon: numeroBon || undefined,
        site: site || undefined,
        underWarranty,
      };
    });
  } catch (err) {
    console.warn('Erreur lors du chargement des réparations:', err);
    return [];
  }
}

export async function moveRepairItemToGroup(
  ticketId: string,
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res: any = await (monday as any).api(
      `mutation MoveRepairGroup($itemId: ID!, $groupId: String!) {
        move_item_to_group(item_id: $itemId, group_id: $groupId) {
          id
        }
      }`,
      {
        variables: {
          itemId: ticketId,
          groupId,
        },
      }
    );
    if (res?.data?.move_item_to_group?.id) {
      return { success: true };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur déplacement groupe' };
  }
}

// 9. Reporter / Déplacer un passage de planning (Tableau Planning 5106585296)
export async function reschedulePlanningEvent(
  eventId: string,
  newFromDate: string,
  newToDate: string
): Promise<{ success: boolean; error?: string }> {
  const mutation = `
    mutation Reschedule($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: '5106585296',
        itemId: eventId,
        columnValues: JSON.stringify({
          timerange_mm8gy9t0: { from: newFromDate, to: newToDate },
        }),
      },
    });

    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: res?.errors?.[0]?.message || 'Erreur Monday' };
  } catch (err: any) {
    console.error('Erreur report événement planning:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface RepairBoardColumnMeta {
  id: string;
  title: string;
  type: string;
  labels: string[];
}

export interface RepairBoardMeta {
  fileColumnId?: string;
  preferredTypeLabel: string;
  columnsById: Record<string, RepairBoardColumnMeta>;
  inRepairGroupId?: string;
  repairedGroupId?: string;
}

function formatMondayError(errOrRes: any): string {
  const errors =
    errOrRes?.data?.errors ||
    errOrRes?.errors ||
    (Array.isArray(errOrRes?.data) ? errOrRes.data : undefined);
  if (Array.isArray(errors) && errors.length > 0) {
    const details = errors
      .map((e: any) => {
        const msg = e?.message || 'Erreur GraphQL';
        const errData = e?.extensions?.error_data
          ? ` (${JSON.stringify(e.extensions.error_data)})`
          : e?.extensions?.code
          ? ` [${e.extensions.code}]`
          : '';
        return `${msg}${errData}`;
      })
      .join(' · ');
    return details;
  }
  if (errOrRes?.data?.error_message) return String(errOrRes.data.error_message);
  if (errOrRes?.message && errOrRes?.data && typeof errOrRes.data === 'object') {
    const extra = JSON.stringify(errOrRes.data);
    if (extra && extra !== '{}') return `${errOrRes.message} — ${extra.slice(0, 300)}`;
  }
  return errOrRes?.message || 'Erreur Monday inconnue';
}

function extractLabelsFromSettings(settingsStr?: string): string[] {
  if (!settingsStr) return [];
  try {
    const settings = JSON.parse(settingsStr);
    const rawLabels = settings?.labels || {};
    return Object.values(rawLabels)
      .map((v: any) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object' && typeof v.name === 'string') return v.name;
        return '';
      })
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeLabelMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pickBestMatchingLabel(desired: string, available: string[]): string {
  if (!available || available.length === 0) return desired;
  const targetNorm = normalizeLabelMatch(desired);
  const exact = available.find((l) => normalizeLabelMatch(l) === targetNorm);
  if (exact) return exact;
  const partial = available.find(
    (l) => normalizeLabelMatch(l).includes(targetNorm) || targetNorm.includes(normalizeLabelMatch(l))
  );
  return partial || desired;
}

// 10. Inspecter les colonnes et groupes du tableau Réparations (5106693291) : colonne Fichiers, libellés & groupes Machine en réparation / Machine Réparé
export async function fetchRepairBoardMeta(): Promise<RepairBoardMeta> {
  const query = `
    query GetRepairBoardMeta($boardId: [ID!]) {
      boards(ids: $boardId) {
        groups {
          id
          title
        }
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.REPARATION_MACHINES] },
    });
    const board = res?.data?.boards?.[0];
    const columns: any[] = board?.columns || [];
    const groups: any[] = board?.groups || [];
    const columnsById: Record<string, RepairBoardColumnMeta> = {};

    for (const col of columns) {
      columnsById[col.id] = {
        id: col.id,
        title: col.title || '',
        type: col.type || '',
        labels: extractLabelsFromSettings(col.settings_str),
      };
    }

    const fileCol = columns.find((c) => c.type === 'file');

    let inRepairGroupId: string | undefined;
    let repairedGroupId: string | undefined;
    for (const g of groups) {
      const normTitle = normalizeLabelMatch(g.title || '');
      if (!inRepairGroupId && normTitle.includes('en reparation')) {
        inRepairGroupId = String(g.id);
      } else if (!repairedGroupId && normTitle.includes('repare') && !normTitle.includes('en reparation')) {
        repairedGroupId = String(g.id);
      }
    }

    let preferredTypeLabel = 'Curative';
    const typeLabels = columnsById['color_mm8gs7c7']?.labels || [];
    if (typeLabels.length > 0) {
      const supplierLabel = typeLabels.find((l) => /fournisseur|externe|sav/i.test(l));
      preferredTypeLabel = supplierLabel || pickBestMatchingLabel('Curative', typeLabels);
    }

    return {
      fileColumnId: fileCol?.id,
      preferredTypeLabel,
      columnsById,
      inRepairGroupId,
      repairedGroupId,
    };
  } catch (err) {
    console.warn('Erreur lecture métadonnées tableau Réparations:', err);
    return { preferredTypeLabel: 'Curative', columnsById: {} };
  }
}

export interface SupplierInterventionSubmission {
  order: ParsedSupplierOrder;
  machineId?: string;
  machineName: string;
  existingTicketId?: string;
  finalStatus?: 'Réparée' | 'En cours de réparation' | 'En attente de devis' | 'À traiter';
}

// 11. Enregistrer un acte d'intervention fournisseur (PDF) dans Réparation machines (5106693291) + Machine (5106585240)
export async function submitSupplierIntervention(
  submission: SupplierInterventionSubmission
): Promise<{ success: boolean; id?: string; fileColumnId?: string; error?: string }> {
  const { order, machineId, machineName, existingTicketId } = submission;
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(order.date)
    ? order.date
    : new Date().toISOString().split('T')[0];
  const rawTargetStatus = submission.finalStatus || order.suggestedStatus || 'Réparée';

  const meta = await fetchRepairBoardMeta();
  const repairExtraCols = await ensureHubBoardColumns(MAINTENANCE_BOARD_IDS.REPARATION_MACHINES, REPAIR_HUB_SPECS);
  const hasColMeta = Object.keys(meta.columnsById).length > 0;

  // Résoudre le statut réel existant sur la colonne color_mm8vp2nd
  const statusLabels = meta.columnsById['color_mm8vp2nd']?.labels || [];
  const resolvedStatus = pickBestMatchingLabel(rawTargetStatus, statusLabels);
  const isTargetRepaired = normalizeLabelMatch(resolvedStatus).includes('repare');
  const targetGroupId = isTargetRepaired ? meta.repairedGroupId : meta.inRepairGroupId;

  // Synthèse lisible et essentielle pour la colonne Description panne / Action (le détail complet SAP va dans le fil Monday)
  const conciseHeader = [
    order.supplierName || 'Fournisseur externe',
    order.underWarranty ? 'Sous garantie' : '',
    order.clientAccount ? `Site : ${order.clientAccount}` : '',
    order.replacedParts.length > 0 ? `${order.replacedParts.length} pièce(s) remplacée(s)` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const costTag =
    order.totalHT !== undefined && !Number.isNaN(Number(order.totalHT))
      ? `[Coût: ${Number(order.totalHT).toFixed(2)} €]`
      : order.underWarranty
      ? '[Coût: 0.00 €]'
      : '';
  const repairedTag = isTargetRepaired ? `[Réparée le ${formattedDate}]` : '';

  const mainNote =
    order.technicianNotes?.trim() ||
    order.damageSummary?.trim() ||
    (order.replacedParts.length > 0
      ? order.replacedParts.map((p) => `${p.description} (x${p.quantity})`).join(', ')
      : '');

  const descriptionText = [conciseHeader, mainNote, costTag, repairedTag]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1200);

  const columnValues: Record<string, any> = {};

  if (!hasColMeta || meta.columnsById['color_mm8gs7c7']) {
    columnValues.color_mm8gs7c7 = { label: meta.preferredTypeLabel };
  }
  if (!hasColMeta || meta.columnsById['date_mm8g4vq6']) {
    columnValues.date_mm8g4vq6 = { date: formattedDate };
  }
  if (!hasColMeta || meta.columnsById['color_mm8vp2nd']) {
    columnValues.color_mm8vp2nd = { label: resolvedStatus };
  }
  if (!hasColMeta || meta.columnsById['text_mm8vhwst']) {
    const descColType = meta.columnsById['text_mm8vhwst']?.type;
    columnValues.text_mm8vhwst =
      descColType === 'long_text' ? { text: descriptionText } : descriptionText;
  }
  if (machineId && /^\d+$/.test(String(machineId).trim()) && (!hasColMeta || meta.columnsById['board_relation_mm8gc4mh'])) {
    columnValues.board_relation_mm8gc4mh = { item_ids: [Number(machineId)] };
  }
  if (repairExtraCols.fournisseur && order.supplierName?.trim()) {
    columnValues[repairExtraCols.fournisseur] = order.supplierName.trim();
  }
  if (repairExtraCols.numeroBon && order.orderNumber?.trim()) {
    columnValues[repairExtraCols.numeroBon] = order.orderNumber.trim();
  }
  if (repairExtraCols.sousGarantie) {
    columnValues[repairExtraCols.sousGarantie] = order.underWarranty ? { checked: 'true' } : null;
  }
  if (repairExtraCols.site && order.clientAccount?.trim()) {
    columnValues[repairExtraCols.site] = order.clientAccount.trim();
  }
  if (repairExtraCols.piecesRemplacees && order.replacedParts.length > 0) {
    columnValues[repairExtraCols.piecesRemplacees] = {
      text: order.replacedParts
        .map((p) => `• ${p.articleNumber ? `${p.articleNumber} — ` : ''}${p.description} (Qté : ${p.quantity} ${p.unit})`)
        .join('\n'),
    };
  }

  let targetTicketId: string | undefined = existingTicketId;

  try {
    if (existingTicketId) {
      const updateMutation = `
        mutation UpdateRepairFromSupplier($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues, create_labels_if_missing: true) {
            id
          }
        }
      `;
      const res: any = await (monday as any).api(updateMutation, {
        variables: {
          boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
          itemId: existingTicketId,
          columnValues: JSON.stringify(columnValues),
        },
      });
      if (!res?.data?.change_multiple_column_values?.id) {
        return { success: false, error: formatMondayError(res) };
      }
      targetTicketId = res.data.change_multiple_column_values.id;
      if (targetTicketId && targetGroupId) {
        await moveRepairItemToGroup(targetTicketId, targetGroupId);
      }
    } else {
      const itemTitle = `${order.supplierName || 'Fournisseur'} #${order.orderNumber || formattedDate} - ${machineName}`.slice(0, 250);
      const createMutation = targetGroupId
        ? `
          mutation CreateRepairFromSupplierWithGroup($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON!) {
            create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
              id
            }
          }
        `
        : `
          mutation CreateRepairFromSupplier($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
            create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
              id
            }
          }
        `;

      const createVarsBase: Record<string, any> = {
        boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
        itemName: itemTitle,
        columnValues: JSON.stringify(columnValues),
      };
      if (targetGroupId) createVarsBase.groupId = targetGroupId;

      let createRes: any = null;
      try {
        createRes = await (monday as any).api(createMutation, {
          variables: createVarsBase,
        });
      } catch (firstErr: any) {
        // Fallback sécurisé : si une colonne optionnelle (relation ou statut) bloque, on réessaie sans board_relation puis en minimal
        console.warn('Premier essai create_item rejeté, tentative fallback:', formatMondayError(firstErr));
        const fallbackValues: Record<string, any> = { ...columnValues };
        delete fallbackValues.board_relation_mm8gc4mh;
        try {
          createRes = await (monday as any).api(createMutation, {
            variables: {
              ...createVarsBase,
              columnValues: JSON.stringify(fallbackValues),
            },
          });
        } catch (secondErr: any) {
          return { success: false, error: formatMondayError(firstErr || secondErr) };
        }
      }

      if (!createRes?.data?.create_item?.id) {
        return { success: false, error: formatMondayError(createRes) };
      }
      targetTicketId = createRes.data.create_item.id;
    }

    // Construction du compte-rendu HTML détaillé (fil d'activité Monday)
    const partsTableHtml =
      order.replacedParts.length > 0
        ? `<br><b>📦 Pièces / Matériaux utilisés (${order.replacedParts.length}) :</b><br>` +
          order.replacedParts
            .map(
              (p) =>
                `• <code>${escapeHtml(p.articleNumber)}</code> — <b>${escapeHtml(p.description)}</b> (Qté : ${escapeHtml(p.quantity)} ${escapeHtml(p.unit)})`
            )
            .join('<br>') +
          '<br>'
        : '';

    const laborHtml =
      order.laborItems.length > 0
        ? `<br><b>⏱️ Main d'œuvre &amp; déplacements :</b><br>` +
          order.laborItems
            .map((l) => `• ${escapeHtml(l.activityType)} : <b>${escapeHtml(l.total)}</b> (${escapeHtml(l.accountingFlag || 'Standard')})`)
            .join('<br>') +
          '<br>'
        : order.laborSummary
        ? `<br><b>⏱️ Temps d'intervention :</b> ${escapeHtml(order.laborSummary)}<br>`
        : '';

    const updateHtml =
      `🏭 <b>Acte d'intervention fournisseur intégré : ${escapeHtml(order.supplierName || 'Fournisseur')}</b>` +
      (order.underWarranty
        ? ` <span style="background:#DCFCE7;color:#166534;padding:2px 8px;border-radius:4px;font-weight:bold;">🛡️ SOUS GARANTIE</span>`
        : '') +
      `<br><br>` +
      `<b>📄 N° Bon d'intervention :</b> ${escapeHtml(order.orderNumber || 'Non précisé')} | <b>📅 Date :</b> ${escapeHtml(order.dateDisplay || formattedDate)}<br>` +
      `<b>🔩 Machine :</b> ${escapeHtml(machineName)}${order.equipmentName ? ` (${escapeHtml(order.equipmentName)})` : ''}<br>` +
      (order.serialNumber ? `<b>🏷️ N° de série :</b> ${escapeHtml(order.serialNumber)}${order.articleNumber ? ` · Réf. article : ${escapeHtml(order.articleNumber)}` : ''}<br>` : '') +
      (order.clientAccount ? `<b>📍 Site d'intervention :</b> ${escapeHtml(order.clientAccount)}${order.siteAddress ? ` — ${escapeHtml(order.siteAddress)}` : ''}<br>` : '') +
      (order.technicianName ? `<b>👷 Technicien fournisseur :</b> ${escapeHtml(order.technicianName)}<br>` : '') +
      `<b>📌 Statut ticket :</b> ${escapeHtml(resolvedStatus)}<br>` +
      (order.totalHT !== undefined && !Number.isNaN(Number(order.totalHT))
        ? `<b>💶 Coût HT :</b> ${Number(order.totalHT).toFixed(2)} €${order.totalTTC ? ` (${Number(order.totalTTC).toFixed(2)} € TTC)` : ''}<br>`
        : '') +
      (order.damageSummary ? `<br><b>🔎 Analyse / Diagnostic :</b><br>${escapeHtml(order.damageSummary)}<br>` : '') +
      partsTableHtml +
      laborHtml +
      (order.technicianNotes
        ? `<br><div style="background:#F0F9FF;border-left:4px solid #0284C7;padding:8px 12px;"><b>📝 Compte-rendu du technicien :</b><br>${escapeHtml(order.technicianNotes)}</div>`
        : '') +
      (order.customerSignature || order.technicianSignature
        ? `<br><b>✍️ Signatures :</b> Client : ${escapeHtml(order.customerSignature || '—')} | Tech : ${escapeHtml(order.technicianSignature || '—')}`
        : '');

    if (targetTicketId) {
      try {
        await (monday as any).api(
          `
          mutation PostSupplierRepairUpdate($itemId: ID!, $body: String!) {
            create_update(item_id: $itemId, body: $body) {
              id
            }
          }
        `,
          {
            variables: {
              itemId: targetTicketId,
              body: updateHtml,
            },
          }
        );
      } catch (updateErr) {
        console.warn('Erreur post compte-rendu sur ticket réparation:', updateErr);
      }
    }

    // Publication miroir dans l'historique de la machine elle-même (Tableau 5106585240)
    // Synchroniser automatiquement le statut de la machine dans Liste des machines (5106585240)
    if (machineId && /^\d+$/.test(String(machineId).trim())) {
      await syncMachineRepairLifecycleStatus(
        machineId,
        isTargetRepaired ? 'En service' : 'En réparation',
        targetTicketId
      );
      try {
        await (monday as any).api(
          `
          mutation PostSupplierMachineUpdate($itemId: ID!, $body: String!) {
            create_update(item_id: $itemId, body: $body) {
              id
            }
          }
        `,
          {
            variables: {
              itemId: machineId,
              body: updateHtml,
            },
          }
        );
      } catch (machineUpdateErr) {
        console.warn('Erreur post historique fournisseur sur machine:', machineUpdateErr);
      }
    }

    return {
      success: true,
      id: targetTicketId,
      fileColumnId: meta.fileColumnId,
    };
  } catch (err: any) {
    console.error('Erreur intégration bon fournisseur:', err);
    return { success: false, error: formatMondayError(err) };
  }
}

export interface TicketUpdateItem {
  id: string;
  textBody: string;
  createdAt: string;
  creatorName: string;
}

// 12. Lire les commentaires / comptes-rendus d'activité d'un ticket Monday
export async function fetchTicketUpdates(ticketId: string): Promise<TicketUpdateItem[]> {
  if (!ticketId) return [];
  const query = `
    query GetTicketUpdates($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        updates(limit: 20) {
          id
          text_body
          created_at
          creator {
            name
          }
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { itemIds: [ticketId] },
    });
    const updates = res?.data?.items?.[0]?.updates || [];
    return updates.map((u: any) => ({
      id: String(u.id),
      textBody: u.text_body || '',
      createdAt: u.created_at || '',
      creatorName: u.creator?.name || 'Système Monday',
    }));
  } catch (err) {
    console.warn('Erreur lecture updates ticket:', err);
    return [];
  }
}

// ============================================================================
// 13. CHECKLIST INTERACTIVE SUR RÉPARATION + COÛT + AUTO-PASSAGE À CONFORME
// ============================================================================

export function serializeRepairChecklistDescription(
  originalDesc: string,
  checklist: RepairChecklistItem[],
  options?: { cost?: number; repairedDate?: string }
): string {
  const existingLines = (originalDesc || '').split('\n');
  const preservedPrefixLines = existingLines.filter((raw) => {
    const l = raw.trim();
    if (!l) return false;
    if (/^(☑|✅|\[x\]|☐|\[ \]|•|- )/i.test(l)) return false;
    if (/^\[(Co[ûu]t|R[ée]par[ée]e\s+le)/i.test(l)) return false;
    return true;
  });

  const checklistLines = checklist.map((item) => {
    const icon = item.checked ? '☑' : '☐';
    return item.action ? `${icon} ${item.label} : ${item.action}` : `${icon} ${item.label}`;
  });

  const existingCostMatch = (originalDesc || '').match(/\[Co[ûu]t\s*:\s*([\d\s.,]+)\s*€?\]/i);
  const resolvedCost =
    options && 'cost' in options
      ? options.cost
      : existingCostMatch
      ? Number(existingCostMatch[1].replace(/\s+/g, '').replace(',', '.'))
      : undefined;

  const metaLines: string[] = [];
  if (resolvedCost !== undefined && !Number.isNaN(resolvedCost)) {
    metaLines.push(`[Coût: ${resolvedCost.toFixed(2)} €]`);
  }
  if (options?.repairedDate) {
    metaLines.push(`[Réparée le ${options.repairedDate}]`);
  }

  return [...preservedPrefixLines, ...checklistLines, ...metaLines].join('\n').trim();
}

export async function saveRepairChecklistAndProgress(
  ticket: RepairTicket,
  updatedChecklist: RepairChecklistItem[],
  options?: { cost?: number }
): Promise<{ success: boolean; autoCompleted?: boolean; newStatus?: string; newDescription?: string; error?: string }> {
  try {
    const allChecked = updatedChecklist.length > 0 && updatedChecklist.every((c) => c.checked);
    const todayIso = new Date().toISOString().split('T')[0];
    const newDescription = serializeRepairChecklistDescription(ticket.description, updatedChecklist, {
      cost: options?.cost ?? ticket.cost,
      repairedDate: allChecked ? ticket.repairedDate || todayIso : undefined,
    });

    const meta = await fetchRepairBoardMeta();
    const statusLabels = meta.columnsById['color_mm8vp2nd']?.labels || [];
    const currentlyRepaired = normalizeLabelMatch(ticket.status).includes('repare');
    let targetStatus = ticket.status;
    if (allChecked) {
      targetStatus = pickBestMatchingLabel('Réparée', statusLabels);
    } else if (currentlyRepaired) {
      targetStatus = pickBestMatchingLabel('En cours de réparation', statusLabels);
    }

    const colValues: Record<string, any> = {};
    const descColType = meta.columnsById['text_mm8vhwst']?.type;
    colValues.text_mm8vhwst = descColType === 'long_text' ? { text: newDescription } : newDescription;
    if (targetStatus !== ticket.status || allChecked) {
      colValues.color_mm8vp2nd = { label: targetStatus };
    }

    // Si une colonne Coût existe déjà sur le tableau, la synchroniser aussi
    if (options?.cost !== undefined && !Number.isNaN(options.cost)) {
      for (const [colId, colMeta] of Object.entries(meta.columnsById)) {
        const norm = normalizeColMatch(colMeta.title || '');
        if (norm.includes('cout') || norm.includes('montant') || norm.includes('prix')) {
          if (colMeta.type === 'numbers' || colMeta.type === 'numeric') {
            colValues[colId] = options.cost;
            break;
          }
        }
      }
    }

    const mutation = `
      mutation UpdateRepairChecklist($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues, create_labels_if_missing: true) {
          id
        }
      }
    `;

    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
        itemId: ticket.id,
        columnValues: JSON.stringify(colValues),
      },
    });

    if (!res?.data?.change_multiple_column_values?.id) {
      return { success: false, error: formatMondayError(res) };
    }

    if (allChecked && !currentlyRepaired) {
      if (meta.repairedGroupId) {
        await moveRepairItemToGroup(ticket.id, meta.repairedGroupId);
      }
      await syncMachineRepairLifecycleStatus(ticket.machineId, 'En service', ticket.id);
    } else if (!allChecked && currentlyRepaired) {
      if (meta.inRepairGroupId) {
        await moveRepairItemToGroup(ticket.id, meta.inRepairGroupId);
      }
      await syncMachineRepairLifecycleStatus(ticket.machineId, 'En réparation', ticket.id);
    }

    return {
      success: true,
      autoCompleted: allChecked,
      newStatus: targetStatus,
      newDescription,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur mise à jour checklist' };
  }
}

export async function updateRepairCost(
  ticket: RepairTicket,
  newCost: number | undefined
): Promise<{ success: boolean; newDescription?: string; error?: string }> {
  try {
    const checklist = ticket.checklist && ticket.checklist.length > 0 ? ticket.checklist : parseRepairChecklist(ticket.description);
    const newDescription = serializeRepairChecklistDescription(ticket.description, checklist, {
      cost: newCost,
      repairedDate: ticket.repairedDate,
    });
    const meta = await fetchRepairBoardMeta();
    const descColType = meta.columnsById['text_mm8vhwst']?.type;
    const colValues: Record<string, any> = {
      text_mm8vhwst: descColType === 'long_text' ? { text: newDescription } : newDescription,
    };

    const res: any = await (monday as any).api(
      `mutation UpdateRepairCost($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
        }
      }`,
      {
        variables: {
          boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
          itemId: ticket.id,
          columnValues: JSON.stringify(colValues),
        },
      }
    );

    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true, newDescription };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur mise à jour coût' };
  }
}

// ============================================================================
// 14. CLÔTURE ANNUELLE MAINTENANCE PRÉVENTIVE (ARCHIVAGE + REMISE À 0 MOIS)
// ============================================================================

export async function clearMachinePreventiveMonths(
  machineIds: string[]
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (machineIds.length === 0) return { success: true, updatedCount: 0 };

  const resetPayload: Record<string, null> = {};
  for (const col of Object.values(MONTH_COLUMN_IDS)) {
    resetPayload[col.id] = null;
  }
  const serialized = JSON.stringify(resetPayload);

  let updatedCount = 0;
  try {
    for (const mId of machineIds) {
      await (monday as any).api(
        `mutation ResetYearMonths($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
            id
          }
        }`,
        {
          variables: {
            boardId: MAINTENANCE_BOARD_IDS.LISTE_MACHINES,
            itemId: mId,
            columnValues: serialized,
          },
        }
      );
      updatedCount++;
    }
    return { success: true, updatedCount };
  } catch (err: any) {
    return { success: false, updatedCount, error: err?.message || 'Erreur réinitialisation annuelle' };
  }
}

// ============================================================================
// 15. ALERTES BIDIRECTIONNELLES (ATELIER CHRISTOPHE <-> RESPONSABLES SECTEUR)
// ============================================================================

export interface MaintenanceAlertMessage {
  id: string;
  title: string;
  date: string;
  seen: boolean;
  person: string;
  machineName?: string;
  direction: 'to_atelier' | 'to_secteur' | 'other';
  senderLabel?: string;
}

export async function fetchMaintenanceAlerts(): Promise<MaintenanceAlertMessage[]> {
  const query = `
    query GetMaintenanceAlerts($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 200) {
          items {
            id
            name
            group {
              id
              title
            }
            column_values(ids: ["color_mkzat86a", "board_relation_mkwrnhwg", "date_mkwrkqy5", "boolean_mkwrnzkb"]) {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.COMMUNICATION_ANIMATRICES] },
    });
    const items = res?.data?.boards?.[0]?.items_page?.items || [];
    const mapped: MaintenanceAlertMessage[] = items.map((it: any) => {
      const getCol = (id: string) => it.column_values?.find((c: any) => c.id === id)?.text || '';
      const vuCol = it.column_values?.find((c: any) => c.id === 'boolean_mkwrnzkb');
      let seen = false;
      if (vuCol?.value) {
        try {
          seen = JSON.parse(vuCol.value)?.checked === true;
        } catch {}
      }
      if (!seen && vuCol?.text === 'v') seen = true;

      const person = getCol('color_mkzat86a');
      const clientOrMachine = getCol('board_relation_mkwrnhwg');
      const dateStr = getCol('date_mkwrkqy5') || '';
      const title = String(it.name || '');
      const titleLower = title.toLowerCase();
      const personLower = person.toLowerCase();

      let direction: MaintenanceAlertMessage['direction'] = 'other';
      if (titleLower.startsWith('[parc machines') || titleLower.startsWith('[maintenance')) {
        direction = 'to_secteur';
      } else if (
        titleLower.startsWith('[atelier') ||
        titleLower.includes('[atelier / christophe]') ||
        personLower.includes('christophe') ||
        personLower.includes('atelier')
      ) {
        direction = 'to_atelier';
      }

      return {
        id: String(it.id),
        title,
        date: dateStr,
        seen,
        person,
        machineName: clientOrMachine || undefined,
        direction,
      };
    });

    return mapped
      .filter((m) => m.direction === 'to_atelier' || m.direction === 'to_secteur')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (err) {
    console.warn('Erreur lecture alertes bidirectionnelles:', err);
    return [];
  }
}

export async function sendMaintenanceAlert(params: {
  recipientPerson: string;
  machineName?: string;
  siteName?: string;
  message: string;
  senderName?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const todayIso = new Date().toISOString().split('T')[0];
  const prefix = params.senderName ? `[Parc Machines · ${params.senderName}]` : '[Parc Machines]';
  const contextParts = [params.machineName, params.siteName].filter(Boolean).join(' · ');
  const itemTitle = `${prefix} ${contextParts ? `${contextParts} — ` : ''}${params.message}`.slice(0, 240);

  const colValues: Record<string, any> = {
    color_mkzat86a: { label: params.recipientPerson || 'Natacha THOMAS' },
    date_mkwrkqy5: { date: todayIso },
  };

  try {
    const res: any = await (monday as any).api(
      `mutation CreateCommAlert($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
          id
        }
      }`,
      {
        variables: {
          boardId: MAINTENANCE_BOARD_IDS.COMMUNICATION_ANIMATRICES,
          groupId: COMMUNICATION_GROUP_ID,
          itemName: itemTitle,
          columnValues: JSON.stringify(colValues),
        },
      }
    );
    if (res?.data?.create_item?.id) {
      return { success: true, id: String(res.data.create_item.id) };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur envoi alerte' };
  }
}

export async function markMaintenanceAlertSeen(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res: any = await (monday as any).api(
      `mutation MarkAlertVu($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
        }
      }`,
      {
        variables: {
          boardId: MAINTENANCE_BOARD_IDS.COMMUNICATION_ANIMATRICES,
          itemId,
          columnValues: JSON.stringify({ boolean_mkwrnzkb: { checked: 'true' } }),
        },
      }
    );
    if (res?.data?.change_multiple_column_values?.id) {
      return { success: true };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur acquittement alerte' };
  }
}

export async function archiveMaintenanceAlert(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res: any = await (monday as any).api(
      `mutation ArchiveMaintenanceAlert($itemId: ID!) {
        archive_item(item_id: $itemId) {
          id
        }
      }`,
      {
        variables: { itemId },
      }
    );
    if (res?.data?.archive_item?.id) {
      return { success: true };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur suppression alerte' };
  }
}

// ============================================================================
// 16. AFFECTATIONS PARC (PERSONNE / VOITURE / SITE) READ-ONLY
// ============================================================================

export interface MachineAffectation {
  machineId: string;
  machineName: string;
  machineType: string;
  status: string;
  site: string;
  personne: string;
  voiture: string;
  serialNumber: string;
}

export async function fetchMachineBoardColumnsMeta(): Promise<Record<string, string>> {
  try {
    const res: any = await (monday as any).api(
      `query GetMachineColsMeta($boardId: [ID!]) {
        boards(ids: $boardId) {
          columns {
            id
            title
          }
        }
      }`,
      { variables: { boardId: [MAINTENANCE_BOARD_IDS.LISTE_MACHINES] } }
    );
    const cols: Array<{ id: string; title: string }> = res?.data?.boards?.[0]?.columns || [];
    const map: Record<string, string> = {};
    for (const c of cols) map[c.id] = c.title;
    return map;
  } catch {
    return {};
  }
}

export function extractMachineAffectations(
  machines: any[],
  planningItems: any[],
  colTitlesById: Record<string, string>
): MachineAffectation[] {
  const getCvText = (cv: any): string => String(cv?.text || cv?.display_value || '').trim();

  const matchColByKeywords = (m: any, knownIds: string[], keywords: string[]): string => {
    for (const kId of knownIds) {
      const val = getCvText(m.column_values?.find((c: any) => c.id === kId));
      if (val) return val;
    }
    for (const cv of m.column_values || []) {
      const txt = getCvText(cv);
      if (!txt) continue;
      const titleNorm = normalizeColMatch(colTitlesById[cv.id] || '');
      if (titleNorm && keywords.some((kw) => titleNorm.includes(kw))) {
        return txt;
      }
    }
    return '';
  };

  const isVehicleLabel = (val: string): boolean => {
    const low = normalizeColMatch(val);
    if (!low) return false;
    return (
      /\b(vehicule|voiture|camion|fourgon|utilitaire|kangoo|berlingo|partner|master|trafic|jumpy|boxer|ducato)\b/.test(low) ||
      /^[a-z]{2}\s*\d{3}\s*[a-z]{2}$/.test(low)
    );
  };

  return machines.map((m) => {
    let site = matchColByKeywords(m, ['dropdown_mm8d4vj2', 'board_relation_mm8g9srf', 'dropdown_mm8gh54j'], [
      'site',
      'chantier',
      'client',
      'etablissement',
      'affectation',
      'localisation',
    ]);
    let personne = matchColByKeywords(m, ['lookup_mm8d375q'], [
      'personne',
      'utilisateur',
      'agent',
      'technicien',
      'detenteur',
      'conducteur',
      'responsable',
      'animatrice',
      'animateur',
      'attribue',
      'salarie',
    ]);
    let voiture = matchColByKeywords(m, [], [
      'voiture',
      'vehicule',
      'camion',
      'fourgon',
      'immatriculation',
      'plaque',
      'utilitaire',
    ]);

    // Si la colonne "Site d'affectation" contient un véhicule (ex: "vehicule 32"), le basculer dans Voiture
    if (!voiture && site && isVehicleLabel(site)) {
      voiture = site;
      site = 'À bord véhicule';
    }

    // Enrichir avec d'éventuelles affectations actives trouvées sur Planning (5106585296)
    const mNameNorm = normalizeColMatch(m.name || '');
    for (const ev of planningItems || []) {
      const getEvCol = (id: string) => getCvText(ev.column_values?.find((c: any) => c.id === id));
      const linkedTxt = normalizeColMatch(ev.name || '');
      if (linkedTxt && mNameNorm && (linkedTxt.includes(mNameNorm) || mNameNorm.includes(linkedTxt))) {
        const evPerson = getEvCol('text_mm8jd1am') || getEvCol('lookup_mm8d375q');
        const evSite = getEvCol('dropdown_mm8dr9jz');
        if (!personne && evPerson) personne = evPerson;
        if (!voiture && evSite && isVehicleLabel(evSite)) {
          voiture = evSite;
        } else if (!site && evSite) {
          site = evSite;
        }
      }
    }

    const machineType =
      getCvText(m.column_values?.find((c: any) => c.id === 'color_mm8t2mn5' || c.id === 'color_mm8g45e8')) ||
      matchColByKeywords(m, [], ['type', 'categorie']) ||
      'Matériel';
    const status =
      getCvText(m.column_values?.find((c: any) => c.id === 'color_mm8dremb')) || 'En service';
    const serialNumber = matchColByKeywords(m, [], ['serie', 'serial', 'immat']);

    return {
      machineId: String(m.id),
      machineName: m.name,
      machineType,
      status,
      site: site || 'Non affecté / Dépôt',
      personne: personne || 'Non attribué',
      voiture: voiture || '—',
      serialNumber: serialNumber || '',
    };
  });
}


