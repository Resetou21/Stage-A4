import { callMondayApi } from './mondayApi';

export const BOARD_IDS = {
  PLAN_DACTION_VEHICULE: 5093104791,
  CONTROLE_VISUEL_VEHICULE: 5093072539,
  INFORMATIONS_MENSUELLES: 5092559599,
  IMPACT_FINANCIER: 5086406201,
  DATA_SUR_VEHICULE: 5092124669,
  DATA_WELLBORNE: 5106822028,
  REUNION_ASSOCIES: 5099650983,
};

// ==================== CONFIG DES COLONNES ====================

const COLS_CONFIG: Record<number, Record<string, { id: string; type: string }>> = {
  [BOARD_IDS.INFORMATIONS_MENSUELLES]: {
    moisConcern: { id: 'date_mm12ry9e', type: 'date' },
    caBudget: { id: 'numeric_mm12f91j', type: 'numeric' },
    caRalis: { id: 'numeric_mm12qs6w', type: 'numeric' },
    rsBudget: { id: 'numeric_mm12edk3', type: 'numeric' },
    resRalis: { id: 'numeric_mm12bq7t', type: 'numeric' },
  },
  [BOARD_IDS.IMPACT_FINANCIER]: {
    date: { id: 'date_mkxsjr3k', type: 'date' },
    fournisseur: { id: 'text_mkxsem47', type: 'text' },
    montantHt: { id: 'numeric_mkxsqn5a', type: 'numeric' },
    catgorie: { id: 'color_mkxsg2pr', type: 'status' },
  },
  [BOARD_IDS.PLAN_DACTION_VEHICULE]: {
    dateContrle: { id: 'date4', type: 'date' },
    immat: { id: 'text_mm1c48mm', type: 'text' },
    zone: { id: 'text_mm1cvtge', type: 'text' },
    actionEntreprendre: { id: 'text_mm1c1373', type: 'text' },
    actionRalise: { id: 'color_mm1cb4ka', type: 'status' },
    dateRalisation: { id: 'date_mm1cnqqk', type: 'date' },
  },
  [BOARD_IDS.CONTROLE_VISUEL_VEHICULE]: {
    dateDuContrle: { id: 'date_mm1cfecy', type: 'date' },
  },
};

// ==================== ITEMS QUERY BUILDER ====================

const boardCache = new Map<number, { items: any[]; expires: number }>();
const boardInFlight = new Map<number, Promise<any[]>>();

export function invalidateBoardCache(boardId?: number) {
  if (!boardId) {
    boardCache.clear();
    boardInFlight.clear();
  } else {
    boardCache.delete(boardId);
    boardInFlight.delete(boardId);
  }
}

async function getRawBoardItems(boardId: number): Promise<any[]> {
  const cached = boardCache.get(boardId);
  if (cached && Date.now() < cached.expires) {
    return cached.items;
  }
  const inFlight = boardInFlight.get(boardId);
  if (inFlight) {
    return inFlight;
  }

  const p = (async () => {
    const colMap = COLS_CONFIG[boardId] || {};
    const colIds = Object.values(colMap).map((c) => c.id);

    let allItems: any[] = [];
    let cursor: string | null = null;

    do {
      const q = cursor
        ? `query ($c: String!) {
            next_items_page(limit: 500, cursor: $c) {
              cursor
              items {
                id
                name
                group { id title }
                column_values(ids: ${JSON.stringify(colIds)}) {
                  id
                  text
                  value
                }
              }
            }
          }`
        : `query {
            boards(ids: [${boardId}]) {
              items_page(limit: 500) {
                cursor
                items {
                  id
                  name
                  group { id title }
                  column_values(ids: ${JSON.stringify(colIds)}) {
                    id
                    text
                    value
                  }
                }
              }
            }
          }`;

      const res: any = await callMondayApi(q, cursor ? { variables: { c: cursor } } : undefined);
      const page = cursor
        ? res?.next_items_page || res?.data?.next_items_page
        : res?.boards?.[0]?.items_page || res?.data?.boards?.[0]?.items_page;

      const pageItems = page?.items || [];
      allItems = allItems.concat(pageItems);
      cursor = page?.cursor || null;
    } while (cursor && allItems.length < 5000);

    boardCache.set(boardId, { items: allItems, expires: Date.now() + 60_000 });
    return allItems;
  })();

  boardInFlight.set(boardId, p);
  try {
    return await p;
  } finally {
    boardInFlight.delete(boardId);
  }
}

class GenericItemsQueryBuilder {
  private boardId: number;
  private cols: string[] = [];
  private limitCount?: number;
  private cursorStr?: string;
  private whereFilters: Record<string, any> = {};
  private orderConfig?: { column: string; direction: 'asc' | 'desc' };

  constructor(boardId: number) {
    this.boardId = boardId;
  }

  withColumns(cols: string[]) {
    this.cols = cols;
    return this;
  }

  where(filters: Record<string, any>) {
    this.whereFilters = { ...this.whereFilters, ...filters };
    return this;
  }

  orderBy(order: { column: string; direction: 'asc' | 'desc' }) {
    this.orderConfig = order;
    return this;
  }

  withPagination(opts: { limit?: number; cursor?: string | null }) {
    if (opts.limit) this.limitCount = Math.min(Math.max(1, opts.limit), 500);
    if (opts.cursor) this.cursorStr = opts.cursor;
    return this;
  }

