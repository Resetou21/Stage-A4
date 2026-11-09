import { z } from 'zod';
import { TableauCompletChantierBoard, VisitesClientsBoard, InventairesConsommablesBoard, callMondayApi, registerCacheClearCallback } from '@api/BoardSDK';
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
}

const chantiersCache = new Map<string, { time: number; data: ChantierItem[] }>();

export function clearChantiersCache() {
  chantiersCache.clear();
}
registerCacheClearCallback(clearChantiersCache);

export async function getChantiersList({ data }: { data: { firstName: string } }): Promise<ChantierItem[]> {
  const normKey = data.firstName.toLowerCase().trim();
  const cached = chantiersCache.get(normKey);
  if (cached && Date.now() - cached.time < 300000) {
    return cached.data;
  }

  const label = labelOf(data.firstName);
  if (!label) return [];

  const board = new TableauCompletChantierBoard();
  const res: ChantierItem[] = [];
  let cur: string | null | undefined = undefined;

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
  ];

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
        });
      }
      res.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } catch (e) {
      console.warn('[getChantiersList fallback error]:', e);
    }
  }

  if (res.length > 0) {
    chantiersCache.set(normKey, { time: Date.now(), data: res });
  }
  return res;
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
              [item.colId]: cleanVal ? { labels: [cleanVal] } : { labels: [] },
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

    return { 
      success: true, 
      warnings: warnings.length > 0 ? warnings : undefined 
    };
  } catch (err: any) {
    console.error('[updateChantierDetails Error]:', err);
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour du chantier' };
  }
}

