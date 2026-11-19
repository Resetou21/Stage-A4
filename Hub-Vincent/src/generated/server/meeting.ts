import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { InformationsMensuellesBoard } from '@api/BoardSDK';

const MEETING_BOARD_ID = '5099650983';
const PARENT_NAME = 'Prochains sujets à traiter';
const A_FAIRE_GROUP_ID = 'group_mm4xx12e';

type FindRes = { boards?: { items_page?: { items?: { id: string; name: string; group?: { id: string } }[] } }[] };
type CreateRes = { create_subitem?: { id: string; name: string } };

// Ajoute un sujet comme sous-élément de « Prochains sujets à traiter » et garantit qu'il est dans le groupe « A faire »
export const addMeetingTopic = createServerFn({ method: 'POST' })
  .validator(z.object({ topic: z.string().trim().min(1).max(255) }))
  .handler(async ({ data }) => {
    const sdk = new InformationsMensuellesBoard();
    const found = (await sdk.executeGraphQL(
      `query ($b: [ID!], $n: CompareValue!) {
        boards(ids: $b) { items_page(limit: 10, query_params: { rules: [{ column_id: "name", compare_value: $n, operator: contains_text }] }) { items { id name group { id } } } }
      }`,
      { b: [MEETING_BOARD_ID], n: PARENT_NAME },
    )) as FindRes;
    const items = found?.boards?.[0]?.items_page?.items ?? [];
    const parent = items.find((i) => i.name.trim().toLowerCase() === PARENT_NAME.toLowerCase()) ?? items[0];
    if (!parent) throw new Error(`Élément « ${PARENT_NAME} » introuvable dans le tableau.`);

    // S'assurer que la ligne « Prochains sujets à traiter » est bien dans le groupe « A faire »
    if (parent.group?.id !== A_FAIRE_GROUP_ID) {
      try {
        await sdk.executeGraphQL(
          `mutation ($p: ID!, $g: String!) { move_item_to_group(item_id: $p, group_id: $g) { id } }`,
          { p: parent.id, g: A_FAIRE_GROUP_ID }
        );
      } catch (err) {
        console.warn('Impossible de déplacer le parent vers A faire:', err);
      }
    }

    const created = (await sdk.executeGraphQL(
      `mutation ($p: ID!, $n: String!) { create_subitem(parent_item_id: $p, item_name: $n) { id name } }`,
      { p: parent.id, n: data.topic },
    )) as CreateRes;
    if (!created?.create_subitem?.id) throw new Error('La création du sujet a échoué.');
    return { id: created.create_subitem.id, name: created.create_subitem.name };
  });
