import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  CommunicationViaLesAnimatricesBoard,
  TableauCompletChantierBoard,
  VisitesClientsBoard,
  callMondayApi,
  clearBoardCache,
} from '@api/BoardSDK';

const ANIMATEURS = ['Natacha THOMAS', 'Ketty PAULIN', 'Emilie TOBIE', 'Andre LEVESQUE'] as const;
const labelOf = (firstName: string) => ANIMATEURS.find((a) => a.toLowerCase().startsWith(firstName.toLowerCase()));
const BON = 'Globalement bon';
const DAY = 86400000;
const iso = (d: Date | null | undefined) => (d && !Number.isNaN(new Date(d).getTime()) ? new Date(d).toISOString() : null);

/* ---------- Visites clients (Mode Éclair : Graphiques, KPI 344 & Satisfaction en 1s) ---------- */
export const getVisitsOverview = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Visit = { id: string; chantier: string; date: string | null; qualite: string | null };
    const empty = {
      year: new Date().getFullYear(),
      monthly: Array(12).fill(0) as number[],
      yearCount: 0,
      satTotal: null as number | null,
      satMonth: null as number | null,
      recent: [] as Visit[],
    };
    const label = labelOf(data.firstName);
    if (!label) return empty;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const res = { ...empty, year };
    let bonAll = 0, ratedAll = 0, bonMonth = 0, ratedMonth = 0;
    const board = new VisitesClientsBoard();
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const target = norm(label);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const today = now.toISOString().slice(0, 10);
    const t0 = new Date(`${today}T00:00:00.000Z`);
    const dow = (t0.getUTCDay() + 6) % 7; // 0 = lundi
    const lastMonday = new Date(t0.getTime() - (dow + 7) * DAY).toISOString().slice(0, 10);

    // Requête ultra-rapide par blocs de 500 SANS sous-éléments : équivalent direct du widget Monday (1 à 2s)
    let cur: string | null | undefined = undefined;
    do {
      const page: {
        items: Array<{ id: string; name: string; dateVisiteClient?: Date | null; qualitDeLaPrestation?: string | null; nomChantier?: { linkedItems?: { name: string }[] } | null; animateur?: { displayValue?: string | null } | null }>;
        cursor?: string | null;
      } = await board
        .items()
        .withColumns(['dateVisiteClient', 'qualitDeLaPrestation', 'nomChantier', 'animateur'])
        .where({ dateVisiteClient: { gte: from } })
        .orderBy({ column: 'dateVisiteClient', direction: 'desc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();

      for (const it of page.items) {
        const names = (it.animateur?.displayValue ?? '').split(',').map(norm);
        if (!names.includes(target)) continue;
        const d = it.dateVisiteClient ? new Date(it.dateVisiteClient) : null;
        const ok = d && !Number.isNaN(d.getTime()) ? d : null;
        const chantier = it.nomChantier?.linkedItems?.map((l) => l.name).join(', ') || it.name;
        const q = it.qualitDeLaPrestation ?? null;
        const v: Visit = { id: it.id, chantier, date: iso(ok), qualite: q };

        // Semaine dernière + cette semaine
        if (ok) {
          const day = ok.toISOString().slice(0, 10);
          if (day >= lastMonday && day <= today) res.recent.push(v);
        }

        // Visites de l'année
        const iso10 = ok ? ok.toISOString().slice(0, 10) : '';
        if (iso10 && iso10 >= from && iso10 <= to) {
          const m = Number(iso10.slice(5, 7)) - 1;
          res.monthly[m]! += 1;
          res.yearCount++;
          if (q) {
            ratedAll++; if (q === BON) bonAll++;
            if (m === month) { ratedMonth++; if (q === BON) bonMonth++; }
          }
        }
      }
      cur = page.cursor;
    } while (cur);

    res.satTotal = ratedAll ? (bonAll / ratedAll) * 100 : null;
    res.satMonth = ratedMonth ? (bonMonth / ratedMonth) * 100 : null;
    return res;
  });

