import monday from './monday';

export const STOCK_BOARD_ID = '5107680355';
export const STOCK_BOARD_NAME = 'Stock Pièces & Consommables Atelier';

export interface StockItemRecord {
  id: string;
  mondayItemId?: string;
  groupTitle?: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  notes?: string;
  lastUpdated?: string;
}

export interface StockColumnMap {
  category?: string;
  currentStock?: string;
  minStock?: string;
  unit?: string;
  notes?: string;
}

export interface StockBoardSchema {
  boardId: string;
  boardName: string;
  boardUrl?: string;
  partsGroupId?: string;
  columns: StockColumnMap;
}

function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractGraphQLError(response: any, fallback: string): string {
  if (!response) return fallback;
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    return response.errors.map((e: any) => e?.message || JSON.stringify(e)).join(' | ');
  }
  if (typeof response.error_message === 'string' && response.error_message.trim()) {
    return response.error_message;
  }
  if (response?.data?.error_message) {
    return String(response.data.error_message);
  }
  return fallback;
}

async function runMondayQuery<T = any>(
  query: string,
  variables?: Record<string, any>,
  fallbackError = 'Erreur API Monday'
): Promise<T> {
  const response = await (monday as any).api(query, variables ? { variables } : undefined);
  if (!response || (Array.isArray(response.errors) && response.errors.length > 0) || !response.data) {
    throw new Error(extractGraphQLError(response, fallbackError));
  }
  return response.data as T;
}

function mapColumnsToSchema(columns: Array<{ id: string; title: string; type: string }>): StockColumnMap {
  const map: StockColumnMap = {};
  for (const col of columns || []) {
    const title = normalizeText(col.title);
    if (!map.category && title.includes('categorie')) {
      map.category = col.id;
    } else if (!map.currentStock && (title === 'stock actuel' || title.includes('stock actuel'))) {
      map.currentStock = col.id;
    } else if (!map.minStock && (title.includes('stock mini') || title.includes('seuil'))) {
      map.minStock = col.id;
    } else if (!map.unit && title.includes('unite')) {
      map.unit = col.id;
    } else if (!map.notes && (title.includes('note') || title.includes('remarque') || title.includes('compatibilite'))) {
      map.notes = col.id;
    }
  }
  return map;
}

function buildSchemaFromBoard(board: any): StockBoardSchema {
  const columns = mapColumnsToSchema(board.columns || []);
  const groups: Array<{ id: string; title: string }> = board.groups || [];
  let partsGroupId: string | undefined;

  for (const g of groups) {
    if (normalizeText(g.title).includes('piece')) {
      partsGroupId = g.id;
      break;
    }
  }
  if (!partsGroupId && groups.length > 0) {
    partsGroupId = groups[0].id;
  }

  return {
    boardId: String(board.id),
    boardName: board.name || STOCK_BOARD_NAME,
    boardUrl: board.url || `https://groupefacility.monday.com/boards/${board.id}`,
    partsGroupId,
    columns,
  };
}

/**
 * Connecte le Hub au tableau Monday « Stock Pièces & Consommables Atelier » (#5107680355).
 */
export async function discoverStockBoard(): Promise<StockBoardSchema | null> {
  const queryFields = `
    id
    name
    state
    url
    groups {
      id
      title
    }
    columns {
      id
      title
      type
    }
  `;

  try {
    const directData = await runMondayQuery<{ boards?: any[] }>(
      `query GetDirectStockBoard($ids: [ID!]) {
        boards(ids: $ids) {
          ${queryFields}
        }
      }`,
      { ids: [STOCK_BOARD_ID] },
      'Erreur lors de la lecture du tableau Stock'
    );
    const directBoard = directData?.boards?.[0];
    if (directBoard && (!directBoard.state || directBoard.state === 'active')) {
      return buildSchemaFromBoard(directBoard);
    }
  } catch {
    // Fallback par nom dans le workspace si l'ID change un jour
  }

  const targetNormalized = normalizeText(STOCK_BOARD_NAME);
  const data = await runMondayQuery<{ boards?: any[] }>(
    `query ListStockBoards {
      boards(limit: 100) {
        ${queryFields}
      }
    }`,
    undefined,
    'Erreur lors de la recherche du tableau Stock'
  );

  const match = (data?.boards || []).find(
    (b) => (!b?.state || b.state === 'active') && normalizeText(b?.name || '') === targetNormalized
  );

  return match ? buildSchemaFromBoard(match) : null;
}

function parseNumericColumn(cv: any, fallback = 0): number {
  const rawText = typeof cv?.text === 'string' ? cv.text.trim() : '';
  if (rawText !== '') {
    const parsed = Number(rawText.replace(',', '.'));
    if (!Number.isNaN(parsed)) return Math.max(0, Math.round(parsed));
  }
  if (cv?.value) {
    try {
      const parsedJson = JSON.parse(cv.value);
      const num = Number(String(parsedJson).replace(',', '.'));
      if (!Number.isNaN(num)) return Math.max(0, Math.round(num));
    } catch {}
  }
  return fallback;
}

function parseLongTextColumn(cv: any): string {
  if (typeof cv?.text === 'string' && cv.text.trim()) {
    return cv.text.trim();
  }
  if (cv?.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && typeof parsed.text === 'string') {
        return parsed.text.trim();
      }
    } catch {}
  }
  return '';
}

/**
 * Charge l'ensemble des pièces et accessoires depuis le tableau Monday Stock.
 */
