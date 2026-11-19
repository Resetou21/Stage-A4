import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { PlanDactionVehiculeBoard, ControleVisuelVehiculeBoard } from '@api/BoardSDK';

const OPEN = 'topics';
const DONE = 'group_mm86tp1y';
const kind = z.enum(['open', 'done']);
const day = (x: Date) => x.toISOString().slice(0, 10);
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };

export const countRecentControls = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new ControleVisuelVehiculeBoard();
    const now = new Date();
    const ranges = [2, 1, 0].map((n) => {
      const start = new Date(now.getFullYear(), now.getMonth() - n, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - n + 1, 0);
      const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      return { start, from: ymd(start), to: ymd(end) };
    });
    const months = await Promise.all(ranges.map(async (r) => {
      const rows = await board.aggregate().where({ dateDuContrle: [r.from, r.to] }).countItems('total').execute();
      return { label: r.start.toLocaleDateString('fr-FR', { month: 'short' }), count: rows?.[0]?.total ?? 0 };
    }));
    return { total: months.reduce((s, m) => s + m.count, 0), months };
  });

const baseQuery = (k: 'open' | 'done') => {
  const board = new PlanDactionVehiculeBoard();
  const q = board.items().withColumns(['dateContrle', 'immat', 'zone', 'actionEntreprendre', 'actionRalise', 'dateRalisation']);
  return k === 'open'
    ? q.where({ group: OPEN }).orderBy({ column: 'dateContrle', direction: 'desc' })
    : q.where({ group: DONE, dateRalisation: { between: [day(monthsAgo(2)), day(new Date())] } })
        .orderBy({ column: 'dateRalisation', direction: 'desc' });
};

export const countPlans = createServerFn({ method: 'GET' })
  .validator(z.object({ kind }))
  .handler(async ({ data }) => {
    const board = new PlanDactionVehiculeBoard();
    let total = 0;
    let cursor: string | null | undefined = undefined;
    do {
      const res: { items: unknown[]; cursor?: string | null } = cursor
        ? await board.items().withPagination({ cursor }).execute()
        : await baseQuery(data.kind).withPagination({ limit: 2000 }).execute();
      total += res.items?.length ?? 0;
      cursor = res.cursor;
    } while (cursor);
    return { total };
  });

export const getPlans = createServerFn({ method: 'GET' })
  .validator(z.object({ kind, cursor: z.string().optional() }))
  .handler(async ({ data }) => {
    const res = data.cursor
      ? await baseQuery(data.kind).withPagination({ cursor: data.cursor }).execute()
      : await baseQuery(data.kind).withPagination({ limit: 25 }).execute();
    return {
      items: (res.items ?? []).map((i) => {
        const dt = data.kind === 'done' ? i.dateRalisation : i.dateContrle;
        return {
          id: i.id,
          name: i.name,
          immat: i.immat ?? '',
          zone: i.zone ?? '',
          action: i.actionEntreprendre ?? '',
          statut: i.actionRalise ?? '',
          date: dt ? new Date(dt).toISOString() : null,
        };
      }),
      cursor: res.cursor ?? null,
    };
  });