/* ---------- Plans d'actions des visites (Chargés en arrière-plan sans bloquer les graphiques) ---------- */
export const getVisitsPlans = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type PlanAction = { id: string; action: string; statut: string | null; categorie: string };
    type Plan = {
      id: string;
      chantier: string;
      action: string;
      statut: string | null;
      categorie: string;
      dateVisite: string | null;
      groupTitle: string;
      groupId: string;
      actions: PlanAction[];
    };
    const empty = { plansOpen: [] as Plan[], plansClosedYear: 0 };
    const label = labelOf(data.firstName);
    if (!label) return empty;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const target = norm(label);

    // 1. Récupérer directement les sous-éléments ouverts depuis le tableau sous-éléments (1978388826)
    // Au lieu de parcourir les 1700 visites clientes du tableau parent (18 secondes), on cible les ~20 actions ouvertes en 1 requête (< 400ms)
    const qOpenSubs = `
      query GetOpenSubitems($queryParams: ItemsQuery) {
        boards(ids: [1978388826]) {
          items_page(limit: 500, query_params: $queryParams) {
            items {
              id
              name
              parent_item { id name }
              column_values(ids: ["color_mkv1tk6f", "text_mkrhcpzc", "dropdown_mkv1j4z1"]) {
                id
                text
              }
            }
          }
        }
      }
    `;

    const resOpen = await callMondayApi(qOpenSubs, {
      variables: {
        queryParams: {
          rules: [
            { column_id: 'color_mkv1tk6f', compare_value: [0, 2, 5], operator: 'any_of' },
          ],
        },
      },
    });

    const rawSubs: any[] = resOpen?.data?.boards?.[0]?.items_page?.items || resOpen?.boards?.[0]?.items_page?.items || [];
    const parentIds = Array.from(new Set(rawSubs.map((s) => s.parent_item?.id).filter(Boolean)));

    const plansOpen: Plan[] = [];
    if (parentIds.length > 0) {
      const qParents = `
        query GetParentVisits($ids: [ID!]) {
          boards(ids: [1977798116]) {
            items_page(query_params: { ids: $ids }) {
              items {
                id
                name
                group { id title }
                column_values(ids: ["date_mkrcgy18", "board_relation_mktd1vha", "lookup_mkvgpaca"]) {
                  id
                  text
                  value
                  ... on MirrorValue { display_value }
                  ... on BoardRelationValue {
                    linked_items { id name }
                  }
                }
              }
            }
          }
        }
      `;

      const resParents = await callMondayApi(qParents, { variables: { ids: parentIds } });
      const parents: any[] = resParents?.data?.boards?.[0]?.items_page?.items || resParents?.boards?.[0]?.items_page?.items || [];

      const parentMap = new Map<string, { parent: any; chantier: string; dateVisite: string | null }>();
      for (const p of parents) {
        const cvMap = new Map<string, any>((p.column_values || []).map((c: any) => [c.id, c]));
        const animVal = cvMap.get('lookup_mkvgpaca')?.display_value || cvMap.get('lookup_mkvgpaca')?.text || '';
        const anims = animVal.split(',').map(norm);
        if (anims.includes(target)) {
          const chantier = cvMap.get('board_relation_mktd1vha')?.linked_items?.map((l: any) => l.name).join(', ') || p.name;
          const dateVisite = cvMap.get('date_mkrcgy18')?.text || null;
          parentMap.set(String(p.id), { parent: p, chantier, dateVisite });
        }
      }

      const subsByParent = new Map<string, PlanAction[]>();
      for (const s of rawSubs) {
        const pid = String(s.parent_item?.id || '');
        if (!pid || !parentMap.has(pid)) continue;
        const cvMap = new Map<string, any>((s.column_values || []).map((c: any) => [c.id, c]));
        const arr = subsByParent.get(pid) || [];
        arr.push({
          id: String(s.id),
          action: (cvMap.get('text_mkrhcpzc')?.text || s.name || '').trim(),
          statut: cvMap.get('color_mkv1tk6f')?.text || null,
          categorie: cvMap.get('dropdown_mkv1j4z1')?.text || '',
        });
        subsByParent.set(pid, arr);
      }

      for (const [pid, actions] of subsByParent.entries()) {
        const pInfo = parentMap.get(pid)!;
        plansOpen.push({
          id: pid,
          chantier: pInfo.chantier,
          action: actions.map((a) => a.action).filter(Boolean).join(' • '),
          statut: actions.length === 1 ? actions[0].statut : actions.some((a) => a.statut === 'En cours') ? 'En cours' : actions[0].statut,
          categorie: Array.from(new Set(actions.map((a) => a.categorie).filter(Boolean))).join(', '),
          dateVisite: pInfo.dateVisite,
          groupTitle: pInfo.parent.group?.title || 'Visites clients',
          groupId: pInfo.parent.group?.id || 'topics',
          actions,
        });
      }
    }

    // 2. Compter les actions clôturées dans le mois courant
    const qClosed = `
      query GetClosedThisMonth($queryParams: ItemsQuery) {
        boards(ids: [1978388826]) {
          items_page(limit: 50, query_params: $queryParams) {
            items {
              id
            }
          }
        }
      }
    `;

    let plansClosedYear = 0;
    try {
      const resClosed = await callMondayApi(qClosed, {
        variables: {
          queryParams: {
            rules: [
              { column_id: 'color_mkv1tk6f', compare_value: [1], operator: 'any_of' },
              { column_id: 'date_mkwrr950', compare_value: [monthStart], operator: 'greater_than_or_equals' },
            ],
          },
        },
      });
      const closedSubs = resClosed?.data?.boards?.[0]?.items_page?.items || resClosed?.boards?.[0]?.items_page?.items || [];
      plansClosedYear = closedSubs.length;
    } catch (e) {
      console.warn('Erreur comptage plans fermés:', e);
    }

    return { plansOpen, plansClosedYear };
  });