  async execute(): Promise<{ items: any[]; cursor?: string | null }> {
    const colMap = COLS_CONFIG[this.boardId] || {};
    const colIds = this.cols.map((c) => colMap[c]?.id || c).filter(Boolean);

    let rawItems: any[] = [];
    let pageCursor: string | null = null;

    if (this.cursorStr) {
      const q = `query ($c: String!) {
        next_items_page(limit: ${this.limitCount || 500}, cursor: $c) {
          cursor
          items {
            id
            name
            group { id title }
            column_values(ids: ${JSON.stringify(colIds)}) {
              id
              text
              value
            }
          }
        }
      }`;
      const res: any = await callMondayApi(q, { variables: { c: this.cursorStr } });
      const page = res?.next_items_page || res?.data?.next_items_page;
      rawItems = page?.items || [];
      pageCursor = page?.cursor || null;
    } else {
      rawItems = await getRawBoardItems(this.boardId);
    }

    let parsedItems = rawItems.map((item: any) => {
      const obj: Record<string, any> = {
        id: item.id,
        name: item.name,
        group: item.group?.id,
        groupTitle: item.group?.title,
      };

      for (const colKey of this.cols) {
        const colDef = colMap[colKey];
        const targetId = colDef?.id || colKey;
        const cv = item.column_values?.find((v: any) => v.id === targetId);

        if (cv) {
          const type = colDef?.type;
          const text = cv.text?.trim() || '';

          if (type === 'numeric') {
            const valNum = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
            obj[colKey] = Number.isNaN(valNum) ? null : valNum;
          } else {
            obj[colKey] = text || null;
          }
        } else {
          obj[colKey] = null;
        }
      }

      return obj;
    });

    // Filtrage en mémoire selon les règles 'where'
    if (Object.keys(this.whereFilters).length > 0) {
      parsedItems = parsedItems.filter((item: any) => {
        for (const [k, v] of Object.entries(this.whereFilters)) {
          if (k === 'group') {
            if (item.group !== v) return false;
          } else if (Array.isArray(v) && v.length === 2) {
            // Plage [start, end]
            const val = item[k];
            if (!val) return false;
            const start = v[0];
            const end = v[1];
            if (val < start || val > end) return false;
          } else if (typeof v === 'object' && v !== null && (v as any).between) {
            const val = item[k];
            if (!val) return false;
            const [start, end] = (v as any).between;
            if (val < start || val > end) return false;
          } else {
            if (item[k] !== v) return false;
          }
        }
        return true;
      });
    }

    // Tri en mémoire si demandé
    if (this.orderConfig) {
      const { column, direction } = this.orderConfig;
      parsedItems.sort((a: any, b: any) => {
        const valA = a[column] ?? '';
        const valB = b[column] ?? '';
        const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    const finalItems = (this.limitCount && !this.cursorStr)
      ? parsedItems.slice(0, this.limitCount)
      : parsedItems;

    return {
      items: finalItems,
      cursor: pageCursor,
    };
  }
}

// ==================== AGGREGATE BUILDER ====================

class GenericAggregateBuilder {
  private boardId: number;
  private whereFilters: Record<string, any> = {};

  constructor(boardId: number) {
    this.boardId = boardId;
  }

  where(filters: Record<string, any>) {
    this.whereFilters = { ...this.whereFilters, ...filters };
    return this;
  }

  countItems(_alias = 'total') {
    return {
      execute: async (): Promise<Array<{ total: number }>> => {
        const rawItems = await getRawBoardItems(this.boardId);
        const colMap = COLS_CONFIG[this.boardId] || {};
        const dateColDef = Object.values(colMap).find((c) => c.type === 'date');
        const dateColId = dateColDef?.id;

        let count = 0;
        const [fromKey, range] = Object.entries(this.whereFilters)[0] || [];
        const [start, end] = Array.isArray(range) ? range : [];

        for (const it of rawItems) {
          if (start && end) {
            const cv = it.column_values?.find((c: any) => c.id === dateColId);
            const dateStr = cv?.text?.trim();
            if (dateStr && dateStr >= start && dateStr <= end) {
              count++;
            }
          } else {
            count++;
          }
        }

        return [{ total: count }];
      },
    };
  }
}

// ==================== BOARD CLASSES ====================

class BaseBoard {
  protected boardId: number;

  constructor(boardId: number) {
    this.boardId = boardId;
  }

  items() {
    return new GenericItemsQueryBuilder(this.boardId);
  }

  aggregate() {
    return new GenericAggregateBuilder(this.boardId);
  }

  async executeGraphQL(query: string, variables?: Record<string, unknown>): Promise<any> {
    return callMondayApi(query, variables ? { variables } : undefined);
  }
}

export class InformationsMensuellesBoard extends BaseBoard {
  constructor() {
    super(BOARD_IDS.INFORMATIONS_MENSUELLES);
  }
}

export class ImpactFinancierBoard extends BaseBoard {
  constructor() {
    super(BOARD_IDS.IMPACT_FINANCIER);
  }
}

export class PlanDactionVehiculeBoard extends BaseBoard {
  constructor() {
    super(BOARD_IDS.PLAN_DACTION_VEHICULE);
  }
}

export class ControleVisuelVehiculeBoard extends BaseBoard {
  constructor() {
    super(BOARD_IDS.CONTROLE_VISUEL_VEHICULE);
  }
}
