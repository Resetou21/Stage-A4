import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ReparationMachinesBoard } from '@api/BoardSDK';
import { monday } from '@api/mondayApi';

const BOARD_REPARATIONS = 5106693291;
const GROUP_TOPICS = 'topics'; // Machine en réparation
const FILE_COLUMN_ID = 'file_mm95gtnd';

// Récupération des dernières factures déposées par Christine (filtrées et triées par date de dépôt décroissante)
export const getDernieresReparations = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const board = new ReparationMachinesBoard();
    const allItems: any[] = [];
    let cursor: string | null = null;
    let first = true;

    while (first || cursor) {
      const q = first
        ? `query {
            boards(ids: [${BOARD_REPARATIONS}]) {
              items_page(limit: 500) {
                cursor
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
          }`
        : `query ($c: String!) {
            next_items_page(limit: 500, cursor: $c) {
              cursor
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
          }`;

      const res: any = await board.executeGraphQL(q, first ? {} : { c: cursor });
      const page = first ? res?.boards?.[0]?.items_page : res?.next_items_page;
      first = false;
      allItems.push(...(page?.items ?? []));
      cursor = page?.cursor ?? null;
    }

    const items = allItems
      .map((it: any) => {
        const byId = new Map<string, string>(
          (it.column_values ?? []).map((c: any) => [String(c.id), String(c.text ?? '')])
        );
        const fournisseurCol = (byId.get('text_mm91mkdz') || '').trim();
        const description = (byId.get('text_mm8vhwst') || '').trim();
        const isFromChristine =
          String(it.name || '').startsWith('Facture Réparation') ||
          description.includes('Facture réparation déposée');

        if (!isFromChristine) return null;

        return {
          id: String(it.id),
          name: String(it.name || ''),
          createdAt: String(it.created_at || ''),
          statut: byId.get('color_mm8vp2nd') || 'À traiter',
          montant: byId.get('numeric_mm8g9d6m') || '',
          fournisseur: fournisseurCol || String(it.name || '—'),
          date: byId.get('date_mm8g4vq6') || '',
          description,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 10);

    return { reparations: items };
  });

// Upload d'un fichier PDF / Image vers la colonne file_mm95gtnd du ticket réparation
export async function uploadReparationPdf(itemId: string | number, file: File): Promise<boolean> {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${itemId}, column_id: "${FILE_COLUMN_ID}", file: $file) {
      id
      name
    }
  }`;

  try {
    const res: any = await (monday as any).api(mutation, { variables: { file } });
    if (res?.data?.add_file_to_column?.id || res?.add_file_to_column?.id) {
      return true;
    }
  } catch (sdkErr) {
    console.warn('Tentative monday.api fichier réparation échouée, fallback fetch:', sdkErr);
  }

  try {
    let token = '';
    try {
      const sessionRes: any = await (monday as any).get('sessionToken');
      token = sessionRes?.data || '';
    } catch {}

    const formData = new FormData();
    formData.append('query', mutation);
    formData.append('variables[file]', file);

    const headers: Record<string, string> = { 'API-Version': '2024-04' };
    if (token) headers['Authorization'] = token;

    const res = await fetch('https://api.monday.com/v2/file', {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await res.json();
    if (json?.data?.add_file_to_column?.id) {
      return true;
    }
  } catch (fetchErr) {
    console.warn('Erreur fallback fetch /v2/file réparation:', fetchErr);
  }

  return false;
}

// Création d'une fiche réparation matériel (Fournisseur + Date de dépôt + PDF) et alerte automatique du Hub de Christophe
export const createFactureReparation = createServerFn({ method: 'POST' })
  .validator(z.object({
    designation: z.string().min(1, 'Désignation obligatoire'),
    fournisseur: z.string().min(1, 'Fournisseur obligatoire'),
    dateFacture: z.string().min(1, 'Date de dépôt obligatoire'),
    fileName: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const board = new ReparationMachinesBoard();

    const colValues: Record<string, any> = {
      color_mm8vp2nd: { label: 'À traiter' }, // Statut de suivi
      color_mm8gs7c7: { label: 'Curative' }, // Type d'intervention
      text_mm91mkdz: data.fournisseur, // Fournisseur / Prestataire
      date_mm8g4vq6: { date: data.dateFacture }, // Date de dépôt
      text_mm8vhwst: `Facture réparation déposée le ${data.dateFacture} — Fournisseur : ${data.fournisseur}${data.fileName ? ` (PDF : ${data.fileName})` : ''}`,
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
              Une nouvelle facture de réparation matériel a été déposée :
            </p>
            <ul style="margin: 0 0 10px 0; padding-left: 20px;">
              <li><strong>Fournisseur / Prestataire :</strong> ${data.fournisseur}</li>
              <li><strong>Date de dépôt :</strong> ${data.dateFacture}</li>
              ${data.fileName ? `<li><strong>Facture PDF jointe :</strong> ${data.fileName}</li>` : ''}
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
