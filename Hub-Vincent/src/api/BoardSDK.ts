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

class GenericItemsQueryBuilder {
  private boardId: number;
  private cols: string[] = [];
  private limitCount = 500;
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
    if (opts.limit) this.limitCount = opts.limit;
    if (opts.cursor) this.cursorStr = opts.cursor;
    return this;
  }

  async execute(): Promise<{ items: any[]; cursor?: string | null }> {
    const colMap = COLS_CONFIG[this.boardId] || {};
    const colIds = this.cols.map((c) => colMap[c]?.id || c).filter(Boolean);

    // Construction de la requête GraphQL
    const q = this.cursorStr
      ? `query ($c: String!) {
          next_items_page(limit: ${this.limitCount}, cursor: $c) {
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
          boards(ids: [${this.boardId}]) {
            items_page(limit: ${this.limitCount}) {
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

    const res: any = await callMondayApi(q, this.cursorStr ? { variables: { c: this.cursorStr } } : undefined);
    const page = this.cursorStr
      ? res?.next_items_page || res?.data?.next_items_page
      : res?.boards?.[0]?.items_page || res?.data?.boards?.[0]?.items_page;

    const rawItems = page?.items || [];
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

    return {
      items: parsedItems,
      cursor: page?.cursor || null,
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
        // Query items for this board with date column
        const colMap = COLS_CONFIG[this.boardId] || {};
        const dateColDef = Object.values(colMap).find((c) => c.type === 'date');
        const dateColId = dateColDef?.id;

        const q = `query {
          boards(ids: [${this.boardId}]) {
            items_page(limit: 500) {
              items {
                id
                column_values(ids: [${dateColId ? `"${dateColId}"` : ''}]) {
                  id
                  text
                }
              }
            }
          }
        }`;

        const res: any = await callMondayApi(q);
        const items = res?.boards?.[0]?.items_page?.items || res?.data?.boards?.[0]?.items_page?.items || [];

        let count = 0;
        const [fromKey, range] = Object.entries(this.whereFilters)[0] || [];
        const [start, end] = Array.isArray(range) ? range : [];

        for (const it of items) {
          if (start && end) {
            const cv = it.column_values?.[0];
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
