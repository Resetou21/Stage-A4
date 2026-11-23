import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';
import { clearBoardCache } from '@api/mondayApi';

const MEETING_BOARD_ID = '5099650983';
// Groupe « A faire » (données en cours) dans « Suivi des actions réunion associée »
const A_FAIRE_GROUP_ID = 'group_mm4xx12e';
const STATUS_COL_ID = 'color_mm4xx268';

type CreateItemRes = { create_item?: { id: string; name: string } };

// Crée une nouvelle ligne directement dans le groupe « A faire » avec le statut « En cours »
// (sans jamais modifier les lignes existantes, les colonnes ou les groupes sur Monday).
export const addMeetingTopic = createServerFn({ method: 'POST' })
  .validator(z.object({ topic: z.string().trim().min(1).max(255) }))
  .handler(async ({ data }) => {
    const sdk = new InformationsMensuellesBoard();
    const colValues = JSON.stringify({
      [STATUS_COL_ID]: { label: 'En cours' },
    });

    const created = (await sdk.executeGraphQL(
      `mutation ($b: ID!, $g: String!, $n: String!, $cv: JSON!) {
        create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $cv) {
          id
          name
        }
      }`,
      {
        b: MEETING_BOARD_ID,
        g: A_FAIRE_GROUP_ID,
        n: data.topic,
        cv: colValues,
      },
    )) as CreateItemRes;

    if (!created?.create_item?.id) {
      throw new Error('La création de la nouvelle ligne a échoué.');
    }

    clearBoardCache(MEETING_BOARD_ID);
    return { id: created.create_item.id, name: created.create_item.name };
  });
