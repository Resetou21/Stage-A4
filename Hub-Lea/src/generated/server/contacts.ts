import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { TableauCompletChantierBoard } from '@api/BoardSDK';

export interface RawChantierItem {
  id: string;
  chantier: string;
  groupTitle: string;
  isEnCours: boolean;
  interlocuteur: string;
  adresseMail: string;
  telephone: string;
}

// Full export: loops all pages (export needs the complete dataset).
export const getAllContacts = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async (): Promise<{ items: RawChantierItem[] }> => {
    const board = new TableauCompletChantierBoard();
    const items: RawChantierItem[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const res: { items: any[]; cursor?: string | null } = await board
        .items()
        .withColumns(['interlocuteur', 'adresseMail', 'telephone'])
        .withPagination({ limit: 500, cursor })
        .execute();

      for (const it of res.items ?? []) {
        const interVal = it.interlocuteur;
        const interlocuteur = Array.isArray(interVal)
          ? interVal.join(', ').trim()
          : String(interVal || '').trim();

        const mailVal = it.adresseMail;
        const adresseMail = Array.isArray(mailVal)
          ? mailVal.join(', ').trim()
          : String(mailVal || '').trim();

        const telVal = it.telephone;
        const telephone = Array.isArray(telVal)
          ? telVal.join(', ').trim()
          : String(telVal || '').trim();

        const groupTitle = it.group?.title || 'Autre';
        const isEnCours =
          it.group?.id === 'topics' || groupTitle.toLowerCase().includes('en cours');

        if (interlocuteur || adresseMail || telephone) {
          items.push({
            id: it.id,
            chantier: it.name || '',
            groupTitle,
            isEnCours,
            interlocuteur,
            adresseMail,
            telephone,
          });
        }
      }
      cursor = res.cursor;
    } while (cursor);

    return { items };
  });
