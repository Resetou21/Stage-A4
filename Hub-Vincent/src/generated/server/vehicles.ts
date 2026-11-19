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
      return { label: start.toLocaleDateString('fr-FR', { month: 'short' }), from: ymd(start), to: ymd(end) };
    });

    const res = await board.items().withColumns(['dateDuContrle']).execute();
    const items = res.items ?? [];

    const months = ranges.map((r) => {
      let count = 0;
      for (const it of items) {
        const d = it.dateDuContrle;
        if (d && d >= r.from && d <= r.to) {
          count++;
        }
      }
      return { label: r.label, count };
    });

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
    let total = 0;
    let cursor: string | null | undefined = undefined;
    do {
      const res: { items: unknown[]; cursor?: string | null } = await baseQuery(data.kind)
        .withPagination({ limit: 500, cursor })
        .execute();
      total += res.items?.length ?? 0;
      cursor = res.cursor;
    } while (cursor);
    return { total };
  });

export const getPlans = createServerFn({ method: 'GET' })
  .validator(z.object({ kind, cursor: z.string().optional() }))
  .handler(async ({ data }) => {
    const res = await baseQuery(data.kind)
      .withPagination({ limit: 25, cursor: data.cursor })
      .execute();
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
