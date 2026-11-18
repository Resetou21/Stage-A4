import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { TableauCompletChantierBoard } from '@api/BoardSDK';

// Full export: loops all pages (export needs the complete dataset).
export const getAllContacts = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new TableauCompletChantierBoard();
    const contacts: { interlocuteur: string; adresseMail: string }[] = [];
    let cursor: string | null | undefined = undefined;
    do {
      const res: { items: unknown[]; cursor?: string | null } = await board
        .items()
        .withColumns(['interlocuteur', 'adresseMail'])
        .withPagination({ limit: 500, cursor })
        .execute();

      for (const it of res.items ?? []) {
        const row = it as { interlocuteur?: string[] | string | null; adresseMail?: string[] | string | null };
        const interVal = row.interlocuteur;
        const interlocuteur = Array.isArray(interVal)
          ? interVal.join(', ').trim()
          : String(interVal || '').trim();

        const mailVal = row.adresseMail;
        const adresseMail = Array.isArray(mailVal)
          ? mailVal.join(', ').trim()
          : String(mailVal || '').trim();

        if (interlocuteur || adresseMail) {
          contacts.push({ interlocuteur, adresseMail });
        }
      }
      cursor = res.cursor;
    } while (cursor);
    return { contacts };
  });
