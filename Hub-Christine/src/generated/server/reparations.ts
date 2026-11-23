import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ReparationMachinesBoard } from '@api/BoardSDK';

const BOARD_REPARATIONS = 5106693291;
const GROUP_TOPICS = 'topics'; // Machine en réparation

// Récupération des 10 dernières réparations enregistrées
export const getDernieresReparations = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new ReparationMachinesBoard();
    const q = `
      query {
        boards(ids: [${BOARD_REPARATIONS}]) {
          items_page(limit: 10) {
            items {
              id
              name
              created_at
              column_values(ids: ["color_mm8vp2nd", "numeric_mm8g9d6m", "text_mm91mkdz", "date_mm8g4vq6", "text_mm8vhwst"]) {
                id
                text
              }
            }
          }
        }
      }
    `;
    const res: any = await board.executeGraphQL(q);
    const items = (res?.boards?.[0]?.items_page?.items ?? []).map((it: any) => {
      const byId = new Map(it.column_values.map((c: any) => [c.id, c.text ?? '']));
      return {
        id: it.id,
        name: it.name,
        createdAt: it.created_at,
        statut: byId.get('color_mm8vp2nd') || 'À traiter',
        montant: byId.get('numeric_mm8g9d6m') || '—',
        fournisseur: byId.get('text_mm91mkdz') || '—',
        date: byId.get('date_mm8g4vq6') || '',
        description: byId.get('text_mm8vhwst') || '',
      };
    });
    return { reparations: items };
  });

// Création d'une fiche réparation matériel et alerte automatique du Hub de Christophe
export const createFactureReparation = createServerFn({ method: 'POST' })
  .validator(z.object({
    designation: z.string().min(1, 'Désignation obligatoire'),
    fournisseur: z.string().min(1, 'Fournisseur obligatoire'),
    dateFacture: z.string().min(1, 'Date obligatoire'),
    montantHt: z.number().positive('Montant supérieur à 0 obligatoire'),
    numeroFacture: z.string().optional(),
    description: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const board = new ReparationMachinesBoard();

    const colValues: Record<string, any> = {
      color_mm8vp2nd: { label: 'À traiter' }, // Statut de suivi
      color_mm8gs7c7: { label: 'Curative' }, // Type d'intervention
      numeric_mm8g9d6m: String(data.montantHt), // Montant (€)
      text_mm91mkdz: data.fournisseur, // Fournisseur / Prestataire
      date_mm8g4vq6: { date: data.dateFacture }, // Réalisée le
      text_mm8vhwst: `Facture réparation à affecter par machine : ${data.fournisseur} - ${data.montantHt} € HT ${data.numeroFacture ? `(N° ${data.numeroFacture})` : ''}. ${data.description || ''}`,
      ...(data.numeroFacture ? { text_mm9196c1: data.numeroFacture } : {}),
    };

    const mutation = `
      mutation ($name: String!, $vals: JSON!) {
        create_item(
          board_id: ${BOARD_REPARATIONS},
          group_id: "${GROUP_TOPICS}",
          item_name: $name,
          column_values: $vals,
          create_labels_if_missing: true
        ) {
          id
        }
      }
    `;

    const itemName = `Facture Réparation : ${data.fournisseur} (${data.dateFacture})`;
    const res: any = await board.executeGraphQL(mutation, {
      name: itemName,
      vals: JSON.stringify(colValues),
    });

    const newItemId = res?.create_item?.id;

    // Alerter Christophe via un message HTML formaté dans le fil de discussion de l'élément
    if (newItemId) {
      try {
        const updateBody = `
          <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
            <p style="font-size: 15px; font-weight: bold; color: #3989B7; margin: 0 0 8px 0;">
              🔔 Alerte Hub Facturation (Christine) ➔ Hub Atelier & Parc (Christophe)
            </p>
            <p style="margin: 0 0 6px 0;">
              Une nouvelle facture de réparation matériel a été réceptionnée et importée :
            </p>
            <ul style="margin: 0 0 10px 0; padding-left: 20px;">
              <li><strong>Fournisseur / Prestataire :</strong> ${data.fournisseur}</li>
              <li><strong>Montant HT :</strong> ${data.montantHt} €</li>
              <li><strong>Date facture :</strong> ${data.dateFacture}</li>
              ${data.numeroFacture ? `<li><strong>N° de Facture :</strong> ${data.numeroFacture}</li>` : ''}
              ${data.description ? `<li><strong>Détail intervention :</strong> ${data.description}</li>` : ''}
            </ul>
            <p style="background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-weight: 600; color: #0f172a; margin: 0;">
              👉 Action requise : Merci d'affecter cette réparation à la machine concernée dans le tableau Parc Machines.
            </p>
          </div>
        `;

        await board.executeGraphQL(
          `mutation ($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id } }`,
          { itemId: newItemId, body: updateBody }
        );
      } catch (err) {
        console.warn('Impossible de publier l update de notification:', err);
      }
    }

    return { id: newItemId };
  });
