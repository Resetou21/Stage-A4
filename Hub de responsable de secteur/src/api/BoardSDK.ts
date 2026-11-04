import mondaySdk from 'monday-sdk-js';
import { BOARD_IDS, COLUMN_MAP } from './columnMap';

export const monday = mondaySdk();

let activeRequests = 0;
const MAX_CONCURRENT = 5;
const waitQueue: Array<() => void> = [];

const inFlightRequests = new Map<string, Promise<any>>();
const queryCache = new Map<string, { expires: number; data: any }>();

export function clearBoardCache() {
  queryCache.clear();
  inFlightRequests.clear();
}

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot() {
  activeRequests--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    if (next) next();
  }
}

export async function callMondayApi(query: string, options?: any): Promise<any> {
  const isRead = !query.includes('mutation');
  const cacheKey = isRead ? `${query}::${JSON.stringify(options ?? {})}` : null;

  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  } else {
    queryCache.clear();
  }

  const exec = async () => {
    await acquireSlot();
    let delay = 1000;
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          const res: any = await monday.api(query, options);
          if (res?.errors) {
            const isRateLimit = res.errors.some((e: any) => {
              const m = String(e?.message || '').toLowerCase();
              return m.includes('rate limit') || m.includes('complexity');
            });
            if (isRateLimit && attempt < 3) {
              console.warn(`[BoardSDK] Rate limit encountered, retrying in ${delay}ms... (attempt ${attempt + 1}/3)`);
              await new Promise((r) => setTimeout(r, delay));
              delay *= 1.5;
              continue;
            }
          }
          if (cacheKey && (!res?.errors || res.errors.length === 0)) {
            // Cache session de 5 minutes pour un affichage instantané, invalidé automatiquement à chaque modification
            queryCache.set(cacheKey, { expires: Date.now() + 300000, data: res });
          }
          return res;
        } catch (err: any) {
          const m = String(err?.message || err).toLowerCase();
          if ((m.includes('rate limit') || m.includes('complexity')) && attempt < 3) {
            console.warn(`[BoardSDK] Rate limit exception, retrying in ${delay}ms... (attempt ${attempt + 1}/3)`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 1.5;
            continue;
          }
          if (attempt === 3) throw err;
        }
      }
    } finally {
      setTimeout(() => {
        releaseSlot();
      }, 50);
      if (cacheKey) {
        inFlightRequests.delete(cacheKey);
      }
    }
  };

  if (cacheKey) {
    const promise = exec();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return exec();
}

interface PaginationOptions {
  limit?: number;
  cursor?: string | null;
}

interface OrderByOptions {
  column: string;
  direction?: 'asc' | 'desc';
}

