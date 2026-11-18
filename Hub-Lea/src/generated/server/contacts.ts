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
      const res: { items: unknown[]; cursor?: string | null } = cursor
        ? await board.items().withPagination({ cursor }).execute()
        : await board.items().withColumns(['interlocuteur', 'adresseMail']).withPagination({ limit: 500 }).execute();
      for (const it of res.items ?? []) {
        const row = it as { interlocuteur?: string[] | null; adresseMail?: string[] | null };
        const interlocuteur = (row.interlocuteur ?? []).join(', ').trim();
        const adresseMail = (row.adresseMail ?? []).join(', ').trim();
        if (interlocuteur || adresseMail) contacts.push({ interlocuteur, adresseMail });
      }
      cursor = res.cursor;
    } while (cursor);
    return { contacts };
  });