/* ---------- Visites clients (Fonction combinée complète) ---------- */
export const getVisitsDashboard = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const [overview, plans] = await Promise.all([
      getVisitsOverview({ data }),
      getVisitsPlans({ data }),
    ]);
    return {
      ...overview,
      plansOpen: plans.plansOpen,
      plansClosedYear: plans.plansClosedYear,
    };
  });

/* ---------- Qualité des chantiers (Tableau complet chantier) ---------- */
export const getChantierQuality = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Q = { id: string; chantier: string; date: string | null; resultat: string | null };
    const out = { stars: { s3: 0, s2: 0, s1: 0, s0: 0 }, insatisfaits: [] as Q[], controle2Mois: [] as Q[], nonVus11Mois: [] as Q[] };
    const label = labelOf(data.firstName);
    if (!label) return out;
    const elevenMonthsAgo = new Date(); elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    const board = new TableauCompletChantierBoard();
    let cur: string | null | undefined = undefined;
    do {
      const page = await board
        .items()
        .withColumns(['c1', 'c2', 'c3', 'rsultatDernierContrle', 'dernierContrle', 'dernierContrle1', 'column3', 'column2', 'column1', 'column', 'alerte2', 'alerte3'])
        .where({ animateur: label, group: 'topics' })
        .orderBy({ column: 'name', direction: 'asc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();
      for (const it of page.items) {
        const raw = it.dernierContrle ?? it.dernierContrle1 ?? null;
        const d = raw && !Number.isNaN(new Date(raw).getTime()) ? new Date(raw) : null;
        const q: Q = { id: it.id, chantier: it.name, date: iso(d), resultat: it.rsultatDernierContrle ?? it.c1 ?? null };
        const ctrl = [it.c1, it.c2, it.c3].filter((c): c is NonNullable<typeof c> => !!c);
        // Cartes niveau client : colonne 3🌟 / 2🌟 / 1🌟 / 🙁 = 1 (groupe « Liste des chantiers en cours »)
        const f = [it.column3, it.column2, it.column1, it.column].map((v) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(String(v).replace(',', '.'))));
        if (f.some((v) => v !== null)) {
          if (f[0] === 1) out.stars.s3++;
          if (f[1] === 1) out.stars.s2++;
          if (f[2] === 1) out.stars.s1++;
          if (f[3] === 1) out.stars.s0++;
        } else {
          // Secours si monday ne transmet pas les formules : reproduction exacte des formules Monday
          // 3🌟 = C1 bon AND C2 bon AND C3 bon
          // 2🌟 = C1 bon AND C2 bon (et non 3🌟)
          // 1🌟 = C1 bon (et non 2🌟 ni 3🌟)
          // 🙁 = C1 'Bases non respectées' ou 'Plan d'action urgent'
          const c1Bon = it.c1 === BON;
          const c2Bon = it.c2 === BON;
          const c3Bon = it.c3 === BON;

          if (c1Bon && c2Bon && c3Bon) {
            out.stars.s3++;
          } else if (c1Bon && c2Bon) {
            out.stars.s2++;
          } else if (c1Bon) {
            out.stars.s1++;
          } else if (it.c1 === 'Bases non respectées' || it.c1 === "Plan d'action urgent") {
            out.stars.s0++;
          }
        }
        // Alertes qualité : formules monday « Alerte 2 » (> 0) et « Alerte 3 » (= 1)
        const fnum = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(n) ? null : n; };
        const a2 = fnum(it.alerte2);
        const a3 = fnum(it.alerte3);
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const isBad = (c: unknown) => c === 'Bases non respectées' || c === "Plan d'action urgent";
        // Alerte 2 : Clients insatisfaits (3 contrôles de suite non satisfaisants = C1, C2 et C3 mauvais)
        const has3Bad = isBad(it.c1) && isBad(it.c2) && isBad(it.c3);
        const isClientInsatisfait3 = (a2 !== null && a2 > 0) || has3Bad;

        if (isClientInsatisfait3) out.insatisfaits.push(q);

        // Alerte 3 : Dernier contrôle non satisfaisant (> 2 mois sans nouvelle vérification)
        const isDernierControleBad = isBad(it.c1) || (Boolean(it.rsultatDernierContrle) && it.rsultatDernierContrle !== BON);
        if (a3 === 1 || (isDernierControleBad && d && d.getTime() <= twoMonthsAgo.getTime())) {
          out.controle2Mois.push(q);
        }
        // Dernier contrôle datant de plus de 11 mois
        if (d && d.getTime() <= elevenMonthsAgo.getTime()) out.nonVus11Mois.push(q);
      }
      cur = page.cursor;
    } while (cur);
    return out;
  });

