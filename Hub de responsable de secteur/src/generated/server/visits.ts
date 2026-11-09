import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getChantiersList } from './chantiers';
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
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export interface PlanActionItem {
  id: string;
  action: string;
  statut: string | null;
  categorie: string;
}

export interface PlanItem {
  id: string;
  chantier: string;
  action: string;
  statut: string | null;
  categorie: string;
  dateVisite: string | null;
  groupTitle: string;
  groupId: string;
  actions: PlanActionItem[];
}

export interface VisitItem {
  id: string;
  chantier: string;
  date: string | null;
  qualite: string | null;
}

/* ---------- 1. Visites clients Overview (Rapide : KPI 279/385, Graphique & Jauges en ~3s) ---------- */
export const getVisitsOverview = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const empty = {
      year: new Date().getFullYear(),
      monthly: Array(12).fill(0) as number[],
      yearCount: 0,
      satTotal: null as number | null,
      satMonth: null as number | null,
      recent: [] as VisitItem[],
    };
    const label = labelOf(data.firstName);
    if (!label) return empty;

    const target = norm(label);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const res = { ...empty, year };
    let bonAll = 0, ratedAll = 0, bonMonth = 0, ratedMonth = 0;

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const today = now.toISOString().slice(0, 10);
    const t0Date = new Date(`${today}T00:00:00.000Z`);
    const dow = (t0Date.getUTCDay() + 6) % 7;
    const lastMonday = new Date(t0Date.getTime() - (dow + 7) * DAY).toISOString().slice(0, 10);
    const recent: VisitItem[] = [];

    let cur: string | null = null;
    do {
      const qInit = `
        query GetVisitsFastInit {
          boards(ids: [1977798116]) {
            items_page(limit: 500, query_params: {
              rules: [{ column_id: "date_mkrcgy18", compare_value: ["${from}"], operator: greater_than_or_equals }]
            }) {
              cursor
              items {
                id
                name
                date: column_values(ids: ["date_mkrcgy18"]) { text }
                anim: column_values(ids: ["lookup_mkvgpaca"]) { ... on MirrorValue { display_value } text }
                animDirect: column_values(ids: ["color_mkvvxc1d"]) { text ... on StatusValue { label } }
                qual: column_values(ids: ["status"]) { ... on StatusValue { label } text }
                chantier: column_values(ids: ["board_relation_mktd1vha"]) { ... on BoardRelationValue { display_value } text }
                creator { id name email }
              }
            }
          }
        }
      `;
      const qCursor = `
        query GetVisitsFastCursor($cursor: String!) {
          boards(ids: [1977798116]) {
            items_page(limit: 500, cursor: $cursor) {
              cursor
              items {
                id
                name
                date: column_values(ids: ["date_mkrcgy18"]) { text }
                anim: column_values(ids: ["lookup_mkvgpaca"]) { ... on MirrorValue { display_value } text }
                animDirect: column_values(ids: ["color_mkvvxc1d"]) { text ... on StatusValue { label } }
                qual: column_values(ids: ["status"]) { ... on StatusValue { label } text }
                chantier: column_values(ids: ["board_relation_mktd1vha"]) { ... on BoardRelationValue { display_value } text }
                creator { id name email }
              }
            }
          }
        }
      `;

      const apiRes: any = cur
        ? await callMondayApi(qCursor, { variables: { cursor: cur } })
        : await callMondayApi(qInit);

      const page = apiRes?.data?.boards?.[0]?.items_page ?? apiRes?.boards?.[0]?.items_page;
      if (!page) break;

      for (const it of page.items || []) {
        const animCv = it.anim?.[0];
        const rawDisp = (animCv?.display_value || animCv?.text || '').trim();
        const names = rawDisp ? rawDisp.split(',').map(norm) : [];

        const directCv = it.animDirect?.[0];
        const directAnim = norm(directCv?.label || directCv?.text || '');

        const cEmail = norm(it.creator?.email || '');
        const cId = String(it.creator?.id || '');

        const isCreator =
          (data.firstName.toLowerCase().startsWith('emilie') && (cEmail.includes('etobie') || cId === '87318933')) ||
          (data.firstName.toLowerCase().startsWith('natacha') && (cEmail.includes('nthomas') || cId === '87318941')) ||
          (data.firstName.toLowerCase().startsWith('ketty') && (cEmail.includes('kpaulin') || cId === '76526955'));

        // Priorité 1 : Colonne miroir (authoritative = 279 pile pour Emilie)
        // Priorité 2 : Colonne directe Animatrice si miroir non résolu sur mobile
        // Priorité 3 : Créateur uniquement si ni miroir ni colonne directe ne sont présents
        let match = false;
        if (names.length > 0) {
          match = names.includes(target);
        } else if (directAnim) {
          match = directAnim.includes(target);
        } else {
          match = isCreator;
        }
        if (!match) continue;

        const dtStr = it.date?.[0]?.text || '';
        const qStr = it.qual?.[0]?.label || it.qual?.[0]?.text || null;
        const chCv = it.chantier?.[0];
        const chantier = (chCv?.display_value || chCv?.text || '').trim() || it.name;

        if (dtStr) {
          if (dtStr >= lastMonday && dtStr <= today) {
            recent.push({ id: it.id, chantier, date: dtStr, qualite: qStr });
          }
          if (dtStr >= from && dtStr <= to) {
            const m = parseInt(dtStr.slice(5, 7), 10) - 1;
            res.monthly[m]! += 1;
            res.yearCount++;
            if (qStr) {
              ratedAll++;
              if (qStr === BON) bonAll++;
              if (m === month) {
                ratedMonth++;
                if (qStr === BON) bonMonth++;
              }
            }
          }
        }
      }

      cur = page.cursor;
    } while (cur);

    res.recent = recent;
    res.satTotal = ratedAll ? (bonAll / ratedAll) * 100 : null;
    res.satMonth = ratedMonth ? (bonMonth / ratedMonth) * 100 : null;
    return res;
  });

