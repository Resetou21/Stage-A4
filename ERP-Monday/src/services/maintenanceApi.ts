import monday from './monday';
import type { ParsedSupplierOrder } from './supplierPdfParser';

export const MAINTENANCE_BOARD_IDS = {
  LISTE_MACHINES: '5106585240',
  REFERENTIEL_POINTS: '5107261391',
  FICHE_CONTROLE: '5107262948',
  REPARATION_MACHINES: '5106693291',
} as const;

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
  { key: 'technicien', title: 'Technicien', type: 'text', matchAny: ['technicien', 'controleur'] },
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
            resolved[spec.key] = String(createRes.data.create_column.id);
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
    const txt = (cv?.text || '').toLowerCase().trim();
    return txt.includes('v') || txt.includes('true') || txt === '1' || txt.includes('coch');
  };

  return items.map((it: any) => {
    const parsedSubitems: ReferentielSubItem[] = Array.isArray(it.subitems)
      ? it.subitems.map((sub: any) => {
          const subCols = sub.board?.columns || [];
          const subColsMap = findCategoryCols(subCols);
          return {
            id: sub.id,
            name: sub.name,
            categories: {
              controle: isColChecked(sub.column_values, subColsMap.controle),
              nettoyage: isColChecked(sub.column_values, subColsMap.nettoyage),
              usee: isColChecked(sub.column_values, subColsMap.usee),
              cassee: isColChecked(sub.column_values, subColsMap.cassee),
            },
          };
        })
      : [];

    return {
      id: it.id,
      name: it.name,
      groupTitle: it.group?.title || 'Général',
      groupId: it.group?.id || '',
      categories: {
        controle: isColChecked(it.column_values, parentColsMap.controle),
        nettoyage: isColChecked(it.column_values, parentColsMap.nettoyage),
        usee: isColChecked(it.column_values, parentColsMap.usee),
        cassee: isColChecked(it.column_values, parentColsMap.cassee),
      },
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

  // 2. Filtrage par Catégorie d'intervention si spécifiée et si des coches existent sur Monday (parent OU sous-éléments)
  if (selectedCategory && basePoints.length > 0) {
    const catLower = selectedCategory.toLowerCase();
    let matchingCat: 'controle' | 'nettoyage' | 'usee' | 'cassee' = 'controle';
    if (catLower.includes('nettoyage')) matchingCat = 'nettoyage';
    else if (catLower.includes('usée') || catLower.includes('usee')) matchingCat = 'usee';
    else if (catLower.includes('cassée') || catLower.includes('cassee') || catLower.includes('répar')) matchingCat = 'cassee';

    const anyTagged = basePoints.some(
      (p) =>
        (p.categories && p.categories[matchingCat]) ||
        (p.subitems && p.subitems.some((s) => s.categories && s.categories[matchingCat]))
    );

    if (anyTagged) {
      return basePoints
        .map((p) => {
          const parentTagged = Boolean(p.categories && p.categories[matchingCat]);
          const matchingSubitems = p.subitems?.filter((s) => s.categories && s.categories[matchingCat]);
          if (parentTagged || (matchingSubitems && matchingSubitems.length > 0)) {
            return {
              ...p,
              subitems: matchingSubitems && matchingSubitems.length > 0 ? matchingSubitems : p.subitems,
            };
          }
          return null;
        })
        .filter(Boolean) as ReferentielPoint[];
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
        const machineText = getCol('board_relation_mm8txvw9');
        const rawNote = ficheCols.noteSurDix ? getCol(ficheCols.noteSurDix) : '';
        const parsedNote = rawNote !== '' && !Number.isNaN(Number(rawNote)) ? Number(rawNote) : undefined;

        return {
          id: it.id,
          name: it.name,
          machineName: machineText || it.name,
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
      columnValuesObj[ficheCols.technicien] = submission.technicienName.trim();
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
              return customAction ? `• ${pt} : ${customAction}` : `• ${pt} (Non conforme)`;
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
      // COMMUNICATION AUTOMATIQUE VERS LE RESPONSABLE DE SECTEUR (FICHE + MACHINE)
      // =========================================================================
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
export interface RepairTicket {
  id: string;
  name: string;
  machineName: string;
  machineId?: string;
  groupId?: string;
  groupTitle?: string;
  date: string;
  type: string;
  status: string; // 'À traiter' | 'En attente de devis' | 'En cours de réparation' | 'Réparée'
  description: string;
}

export async function fetchRepairTickets(): Promise<RepairTicket[]> {
  const query = `
    query GetRepairs($boardId: [ID!]) {
      boards(ids: $boardId) {
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
          }
        }
      }
    }
  `;

  try {
    const res: any = await (monday as any).api(query, {
      variables: { boardId: [MAINTENANCE_BOARD_IDS.REPARATION_MACHINES] },
    });

    const items = res?.data?.boards?.[0]?.items_page?.items || [];
    return items.map((it: any) => {
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

      const dateStr = getDateVal('date_mm8g4vq6');
      const machineRelCol = it.column_values?.find((c: any) => c.id === 'board_relation_mm8gc4mh');
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

      return {
        id: it.id,
        name: it.name,
        machineName: machineRel || it.name,
        machineId: linkedMachineIds[0],
        groupId: it.group?.id,
        groupTitle: it.group?.title,
        date: dateStr,
        type: getCol('color_mm8gs7c7') || 'Curative',
        status: statusStr,
        description: desc,
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

// 8. Mettre à jour le statut d'un ticket de réparation (et déplacer automatiquement entre "Machine en réparation" / "Machine Réparé")
export async function updateRepairStatus(
  ticketId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  const mutation = `
    mutation UpdateRepairStatus($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  try {
    const meta = await fetchRepairBoardMeta();
    const statusLabels = meta.columnsById['color_mm8vp2nd']?.labels || [];
    const resolvedStatus = pickBestMatchingLabel(newStatus, statusLabels);

    const res: any = await (monday as any).api(mutation, {
      variables: {
        boardId: MAINTENANCE_BOARD_IDS.REPARATION_MACHINES,
        itemId: ticketId,
        columnValues: JSON.stringify({
          color_mm8vp2nd: { label: resolvedStatus },
        }),
      },
    });

    if (res?.data?.change_multiple_column_values?.id) {
      const normStatus = normalizeLabelMatch(resolvedStatus);
      const isRepaired = normStatus.includes('repare');
      const targetGroupId = isRepaired ? meta.repairedGroupId : meta.inRepairGroupId;
      if (targetGroupId) {
        await moveRepairItemToGroup(ticketId, targetGroupId);
      }
      try {
        const relRes: any = await (monday as any).api(
          `query GetTicketMachine($ids: [ID!]) {
            items(ids: $ids) {
              column_values(ids: ["board_relation_mm8gc4mh"]) {
                ... on BoardRelationValue {
                  linked_item_ids
                }
              }
            }
          }`,
          { variables: { ids: [ticketId] } }
        );
        const linkedIds: string[] = relRes?.data?.items?.[0]?.column_values?.[0]?.linked_item_ids || [];
        for (const mId of linkedIds) {
          await syncMachineRepairLifecycleStatus(
            String(mId),
            isRepaired ? 'En service' : 'En réparation',
            ticketId
          );
        }
      } catch (syncErr) {
        console.warn('Erreur synchro statut machine après maj ticket:', syncErr);
      }
      return { success: true };
    }
    return { success: false, error: formatMondayError(res) };
  } catch (err: any) {
    console.error('Erreur mise à jour statut réparation:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
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

  const mainNote =
    order.technicianNotes?.trim() ||
    order.damageSummary?.trim() ||
    (order.replacedParts.length > 0
      ? order.replacedParts.map((p) => `${p.description} (x${p.quantity})`).join(', ')
      : '');

  const descriptionText = [conciseHeader, mainNote].filter(Boolean).join('\n').slice(0, 1200);

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
      (order.damageSummary ? `<br><b>🔎 Analyse SAP (Dommage / Cause / Solution) :</b><br>${escapeHtml(order.damageSummary)}<br>` : '') +
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