/* ---------- Communication via les animatrices ---------- */
export const getCommunications = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Msg = { id: string; texte: string; date: string | null; client: string };
    const label = labelOf(data.firstName);
    if (!label || label === 'Andre LEVESQUE') return { messages: [] as Msg[] };
    const board = new CommunicationViaLesAnimatricesBoard();
    const messages: Msg[] = [];
    let cur: string | null | undefined = undefined;
    do {
      const page = await board
        .items()
        .withColumns(['vu', 'date', 'clientConcern', 'personneConcerne'])
        .where({ group: 'group_mkzb19j1', personneConcerne: label, vu: false })
        .orderBy({ column: 'date', direction: 'asc' })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();
      for (const it of page.items) {
        if (it.vu === true) continue;
        messages.push({ id: it.id, texte: it.name, date: iso(it.date), client: it.clientConcern?.linkedItems?.map((l) => l.name).join(', ') ?? '' });
      }
      cur = page.cursor;
    } while (cur);
    return { messages };
  });

export const markCommunicationSeen = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId: z.string().min(1), vu: z.boolean() }))
  .handler(async ({ data }) => {
    await new CommunicationViaLesAnimatricesBoard().item(data.itemId).update({ vu: data.vu }).execute();
    return { ok: true };
  });

export const updatePlanActionStatus = createServerFn({ method: 'POST' })
  .validator(z.object({
    subitemId: z.string().min(1),
    statut: z.string().min(1),
  }))
  .handler(async ({ data }) => {
    const raw = (data.statut || '').trim().toLowerCase();
    const labelMap: Record<string, string> = {
      'non commencé': 'non commencé',
      'non commence': 'non commencé',
      'en cours': 'En cours',
      'bloqué': 'Bloqué',
      'bloque': 'Bloqué',
      'fait': 'Fait',
      'abandonné': 'Abandonné',
      'abandonne': 'Abandonné',
    };
    const finalLabel = labelMap[raw] || data.statut;

    const columnValues: Record<string, any> = {
      color_mkv1tk6f: { label: finalLabel },
    };

    if (finalLabel === 'Fait') {
      const today = new Date().toISOString().slice(0, 10);
      columnValues.date_mkwrr950 = { date: today };
    }

    const mutation = `mutation UpdateSubitem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }`;

    await callMondayApi(mutation, {
      variables: {
        boardId: '1978388826',
        itemId: data.subitemId,
        columnValues: JSON.stringify(columnValues),
      },
    });

    clearBoardCache();
    return { ok: true };
  });

export const updatePlanActionText = createServerFn({ method: 'POST' })
  .validator(z.object({
    subitemId: z.string().min(1),
    action: z.string(),
  }))
  .handler(async ({ data }) => {
    const textVal = data.action.trim();
    const columnValues: Record<string, any> = {
      text_mkrhcpzc: textVal,
    };

    const mutation = `mutation UpdateSubitemText($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }`;

    await callMondayApi(mutation, {
      variables: {
        boardId: '1978388826',
        itemId: data.subitemId,
        columnValues: JSON.stringify(columnValues),
      },
    });

    if (textVal) {
      try {
        const nameMut = `mutation ($boardId: ID!, $itemId: ID!, $val: String!) {
          change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: "name", value: $val) {
            id
          }
        }`;
        await callMondayApi(nameMut, {
          variables: {
            boardId: '1978388826',
            itemId: data.subitemId,
            val: textVal.slice(0, 250),
          },
        });
      } catch (_) {}
    }

    clearBoardCache();
    return { ok: true };
  });

export const getSinglePlanAction = createServerFn({ method: 'GET' })
  .validator(z.object({ subitemId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const freshQuery = `query GetSubitem_${Date.now()} ($id: [ID!]) {
      items(ids: $id) {
        id
        name
        column_values(ids: ["color_mkv1tk6f", "text_mkrhcpzc"]) {
          id
          text
        }
      }
    }`;
    const res = await callMondayApi(freshQuery, { variables: { id: [data.subitemId] } });
    const item = res?.data?.items?.[0];
    if (!item) return null;
    const statutCv = item.column_values?.find((c: any) => c.id === 'color_mkv1tk6f')?.text || null;
    const actionCv = (item.column_values?.find((c: any) => c.id === 'text_mkrhcpzc')?.text || item.name || '').trim();
    return {
      id: item.id,
      statut: statutCv,
      action: actionCv,
    };
  });