function parseColumnValue(cv: any): any {
  if (!cv) return null;
  const text = (cv.text ?? '').trim();

  switch (cv.type) {
    case 'checkbox':
    case 'boolean': {
      if (cv.value) {
        try {
          const parsed = JSON.parse(cv.value);
          if (parsed) {
            if (parsed.checked === true || parsed.checked === 'true') return true;
            if (parsed.checked === false || parsed.checked === 'false' || parsed.checked === null) return false;
          }
        } catch (_) {}
      }
      return text.toLowerCase() === 'v' || text.toLowerCase() === 'true' || text === '✓' || text === '1';
    }

    case 'date': {
      let dateStr = text;
      if (!dateStr && cv.value) {
        try {
          const parsed = JSON.parse(cv.value);
          if (parsed && parsed.date) dateStr = parsed.date;
        } catch (_) {}
      }
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return !Number.isNaN(d.getTime()) ? d : null;
    }

    case 'board_relation': {
      const linked = cv.linked_items || [];
      return {
        linkedItems: linked.map((l: any) => ({ id: String(l.id), name: String(l.name) })),
      };
    }

    case 'mirror':
    case 'lookup': {
      const disp = cv.display_value !== undefined && cv.display_value !== null ? cv.display_value : text;
      return {
        displayValue: disp !== '' ? disp : null,
      };
    }

    case 'numbers':
    case 'numeric': {
      if (text === '' || text === null) return null;
      const n = Number(text.replace(',', '.').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    case 'formula': {
      return text !== '' ? text : null;
    }

    case 'dropdown': {
      if (!text) return [];
      return text.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    case 'status':
    case 'color':
    case 'text':
    default: {
      return text !== '' ? text : null;
    }
  }
}

function parseItem(rawItem: any, boardId: string, neededFields: string[] = []): any {
  const map = COLUMN_MAP[boardId] || {};
  const result: Record<string, any> = {
    id: String(rawItem.id),
    name: rawItem.name,
    createdAt: rawItem.created_at || null,
    group: rawItem.group ? { id: rawItem.group.id, title: rawItem.group.title } : undefined,
  };

  const cvMap = new Map<string, any>();
  for (const cv of rawItem.column_values || []) {
    cvMap.set(cv.id, cv);
  }

  const fields = neededFields.length > 0 ? neededFields : Object.keys(map);

  for (const field of fields) {
    const meta = map[field];
    if (!meta) continue;
    const cv = cvMap.get(meta.id);
    result[field] = cv ? parseColumnValue(cv) : null;
  }

  // Sous-éléments
  if (rawItem.subitems && rawItem.subitems.length > 0) {
    const subMap = COLUMN_MAP[BOARD_IDS.SUBITEMS_VISITES_CLIENTS] || {};
    result.subitems = rawItem.subitems.map((sub: any) => {
      const subRes: Record<string, any> = { id: String(sub.id), name: sub.name };
      const scvMap = new Map<string, any>((sub.column_values || []).map((c: any) => [c.id, c]));
      for (const [sField, sMeta] of Object.entries(subMap)) {
        const scv = scvMap.get(sMeta.id);
        subRes[sField] = scv ? parseColumnValue(scv) : null;
      }
      return subRes;
    });
  }

  return result;
}

function matchesFilters(item: any, filters: Record<string, any>): boolean {
  for (const [key, expected] of Object.entries(filters)) {
    if (expected === undefined) continue;

    // Filtre sur le groupe
    if (key === 'group') {
      const groupId = item.group?.id;
      if (Array.isArray(expected)) {
        if (!expected.includes(groupId)) return false;
      } else if (groupId !== expected) {
        return false;
      }
      continue;
    }

    const val = item[key];

    // Objet avec opérateur (ex: { isEmpty: false } ou { itemIds: [...] })
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      if ('isEmpty' in expected) {
        const isEmpty = val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
        if (expected.isEmpty && !isEmpty) return false;
        if (!expected.isEmpty && isEmpty) return false;
        continue;
      }

      if ('itemIds' in expected && Array.isArray(expected.itemIds)) {
        const linkedIds = (val?.linkedItems || []).map((l: any) => String(l.id));
        const hasMatch = expected.itemIds.some((id: string) => linkedIds.includes(String(id)));
        if (!hasMatch) return false;
        continue;
      }

      if ('gte' in expected) {
        if (!val) return false;
        const vIso = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
        if (vIso < String(expected.gte)) return false;
        continue;
      }
    }

    // Miroir avec displayValue
    if (val && typeof val === 'object' && 'displayValue' in val) {
      const d = String(val.displayValue ?? '').trim().toLowerCase();
      const exp = String(expected).trim().toLowerCase();
      if (!d.includes(exp)) return false;
      continue;
    }

    // Tableau de valeurs acceptées
    if (Array.isArray(expected)) {
      if (!expected.includes(val)) return false;
      continue;
    }

    // Égalité simple (case-insensitive si string)
    if (typeof val === 'string' && typeof expected === 'string') {
      if (val.trim().toLowerCase() !== expected.trim().toLowerCase()) return false;
      continue;
    }

    if (val !== expected) {
      return false;
    }
  }

  return true;
}

class QueryBuilder<T = any> {
  private _columns: string[] = [];
  private _subItemsColumns: string[] = [];
  private _filters: Record<string, any> = {};
  private _pagination?: PaginationOptions;
  private _orderBy?: OrderByOptions;

  constructor(private boardId: string) {}

  withColumns(columns: string[]): this {
    this._columns = columns;
    return this;
  }

  withSubItems(columns: string[]): this {
    this._subItemsColumns = columns;
    return this;
  }

  where(filter: Record<string, any>): this {
    this._filters = { ...this._filters, ...filter };
    return this;
  }

  orderBy(order: OrderByOptions): this {
    this._orderBy = order;
    return this;
  }

  withPagination(options: PaginationOptions): this {
    this._pagination = options;
    return this;
  }

  async execute(): Promise<{ items: T[]; cursor?: string | null }> {
    const map = COLUMN_MAP[this.boardId] || {};

    // Champs nécessaires : colonnes demandées + colonnes de filtrage (ex: animateur)
    const neededFields = new Set<string>([
      ...this._columns,
      ...Object.keys(this._filters).filter((k) => k !== 'group'),
    ]);

    // IDs de colonnes monday réelles à récupérer
    const colIds: string[] = [];
    for (const f of neededFields) {
      const meta = map[f];
      if (meta && !colIds.includes(meta.id)) {
        colIds.push(meta.id);
      }
    }

    const hasSubitems = this._subItemsColumns.length > 0;
    const subMap = COLUMN_MAP[BOARD_IDS.SUBITEMS_VISITES_CLIENTS] || {};
    const subColIds: string[] = this._subItemsColumns
      .map((f) => subMap[f]?.id)
      .filter((id): id is string => Boolean(id));

    // Construction optimisée des fragments GraphQL
    const cvFragment = colIds.length > 0
      ? `column_values(ids: ${JSON.stringify(colIds)})`
      : `column_values`;

    const subFragment = hasSubitems
      ? `subitems {
          id
          name
          ${subColIds.length > 0 ? `column_values(ids: ${JSON.stringify(subColIds)})` : `column_values`} {
            id
            type
            text
            value
          }
        }`
      : '';

    // Optimisation serveur : filtrage natif sur TableauCompletChantier par Animateur
    // et sur VisitesClients par date
    let queryParams: any = undefined;
    if (this.boardId === BOARD_IDS.TABLEAU_COMPLET_CHANTIER && this._filters.animateur) {
      const anim = String(this._filters.animateur).toLowerCase();
      let animIndex: number | null = null;
      if (anim.includes('natacha')) animIndex = 0;
      else if (anim.includes('ketty')) animIndex = 1;
      else if (anim.includes('emilie')) animIndex = 3;
      else if (anim.includes('andre')) animIndex = 7;

      if (animIndex !== null) {
        queryParams = {
          rules: [
            {
              column_id: 'color_mkrbk3jy',
              compare_value: [animIndex],
              operator: 'any_of',
            },
          ],
        };
      }
    } else if (this.boardId === BOARD_IDS.VISITES_CLIENTS && this._filters.dateVisiteClient) {
      const df = this._filters.dateVisiteClient;
      const gte = typeof df === 'object' && df !== null ? df.gte || df.greater_than_or_equals : null;
      if (gte) {
        queryParams = {
          rules: [
            {
              column_id: 'date_mkrcgy18',
              compare_value: [String(gte)],
              operator: 'greater_than_or_equals',
            },
          ],
        };
      }
    }

    // Requête avec cursor pour les pages suivantes (Monday interdit strictement query_params avec cursor)
    const queryWithCursor = `
      query GetBoardItemsWithCursor($boardId: [ID!], $limit: Int, $cursor: String!) {
        boards(ids: $boardId) {
          items_page(limit: $limit, cursor: $cursor) {
            cursor
            items {
              id
              name
              created_at
              group {
                id
                title
              }
              ${cvFragment} {
                id
                type
                text
                value
                ... on MirrorValue {
                  display_value
                }
                ... on BoardRelationValue {
                  linked_item_ids
                  linked_items {
                    id
                    name
                  }
                }
              }
              ${subFragment}
            }
          }
        }
      }
    `;

    // Requête initiale (sans cursor) avec query_params éventuels
    const queryInitial = `
      query GetBoardItemsInit($boardId: [ID!], $limit: Int, $queryParams: ItemsQuery) {
        boards(ids: $boardId) {
          items_page(limit: $limit, query_params: $queryParams) {
            cursor
            items {
              id
              name
              created_at
              group {
                id
                title
              }
              ${cvFragment} {
                id
                type
                text
                value
                ... on MirrorValue {
                  display_value
                }
                ... on BoardRelationValue {
                  linked_item_ids
                  linked_items {
                    id
                    name
                  }
                }
              }
              ${subFragment}
            }
          }
        }
      }
    `;

    const rawItems: any[] = [];
    const limit = this._pagination?.limit ?? (hasSubitems ? 100 : 500);
    let curCursor = this._pagination?.cursor ?? null;

    try {
      let res: any;
      if (curCursor) {
        res = await callMondayApi(queryWithCursor, {
          variables: {
            boardId: [this.boardId],
            limit,
            cursor: curCursor,
          },
        });
      } else {
        res = await callMondayApi(queryInitial, {
          variables: {
            boardId: [this.boardId],
            limit,
            queryParams: queryParams || null,
          },
        });
      }

      if (res?.errors) {
        console.error('[BoardSDK Error]:', res.errors);
      }

      const pageData = res?.data?.boards?.[0]?.items_page ?? res?.boards?.[0]?.items_page;
      if (pageData?.items) {
        rawItems.push(...pageData.items);
      }
      curCursor = pageData?.cursor ?? null;

      // Si le code appelant ne gère pas la pagination lui-même, on boucle jusqu'à la fin
      if (!this._pagination) {
        while (curCursor) {
          const nextRes: any = await callMondayApi(queryWithCursor, {
            variables: {
              boardId: [this.boardId],
              limit,
              cursor: curCursor,
            },
          });
          const nextPage = nextRes?.data?.boards?.[0]?.items_page ?? nextRes?.boards?.[0]?.items_page;
          if (!nextPage?.items || nextPage.items.length === 0) break;
          rawItems.push(...nextPage.items);
          curCursor = nextPage.cursor ?? null;
        }
      }
    } catch (err) {
      console.error('[BoardSDK Network Exception]:', err);
    }

    // Parsing avec l'ensemble des champs utiles (incluant animateur)
    let parsed = rawItems.map((it) => parseItem(it, this.boardId, Array.from(neededFields)));

    // Application des filtres
    if (Object.keys(this._filters).length > 0) {
      parsed = parsed.filter((it) => matchesFilters(it, this._filters));
    }

    // Tri si spécifié
    if (this._orderBy) {
      const { column, direction = 'asc' } = this._orderBy;
      parsed.sort((a, b) => {
        let va = a[column];
        let vb = b[column];
        if (va instanceof Date) va = va.getTime();
        if (vb instanceof Date) vb = vb.getTime();
        if (va == null && vb == null) return 0;
        if (va == null) return direction === 'asc' ? -1 : 1;
        if (vb == null) return direction === 'asc' ? 1 : -1;
        if (va < vb) return direction === 'asc' ? -1 : 1;
        if (va > vb) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return {
      items: parsed as T[],
      cursor: curCursor,
    };
  }
}

class ItemBuilder<T = any> {
  private _columns: string[] = [];
  private _action: 'get' | 'update' | 'create' | 'archive' = 'get';
  private _patchData: any = null;
  private _createData: any = null;
  private _group?: string;

  constructor(private boardId: string, private itemId?: string) {}

  withColumns(columns: string[]): this {
    this._columns = columns;
    return this;
  }

  create(data: any): this {
    this._action = 'create';
    this._createData = data;
    return this;
  }

  update(patch: any): this {
    this._action = 'update';
    this._patchData = patch;
    return this;
  }

  inGroup(group: string): this {
    this._group = group;
    return this;
  }

  archive(): this {
    this._action = 'archive';
    return this;
  }

  async execute(): Promise<any> {
    // 1. UPDATE
    if (this._action === 'update') {
      if (!this.itemId) throw new Error('itemId requis pour update');
      const map = COLUMN_MAP[this.boardId] || {};
      const columnValues: Record<string, any> = {};

      for (const [key, val] of Object.entries(this._patchData || {})) {
        if (key === 'name') continue;
        const meta = map[key];
        if (!meta) continue;
        const colId = meta.id;

        switch (meta.type) {
          case 'numbers':
          case 'numeric':
            columnValues[colId] = val !== null && val !== undefined && String(val).trim() !== '' ? String(val) : '';
            break;
          case 'checkbox':
          case 'boolean':
            columnValues[colId] = { checked: Boolean(val) };
            break;
          case 'date':
            if (val instanceof Date) {
              columnValues[colId] = { date: val.toISOString().slice(0, 10) };
            } else if (val && String(val).trim()) {
              columnValues[colId] = { date: String(val).slice(0, 10) };
            } else {
              columnValues[colId] = {};
            }
            break;
          case 'dropdown':
            if (Array.isArray(val)) {
              columnValues[colId] = { labels: val.map((s) => String(s).trim()).filter(Boolean) };
            } else if (val && String(val).trim()) {
              columnValues[colId] = { labels: [String(val).trim()] };
            } else {
              columnValues[colId] = { labels: [] };
            }
            break;
          case 'status':
          case 'color':
            columnValues[colId] = val && String(val).trim() ? { label: String(val).trim() } : {};
            break;
          case 'board_relation':
            if (val && typeof val === 'object' && Array.isArray((val as any).linkedItems)) {
              columnValues[colId] = { item_ids: (val as any).linkedItems.map((l: any) => Number(l.id)) };
            }
            break;
          default:
            columnValues[colId] = val !== null && val !== undefined ? String(val) : '';
            break;
        }
      }

      if (Object.keys(columnValues).length > 0) {
        const mutation = `
          mutation UpdateItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!, $createLabelsIfMissing: Boolean) {
            change_multiple_column_values(
              board_id: $boardId, 
              item_id: $itemId, 
              column_values: $columnValues, 
              create_labels_if_missing: $createLabelsIfMissing
            ) {
              id
            }
          }
        `;

        const res = await callMondayApi(mutation, {
          variables: {
            boardId: this.boardId,
            itemId: this.itemId,
            columnValues: JSON.stringify(columnValues),
            createLabelsIfMissing: true,
          },
        });

        if (res?.errors) {
          console.error('[BoardSDK Update Error]:', res.errors);
          throw new Error(res.errors[0]?.message || 'Update failed');
        }
      }

      if (this._patchData && typeof this._patchData.name === 'string' && this._patchData.name.trim()) {
        const nameMutation = `
          mutation ChangeItemName($boardId: ID!, $itemId: ID!, $name: String!) {
            change_simple_column_value(
              board_id: $boardId,
              item_id: $itemId,
              column_id: "name",
              value: $name
            ) {
              id
              name
            }
          }
        `;
        try {
          const nameRes = await callMondayApi(nameMutation, {
            variables: {
              boardId: this.boardId,
              itemId: this.itemId,
              name: this._patchData.name.trim(),
            },
          });
          if (nameRes?.errors) {
            console.error('[BoardSDK] Error updating item name on Monday:', nameRes.errors);
          }
        } catch (e) {
          console.warn('[BoardSDK] Could not change item name:', e);
        }
      }

      return { id: this.itemId };
    }

    // 2. CREATE
    if (this._action === 'create') {
      const map = COLUMN_MAP[this.boardId] || {};
      const data = this._createData || {};
      const itemName = data.name || 'Nouveau site';
      const columnValues: Record<string, any> = {};

      for (const [key, val] of Object.entries(data)) {
        if (key === 'name') continue;
        const meta = map[key];
        if (!meta) continue;
        const colId = meta.id;

        switch (meta.type) {
          case 'numbers':
          case 'numeric':
            if (val !== null && val !== undefined) columnValues[colId] = String(val);
            break;
          case 'checkbox':
          case 'boolean':
            if (val) columnValues[colId] = { checked: 'true' };
            break;
          case 'date':
            if (val instanceof Date) {
              columnValues[colId] = { date: val.toISOString().slice(0, 10) };
            } else if (val) {
              columnValues[colId] = { date: String(val).slice(0, 10) };
            }
            break;
          case 'dropdown':
            if (Array.isArray(val) && val.length > 0) {
              columnValues[colId] = { labels: val.map((s) => String(s).trim()).filter(Boolean) };
            } else if (val && String(val).trim()) {
              columnValues[colId] = { labels: [String(val).trim()] };
            }
            break;
          case 'status':
          case 'color':
            if (val && String(val).trim()) {
              columnValues[colId] = { label: String(val).trim() };
            }
            break;
          case 'board_relation':
            if (val && typeof val === 'object' && Array.isArray((val as any).linkedItems)) {
              columnValues[colId] = { item_ids: (val as any).linkedItems.map((l: any) => Number(l.id)) };
            }
            break;
          default:
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              columnValues[colId] = String(val);
            }
            break;
        }
      }

      const mutation = `
        mutation CreateItem($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON) {
          create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
            id
            name
          }
        }
      `;

      const res = await callMondayApi(mutation, {
        variables: {
          boardId: this.boardId,
          groupId: this._group || null,
          itemName,
          columnValues: JSON.stringify(columnValues),
        },
      });

      if (res?.errors) {
        console.error('[BoardSDK Create Error]:', res.errors);
        throw new Error(res.errors[0]?.message || 'Create failed');
      }

      const created = res?.data?.create_item ?? res?.create_item;
      return created ? { id: String(created.id), name: created.name } : null;
    }

    // 3. ARCHIVE
    if (this._action === 'archive') {
      if (!this.itemId) throw new Error('itemId requis pour archive');
      const mutation = `
        mutation ArchiveItem($itemId: ID!) {
          archive_item(item_id: $itemId) {
            id
          }
        }
      `;

      const res = await callMondayApi(mutation, {
        variables: { itemId: this.itemId },
      });

      if (res?.errors) {
        console.error('[BoardSDK Archive Error]:', res.errors);
        throw new Error(res.errors[0]?.message || 'Archive failed');
      }

      return { id: this.itemId };
    }

    // 4. GET SINGLE ITEM
    if (!this.itemId) {
      return null;
    }

    const map = COLUMN_MAP[this.boardId] || {};
    const colIds = this._columns
      .map((f) => map[f]?.id)
      .filter((id): id is string => Boolean(id));

    const query = `
      query GetSingleItem($id: [ID!]) {
        items(ids: $id) {
          id
          name
          group {
            id
            title
          }
          ${colIds.length > 0 ? `column_values(ids: ${JSON.stringify(colIds)})` : `column_values`} {
            id
            type
            text
            value
            ... on MirrorValue {
              display_value
            }
            ... on BoardRelationValue {
              linked_item_ids
              linked_items {
                id
                name
              }
            }
          }
        }
      }
    `;

    try {
      const res: any = await callMondayApi(query, {
        variables: { id: [this.itemId] },
      });

      const it = res?.data?.items?.[0] ?? res?.items?.[0];
      if (!it) return null;

      return parseItem(it, this.boardId, this._columns) as T;
    } catch (err) {
      console.error('[BoardSDK Single Item Exception]:', err);
      return null;
    }
  }
}

export class TableauCompletChantierBoard {
  static readonly boardId = BOARD_IDS.TABLEAU_COMPLET_CHANTIER;

  items(): QueryBuilder<any> {
    return new QueryBuilder(TableauCompletChantierBoard.boardId);
  }

  item(id?: string): ItemBuilder<any> {
    return new ItemBuilder(TableauCompletChantierBoard.boardId, id);
  }
}

export class InventairesConsommablesBoard {
  static readonly boardId = BOARD_IDS.INVENTAIRES_CONSOMMABLES;

  items(): QueryBuilder<any> {
    return new QueryBuilder(InventairesConsommablesBoard.boardId);
  }

  item(id?: string): ItemBuilder<any> {
    return new ItemBuilder(InventairesConsommablesBoard.boardId, id);
  }
}

export class VisitesClientsBoard {
  static readonly boardId = BOARD_IDS.VISITES_CLIENTS;

  items(): QueryBuilder<any> {
    return new QueryBuilder(VisitesClientsBoard.boardId);
  }

  item(id?: string): ItemBuilder<any> {
    return new ItemBuilder(VisitesClientsBoard.boardId, id);
  }
}

export class CommunicationViaLesAnimatricesBoard {
  static readonly boardId = BOARD_IDS.COMMUNICATION_ANIMATRICES;

  items(): QueryBuilder<any> {
    return new QueryBuilder(CommunicationViaLesAnimatricesBoard.boardId);
  }

  item(id?: string): ItemBuilder<any> {
    return new ItemBuilder(CommunicationViaLesAnimatricesBoard.boardId, id);
  }
}
