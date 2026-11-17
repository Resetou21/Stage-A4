import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DataSurVehiculeBoard } from '@api/BoardSDK';

// Personnes qui utilisent les données d'un tableau importé (abonnés du tableau, hors comptes techniques)
export const getBoardUsers = createServerFn({ method: 'GET' })
  .validator(z.object({ boardId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const r = await new DataSurVehiculeBoard().executeGraphQL(
      `query ($b: [ID!]) { boards(ids: $b) { name subscribers { id name email title } } }`, { b: [data.boardId] }) as
      { boards?: { name: string; subscribers?: { id: string; name: string; email: string; title: string | null }[] }[] };
    const b = r.boards?.[0];
    const users = (b?.subscribers ?? []).filter((u) => !/^ai-agent\+/i.test(u.email) && !/^vibe app/i.test(u.name));
    return { board: b?.name ?? '', users };
  });
