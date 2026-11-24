import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getChantierQuality } from './visits';

export type Alert = { id: string; texte: string; date: string | null };

// Alertes « visite des 2 mois » des chantiers en cours de l'animatrice (texte d'alerte rempli, RDV pas encore fait)
export const getChantierAlerts = createServerFn({ method: 'GET' })
  .validator(z.object({ firstName: z.string().min(1) }))
  .handler(async ({ data }) => {
    const q = await getChantierQuality({ data });
    return { alerts: q.alerts || [] };
  });