export async function fetchStockPartsFromMonday(schema: StockBoardSchema): Promise<StockItemRecord[]> {
  const allItems: any[] = [];
  let cursor: string | null = null;

  const firstData = await runMondayQuery<{ boards?: Array<{ items_page?: { cursor?: string | null; items?: any[] } }> }>(
    `query GetStockItems($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            updated_at
            group {
              id
              title
            }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`,
    { boardId: [schema.boardId] },
    'Impossible de charger les articles du tableau Stock'
  );

  const firstPage = firstData?.boards?.[0]?.items_page;
  if (firstPage?.items) allItems.push(...firstPage.items);
  cursor = firstPage?.cursor || null;

  while (cursor) {
    const nextData = await runMondayQuery<{ next_items_page?: { cursor?: string | null; items?: any[] } }>(
      `query GetNextStockItems($cursor: String!) {
        next_items_page(limit: 500, cursor: $cursor) {
          cursor
          items {
            id
            name
            updated_at
            group {
              id
              title
            }
            column_values {
              id
              text
              value
            }
          }
        }
      }`,
      { cursor },
      'Impossible de paginer les articles du tableau Stock'
    );
    const nextPage = nextData?.next_items_page;
    if (nextPage?.items) allItems.push(...nextPage.items);
    cursor = nextPage?.cursor || null;
  }

  return allItems.map((item) => {
    const colValues: Record<string, any> = {};
    for (const cv of item.column_values || []) {
      colValues[cv.id] = cv;
    }

    const catText = schema.columns.category ? colValues[schema.columns.category]?.text?.trim() : '';
    const unitText = schema.columns.unit ? colValues[schema.columns.unit]?.text?.trim() : '';
    const currentStock = schema.columns.currentStock ? parseNumericColumn(colValues[schema.columns.currentStock], 0) : 0;
    const minStock = schema.columns.minStock ? parseNumericColumn(colValues[schema.columns.minStock], 0) : 0;
    const notes = schema.columns.notes ? parseLongTextColumn(colValues[schema.columns.notes]) : '';

    return {
      id: String(item.id),
      mondayItemId: String(item.id),
      groupTitle: item.group?.title || undefined,
      name: item.name || 'Sans nom',
      category: catText || 'Général',
      currentStock,
      minStock,
      unit: unitText || 'pièce(s)',
      notes: notes || undefined,
      lastUpdated: item.updated_at || undefined,
    };
  });
}

function buildColumnValuesPayload(
  columns: StockColumnMap,
  part: Partial<Pick<StockItemRecord, 'category' | 'currentStock' | 'minStock' | 'unit' | 'notes'>>
): Record<string, any> {
  const payload: Record<string, any> = {};
  if (columns.category && part.category !== undefined) {
    payload[columns.category] = part.category || 'Général';
  }
  if (columns.currentStock && part.currentStock !== undefined) {
    payload[columns.currentStock] = String(Math.max(0, Math.round(part.currentStock)));
  }
  if (columns.minStock && part.minStock !== undefined) {
    payload[columns.minStock] = String(Math.max(0, Math.round(part.minStock)));
  }
  if (columns.unit && part.unit !== undefined) {
    payload[columns.unit] = part.unit || 'pièce(s)';
  }
  if (columns.notes && part.notes !== undefined) {
    payload[columns.notes] = { text: part.notes || '' };
  }
  return payload;
}

/**
 * Crée un nouvel article dans le tableau Monday Stock.
 */
export async function createStockItemOnMonday(
  schema: StockBoardSchema,
  part: Omit<StockItemRecord, 'id'>,
  groupId?: string
): Promise<StockItemRecord> {
  const targetGroupId = groupId || schema.partsGroupId;
  const colValues = buildColumnValuesPayload(schema.columns, part);

  const mutation = targetGroupId
    ? `mutation CreateStockItem($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
          name
          updated_at
          group {
            id
            title
          }
        }
      }`
    : `mutation CreateStockItemNoGroup($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
          name
          updated_at
          group {
            id
            title
          }
        }
      }`;

  const vars: Record<string, any> = {
    boardId: schema.boardId,
    itemName: part.name.trim(),
    columnValues: JSON.stringify(colValues),
  };
  if (targetGroupId) vars.groupId = targetGroupId;

  const data = await runMondayQuery<{ create_item?: any }>(
    mutation,
    vars,
    `Erreur création de la pièce "${part.name}"`
  );

  const created = data?.create_item;
  if (!created?.id) {
    throw new Error(`Création non confirmée pour "${part.name}"`);
  }

  return {
    ...part,
    id: String(created.id),
    mondayItemId: String(created.id),
    groupTitle: created.group?.title,
    lastUpdated: created.updated_at || new Date().toISOString(),
  };
}

/**
 * Met à jour les colonnes (et éventuellement le nom) d'une pièce sur Monday.
 */
export async function updateStockItemOnMonday(
  schema: StockBoardSchema,
  mondayItemId: string,
  updates: Partial<Pick<StockItemRecord, 'name' | 'category' | 'currentStock' | 'minStock' | 'unit' | 'notes'>>
): Promise<void> {
  const colValues = buildColumnValuesPayload(schema.columns, updates);
  if (updates.name !== undefined && updates.name.trim()) {
    colValues.name = updates.name.trim();
  }

  await runMondayQuery(
    `mutation UpdateStockItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }`,
    {
      boardId: schema.boardId,
      itemId: mondayItemId,
      columnValues: JSON.stringify(colValues),
    },
    'Erreur mise à jour de la pièce sur Monday'
  );
}

/**
 * Archive une pièce sur Monday.
 */
export async function archiveStockItemOnMonday(mondayItemId: string): Promise<void> {
  await runMondayQuery(
    `mutation ArchiveStockItem($itemId: ID!) {
      archive_item(item_id: $itemId) {
        id
      }
    }`,
    { itemId: mondayItemId },
    "Erreur lors de l'archivage de la pièce sur Monday"
  );
}
