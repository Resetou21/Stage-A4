import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getChantiersList } from './chantiers';

// Alertes « visite des 2 mois » des chantiers en cours de l'animatrice (texte d'alerte rempli, RDV pas encore fait)
export const getChantierAlerts = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    type Alert = { id: string; texte: string; date: string | null };
    const alerts: Alert[] = [];
    try {
      const list = await getChantiersList({ data: { firstName: data.firstName } });
      for (const it of list) {
        const texte = (it.texteDalerteAnimatrice1 ?? '').trim();
        if (!texte || it.rdv2Mois === true) continue;
        const d = it.datePrvRdvDes2Mois ? new Date(it.datePrvRdvDes2Mois) : null;
        alerts.push({ id: it.id, texte, date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null });
      }
    } catch (_) {}
    alerts.sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));
    return { alerts };
  });
