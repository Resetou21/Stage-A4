import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { TableauCompletChantierBoard } from '@api/BoardSDK';

const ANIMATEURS = ['Natacha THOMAS', 'Ketty PAULIN', 'Emilie TOBIE', 'Andre LEVESQUE'] as const;

// Alertes « visite des 2 mois » des chantiers en cours de l'animatrice (texte d'alerte rempli, RDV pas encore fait)
export const getChantierAlerts = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Alert = { id: string; texte: string; date: string | null };
    const label = ANIMATEURS.find((a) => a.toLowerCase().startsWith(data.firstName.toLowerCase()));
    if (!label) return { alerts: [] as Alert[] };
    const board = new TableauCompletChantierBoard();
    const alerts: Alert[] = [];
    let cur: string | null | undefined = undefined;
    do {
      const res = await board
        .items()
        .withColumns(['texteDalerteAnimatrice1', 'datePrvRdvDes2Mois', 'rdv2Mois'])
        .where({ animateur: label, group: 'topics', texteDalerteAnimatrice1: { isEmpty: false } })
        .withPagination(cur ? { limit: 500, cursor: cur } : { limit: 500 })
        .execute();
      for (const it of res.items) {
        const texte = (it.texteDalerteAnimatrice1 ?? '').trim();
        if (!texte || it.rdv2Mois === true) continue;
        const d = it.datePrvRdvDes2Mois ? new Date(it.datePrvRdvDes2Mois) : null;
        alerts.push({ id: it.id, texte, date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null });
      }
      cur = res.cursor;
    } while (cur);
    alerts.sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));
    return { alerts };
  });