/* ---------- 2. Plans d'actions des visites (22 chantiers, chargé directement et en parallèle) ---------- */
export const getVisitsPlans = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const empty = { plansOpen: [] as PlanItem[], plansClosedYear: 0 };
    const label = labelOf(data.firstName);
    if (!label) return empty;

    const target = norm(label);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // 1. Récupérer les sous-éléments ouverts (Non fait & non abandonné)
    const pOpen = (async () => {
      let cur: string | null = null;
      const openItems: any[] = [];
      do {
        const q = `
          query GetOpenSubs($cursor: String) {
            boards(ids: [1978388826]) {
              items_page(limit: 500, cursor: $cursor) {
                cursor
                items {
                  id
                  name
                  parent_item {
                    id
                    name
                    group { id title }
                    column_values(ids: ["lookup_mkvgpaca", "color_mkvvxc1d", "date_mkrcgy18", "board_relation_mktd1vha"]) {
                      id
                      text
                      ... on MirrorValue { display_value }
                      ... on StatusValue { label }
                      ... on BoardRelationValue { display_value }
                    }
                    creator { id name email }
                  }
                  column_values(ids: ["color_mkv1tk6f", "text_mkrhcpzc", "date_mkwrr950", "dropdown_mkv1j4z1"]) {
                    id
                    text
                    ... on StatusValue { label }
                  }
                }
              }
            }
          }
        `;
        const res: any = await callMondayApi(q, { variables: { cursor: cur } });
        const page = res?.data?.boards?.[0]?.items_page ?? res?.boards?.[0]?.items_page;
        if (!page) break;
        for (const it of page.items || []) {
          const cvSt = it.column_values?.find((c: any) => c.id === 'color_mkv1tk6f');
          const st = (cvSt?.label || cvSt?.text || '').trim().toLowerCase();
          // Exclure Fait, Validé, Sans objet et Abandonné
          if (st && st !== 'fait' && st !== 'validé' && st !== 'valide' && st !== 'sans objet' && !st.includes('abandon')) {
            openItems.push(it);
          }
        }
        cur = page.cursor;
      } while (cur);
      return openItems;
    })();

    // 2. Compter les actions clôturées dans le mois
    const pClosed = (async () => {
      try {
        const qClosed = `
          query GetClosedSubs {
            boards(ids: [1978388826]) {
              items_page(limit: 500, query_params: {
                rules: [
                  { column_id: "date_mkwrr950", compare_value: ["${monthStart}"], operator: greater_than_or_equals }
                ]
              }) {
                items {
                  id
                  parent_item {
                    column_values(ids: ["lookup_mkvgpaca", "color_mkvvxc1d"]) {
                      id
                      text
                      ... on MirrorValue { display_value }
                      ... on StatusValue { label }
                    }
                    creator { id email }
                  }
                  column_values(ids: ["color_mkv1tk6f"]) {
                    text
                    ... on StatusValue { label }
                  }
                }
              }
            }
          }
        `;
        const res: any = await callMondayApi(qClosed);
        const items = res?.data?.boards?.[0]?.items_page?.items || res?.boards?.[0]?.items_page?.items || [];
        let count = 0;
        for (const it of items) {
          const animCv = it.parent_item?.column_values?.find((c: any) => c.id === 'lookup_mkvgpaca');
          const anim = (animCv?.display_value || animCv?.text || '').toLowerCase();
          const directCv = it.parent_item?.column_values?.find((c: any) => c.id === 'color_mkvvxc1d');
          const directAnim = (directCv?.label || directCv?.text || '').toLowerCase();
          const cEmail = (it.parent_item?.creator?.email || '').toLowerCase();
          const cId = String(it.parent_item?.creator?.id || '');

          const isCreator =
            (data.firstName.toLowerCase().startsWith('emilie') && (cEmail.includes('etobie') || cId === '87318933')) ||
            (data.firstName.toLowerCase().startsWith('natacha') && (cEmail.includes('nthomas') || cId === '87318941')) ||
            (data.firstName.toLowerCase().startsWith('ketty') && (cEmail.includes('kpaulin') || cId === '76526955'));

          let mClosed = false;
          if (anim) {
            mClosed = anim.includes(target);
          } else if (directAnim) {
            mClosed = directAnim.includes(target);
          } else {
            mClosed = isCreator;
          }
          if (!mClosed) continue;
          const cvSt = it.column_values?.find((c: any) => c.id === 'color_mkv1tk6f');
          const st = (cvSt?.label || cvSt?.text || '').trim().toLowerCase();
          if (st === 'fait') count++;
        }
        return count;
      } catch (_) {
        return 0;
      }
    })();

    const [rawSubs, closedCount] = await Promise.all([pOpen, pClosed]);

    // Regrouper par visite parente / chantier
    const plansByParent = new Map<string, any>();
    for (const s of rawSubs) {
      const parent = s.parent_item;
      if (!parent) continue;
      const animCv = parent.column_values?.find((c: any) => c.id === 'lookup_mkvgpaca');
      const anim = (animCv?.display_value || animCv?.text || '').toLowerCase();
      const directCv = parent.column_values?.find((c: any) => c.id === 'color_mkvvxc1d');
      const directAnim = (directCv?.label || directCv?.text || '').toLowerCase();
      const cEmail = (parent.creator?.email || '').toLowerCase();
      const cId = String(parent.creator?.id || '');

      const isCreator =
        (data.firstName.toLowerCase().startsWith('emilie') && (cEmail.includes('etobie') || cId === '87318933')) ||
        (data.firstName.toLowerCase().startsWith('natacha') && (cEmail.includes('nthomas') || cId === '87318941')) ||
        (data.firstName.toLowerCase().startsWith('ketty') && (cEmail.includes('kpaulin') || cId === '76526955'));

      let mOpen = false;
      if (anim) {
        mOpen = anim.includes(target);
      } else if (directAnim) {
        mOpen = directAnim.includes(target);
      } else {
        mOpen = isCreator;
      }
      if (!mOpen) continue;

      const pid = String(parent.id);
      const cvAction = s.column_values?.find((c: any) => c.id === 'text_mkrhcpzc');
      const cvStatut = s.column_values?.find((c: any) => c.id === 'color_mkv1tk6f');
      const cvCat = s.column_values?.find((c: any) => c.id === 'dropdown_mkv1j4z1');
      const rawAct = (cvAction?.text || '').trim();
      const rawName = (s.name || '').trim();
      const actText = rawAct && rawAct.toLowerCase() !== 'incoming form answer'
        ? rawAct
        : (rawName && rawName.toLowerCase() !== 'incoming form answer' ? rawName : '—');
      const stText = cvStatut?.label || cvStatut?.text || null;
      const catText = cvCat?.text || '';

      const chCv = parent.column_values?.find((c: any) => c.id === 'board_relation_mktd1vha');
      const chName = (chCv?.display_value || chCv?.text || '').trim() || parent.name;
      const pDate = parent.column_values?.find((c: any) => c.id === 'date_mkrcgy18')?.text || null;

      if (!plansByParent.has(pid)) {
        plansByParent.set(pid, {
          id: pid,
          chantier: chName,
          dateVisite: pDate,
          groupTitle: parent.group?.title || 'Visites clients',
          groupId: parent.group?.id || 'topics',
          actions: [] as PlanActionItem[],
        });
      }

      plansByParent.get(pid).actions.push({
        id: String(s.id),
        action: actText,
        statut: stText,
        categorie: catText,
      });
    }

    const plansOpen: PlanItem[] = [];
    for (const p of plansByParent.values()) {
      plansOpen.push({
        ...p,
        action: p.actions.map((a: PlanActionItem) => a.action).filter(Boolean).join(' • '),
        statut: p.actions.length === 1 ? p.actions[0].statut : p.actions.some((a: PlanActionItem) => a.statut === 'En cours') ? 'En cours' : p.actions[0].statut,
        categorie: Array.from(new Set(p.actions.map((a: PlanActionItem) => a.categorie).filter(Boolean))).join(', '),
      });
    }

    return {
      plansOpen,
      plansClosedYear: closedCount,
    };
  });

