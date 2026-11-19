import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ImpactFinancierBoard, InformationsMensuellesBoard } from '@api/BoardSDK';

// 12 mois max de l'année en cours (top-N fixe)
export const getMonthlyFinance = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const y = new Date().getFullYear();
    const res = await new InformationsMensuellesBoard().items()
      .withColumns(['moisConcern', 'caBudget', 'caRalis', 'rsBudget', 'resRalis'])
      .where({ moisConcern: [`${y}-01-01`, `${y}-12-31`] })
      .orderBy({ column: 'moisConcern', direction: 'asc' })
      .withPagination({ limit: 12 })
      .execute();
    return {
      year: y,
      months: (res.items ?? []).map((i) => ({
        label: i.moisConcern ? new Date(i.moisConcern).toLocaleDateString('fr-FR', { month: 'short' }) : i.name,
        caBudget: i.caBudget ?? null, caRealise: i.caRalis ?? null,
        resBudget: i.rsBudget ?? null, resRealise: i.resRalis ?? null,
      })),
    };
  });

const yearRange = (): [string, string] => {
  const y = new Date().getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
};

const GROUPS = { loss: 'topics', gain: 'group_mm8jm92x' } as const;
const kindSchema = z.object({ kind: z.enum(['loss', 'gain']).optional(), cursor: z.string().optional() }).optional();

// Somme sur l'année en cours du groupe demandé (boucle complète : agrégat par groupe).
export const getLossesSummary = createServerFn({ method: 'GET' })
  .validator(kindSchema)
  .handler(async ({ data }) => {
    const board = new ImpactFinancierBoard();
    const where = { date: yearRange(), group: GROUPS[data?.kind ?? 'loss'] };
    let total = 0; let count = 0;
    const cats = new Map<string, number>();
    let res = await board.items().withColumns(['date', 'montantHt', 'catgorie']).where(where).withPagination({ limit: 500 }).execute();
    for (;;) {
      for (const i of res.items ?? []) {
        const m = i.montantHt ?? 0;
        total += m; count += 1;
        const k = i.catgorie || 'Sans catégorie';
        cats.set(k, (cats.get(k) ?? 0) + m);
      }
      if (!res.cursor) break;
      res = await board.items().withColumns(['date', 'montantHt', 'catgorie']).where(where).withPagination({ cursor: res.cursor, limit: 500 }).execute();
    }
    return {
      year: new Date().getFullYear(), total, count,
      categories: [...cats.entries()].map(([label, t]) => ({ label, total: t })).filter((r) => r.total > 0),
    };
  });

export const getLosses = createServerFn({ method: 'GET' })
  .validator(kindSchema)
  .handler(async ({ data }) => {
    const q = new ImpactFinancierBoard().items()
      .withColumns(['date', 'fournisseur', 'montantHt', 'catgorie'])
      .where({ date: yearRange(), group: GROUPS[data?.kind ?? 'loss'] })
      .orderBy({ column: 'date', direction: 'desc' });
    const res = data?.cursor
      ? await q.withPagination({ cursor: data.cursor }).execute()
      : await q.withPagination({ limit: 25 }).execute();
    return {
      items: (res.items ?? []).map((i) => ({
        id: i.id, name: i.name, fournisseur: i.fournisseur ?? '', montant: i.montantHt ?? 0,
        categorie: i.catgorie ?? '', date: i.date ? new Date(i.date).toISOString() : null,
      })),
      cursor: res.cursor ?? null,
    };
  });