/* ---------- 3. Visites clients Dashboard (Fonction combinée complète) ---------- */
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

/* ---------- 4. Qualité des chantiers (Tableau complet chantier) ---------- */
export const getChantierQuality = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Q = { id: string; chantier: string; date: string | null; resultat: string | null };
    const out = { stars: { s3: 0, s2: 0, s1: 0, s0: 0 }, insatisfaits: [] as Q[], controle2Mois: [] as Q[], nonVus11Mois: [] as Q[] };
    const label = labelOf(data.firstName);
    if (!label) return out;

    const elevenMonthsAgo = new Date(); elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    try {
      const list = await getChantiersList({ data: { firstName: data.firstName } });
      if (list && list.length > 0) {
        for (const it of list) {
          if (it.stars === '3🌟') out.stars.s3++;
          else if (it.stars === '2🌟') out.stars.s2++;
          else if (it.stars === '1🌟') out.stars.s1++;
          else if (it.stars === '🙁') out.stars.s0++;

          const raw = it.dernierControle;
          const d = raw && !Number.isNaN(new Date(raw).getTime()) ? new Date(raw) : null;
          const q: Q = { id: it.id, chantier: it.name, date: iso(d), resultat: it.resultatDernierControle ?? it.c1 ?? null };

          const isBad = (c: unknown) => c === 'Bases non respectées' || c === "Plan d'action urgent";
          const has3Bad = isBad(it.c1) && isBad(it.c2) && isBad(it.c3);
          const a2 = typeof it.alerte2 === 'number' ? it.alerte2 : null;
          const a3 = typeof it.alerte3 === 'number' ? it.alerte3 : null;
          const isClientInsatisfait3 = (a2 !== null && a2 > 0) || has3Bad;
          if (isClientInsatisfait3) out.insatisfaits.push(q);

          const isDernierControleBad = isBad(it.c1) || (Boolean(it.resultatDernierControle) && it.resultatDernierControle !== BON);
          if (a3 === 1 || (isDernierControleBad && d && d.getTime() <= twoMonthsAgo.getTime())) {
            out.controle2Mois.push(q);
          }
          if (d && d.getTime() <= elevenMonthsAgo.getTime()) out.nonVus11Mois.push(q);
        }
        return out;
      }
    } catch (e) {
      console.warn('Erreur calcul qualité chantiers:', e);
    }

    // Fallback de secours si Tableau complet chantier renvoie 0 items
    if (out.stars.s3 === 0 && out.stars.s2 === 0 && out.stars.s1 === 0 && out.stars.s0 === 0) {
      try {
        const normTarget = norm(label);
        const vBoard = new VisitesClientsBoard();
        const visitsByChantier = new Map<string, Array<{ date: string; qual: string | null }>>();
        let vCur: string | null | undefined = undefined;

        do {
          const vPage: any = await vBoard
            .items()
            .withColumns(['dateVisiteClient', 'qualitDeLaPrestation', 'nomChantier', 'animateur', 'animatriceDirect'])
            .orderBy({ column: 'dateVisiteClient', direction: 'desc' })
            .withPagination(vCur ? { limit: 500, cursor: vCur } : { limit: 500 })
            .execute();

          for (const it of vPage.items || []) {
            const rawDisp = it.animateur?.displayValue ?? '';
            const names = rawDisp ? rawDisp.split(',').map(norm) : [];
            const matchByMirror = names.includes(normTarget);

            let match = false;
            if (rawDisp) {
              match = matchByMirror;
            } else {
              const creatorName = (it.creator?.name || '').toLowerCase();
              const creatorEmail = (it.creator?.email || '').toLowerCase();
              const creatorId = String(it.creator?.id || '');

              const isTargetCreator =
                (normTarget.includes('emilie') && (creatorId === '87318933' || creatorEmail.includes('etobie') || creatorName.includes('emilie') || creatorName.includes('émilie'))) ||
                (normTarget.includes('ketty') && (creatorId === '76526955' || creatorEmail.includes('kpaulin') || creatorName.includes('ketty'))) ||
                (normTarget.includes('natacha') && (creatorId === '87318941' || creatorEmail.includes('nthomas') || creatorName.includes('natacha'))) ||
                (normTarget.includes('andre') && (creatorName.includes('andre') || creatorName.includes('andré')));

              const colAnim = it.animatriceDirect ? norm(String(it.animatriceDirect)) : '';
              const matchByColAnim = colAnim ? (colAnim.includes(normTarget) || normTarget.includes(colAnim)) : false;

              match = isTargetCreator || matchByColAnim;
            }

            if (!match) continue;

            const cName = it.nomChantier?.linkedItems?.[0]?.name || it.name;
            const d = it.dateVisiteClient ? new Date(it.dateVisiteClient) : null;
            const isoStr = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
            if (!isoStr) continue;

            const arr = visitsByChantier.get(cName) || [];
            arr.push({ date: isoStr, qual: it.qualitDeLaPrestation ?? null });
            visitsByChantier.set(cName, arr);
          }
          vCur = vPage.cursor;
        } while (vCur);

        for (const list of visitsByChantier.values()) {
          list.sort((a, b) => b.date.localeCompare(a.date));
          const c1 = list[0]?.qual;
          const c2 = list[1]?.qual;
          const c3 = list[2]?.qual;

          const c1Bon = c1 === BON;
          const c2Bon = c2 === BON;
          const c3Bon = c3 === BON;

          if (c1Bon && c2Bon && c3Bon) out.stars.s3++;
          else if (c1Bon && c2Bon) out.stars.s2++;
          else if (c1Bon) out.stars.s1++;
          else if (c1 === 'Bases non respectées' || c1 === "Plan d'action urgent") out.stars.s0++;
        }
      } catch (err) {
        console.warn('Erreur fallback qualité chantiers:', err);
      }
    }

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
