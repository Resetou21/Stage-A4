import { callMondayApi } from './mondayApi';

export const BOARD_IDS = {
  DATA_SUR_VEHICULE: 5092124669,
  FACTURE_CHARGEMAP: 5092349771,
  FACTURE_TOTAL: 5092674084,
  DATA_WELLBORNE: 5106822028,
  REPARATION_MACHINES: 5106693291,
  SUIVI_PARC_VEHICULES: 5092005027,
};

const DATA_SUR_VEHICULE_COLS: Record<string, { id: string; type: string }> = {
  name: { id: 'name', type: 'name' },
  dateInfo: { id: 'date4', type: 'date' },
  chargemap: { id: 'text_mm0xccqy', type: 'text' },
  kmRelev: { id: 'numeric_mm0r9f1k', type: 'numeric' },
  fournisseur: { id: 'dropdown_mm0rw6zg', type: 'dropdown' },
  prestationRalise: { id: 'dropdown_mm0r2vyg', type: 'dropdown' },
  montantHt: { id: 'numeric_mm0r8ag0', type: 'numeric' },
  vhiculeConcern: { id: 'board_relation_mm0rm9h1', type: 'board_relation' },
  menuDeSaisie: { id: 'single_select0akaarp', type: 'status' },
  immat: { id: 'text_mm0xqkkm', type: 'text' },
  kwh: { id: 'numeric_mm2749jt', type: 'numeric' },
};

class ItemsQueryBuilder {
  private boardId: number;
  private cols: string[] = [];
  private groupFilter?: string;
  private dateBetween?: [string, string];
  private limitCount = 500;
  private cursorStr?: string;

  constructor(boardId: number) {
    this.boardId = boardId;
  }

  withColumns(cols: string[]) {
    this.cols = cols;
    return this;
  }

  where(filter: { group?: string; dateInfo?: { between?: [string, string] } }) {
    if (filter.group) this.groupFilter = filter.group;
    if (filter.dateInfo?.between) this.dateBetween = filter.dateInfo.between;
    return this;
  }

  orderBy(_sort: { column: string; direction: 'asc' | 'desc' }) {
    return this;
  }

  withPagination(opts: { limit?: number; cursor?: string | null }) {
    if (opts.limit) this.limitCount = opts.limit;
    if (opts.cursor) this.cursorStr = opts.cursor;
    return this;
  }

  async execute(): Promise<{ items: any[]; cursor?: string | null }> {
    const colIds = this.cols
      .map((c) => DATA_SUR_VEHICULE_COLS[c]?.id)
      .filter((id): id is string => Boolean(id));

    let query: string;
    let vars: any = {};

    if (this.cursorStr) {
      query = `
        query ($c: String!) {
          next_items_page(limit: ${this.limitCount}, cursor: $c) {
            cursor
            items {
              id
              name
              group { id title }
              column_values${colIds.length ? `(ids: ${JSON.stringify(colIds)})` : ''} {
                id
                text
                value
              }
            }
          }
        }
      `;
      vars = { c: this.cursorStr };
    } else {
      query = `
        query {
          boards(ids: [${this.boardId}]) {
            ${this.groupFilter ? `groups(ids: ["${this.groupFilter}"]) {` : ''}
              items_page(limit: ${this.limitCount}) {
                cursor
                items {
                  id
                  name
                  group { id title }
                  column_values${colIds.length ? `(ids: ${JSON.stringify(colIds)})` : ''} {
                    id
                    text
                    value
                  }
                }
              }
            ${this.groupFilter ? `}` : ''}
          }
        }
      `;
    }

    const res = await callMondayApi(query, vars ? { variables: vars } : undefined);
    let page: any;
    if (this.cursorStr) {
      page = res?.next_items_page;
    } else if (this.groupFilter) {
      page = res?.boards?.[0]?.groups?.[0]?.items_page;
    } else {
      page = res?.boards?.[0]?.items_page;
    }

    const rawItems = page?.items ?? [];
    const items = rawItems.map((it: any) => {
      const obj: any = { id: it.id, name: it.name, group: it.group };
      const byColId = new Map(it.column_values?.map((c: any) => [c.id, c]) || []);

      for (const [key, mapping] of Object.entries(DATA_SUR_VEHICULE_COLS)) {
        const valObj: any = byColId.get(mapping.id);
        if (!valObj) continue;
        const text = valObj.text ?? '';
        if (mapping.type === 'numeric') {
          obj[key] = text ? Number(text.replace(',', '.')) : null;
        } else if (mapping.type === 'date') {
          obj[key] = text;
        } else if (mapping.type === 'dropdown') {
          obj[key] = text ? text.split(',').map((s: string) => s.trim()) : [];
        } else {
          obj[key] = text;
        }
      }
      return obj;
    });

    let filtered = items;
    if (this.dateBetween) {
      const [start, end] = this.dateBetween;
      filtered = items.filter((it: any) => {
        if (!it.dateInfo) return false;
        return it.dateInfo >= start && it.dateInfo <= end;
      });
    }

    return {
      items: filtered,
      cursor: page?.cursor ?? null,
    };
  }
}

class ItemCreateBuilder {
  private boardId: number;
  private data: any = {};
  private targetGroup = 'topics';

  constructor(boardId: number, data: any = {}) {
    this.boardId = boardId;
    this.data = data;
  }

  inGroup(group: string) {
    this.targetGroup = group;
    return this;
  }

  async execute(): Promise<{ id: string | null }> {
    const colVals: Record<string, any> = {};

    for (const [field, val] of Object.entries(this.data)) {
      if (val === undefined || val === null) continue;
      const mapping = DATA_SUR_VEHICULE_COLS[field];
      if (!mapping || mapping.id === 'name') continue;

      if (mapping.type === 'date') {
        const d = val instanceof Date ? val : new Date(String(val));
        colVals[mapping.id] = { date: d.toISOString().slice(0, 10) };
      } else if (mapping.type === 'numeric') {
        colVals[mapping.id] = String(val);
      } else if (mapping.type === 'status') {
        colVals[mapping.id] = { label: String(val) };
      } else if (mapping.type === 'dropdown') {
        const arr = Array.isArray(val) ? val : [String(val)];
        colVals[mapping.id] = { labels: arr };
      } else if (mapping.type === 'board_relation') {
        const itemIds = (val as any)?.linkedItems?.map((x: any) => x.id) ?? [];
        if (itemIds.length) {
          colVals[mapping.id] = { item_ids: itemIds.map(Number) };
        }
      } else {
        colVals[mapping.id] = String(val);
      }
    }

    const name = this.data.name || this.data.vehiculeName || 'Nouvelle Saisie';
    const mutation = `
      mutation ($name: String!, $vals: JSON!) {
        create_item(
          board_id: ${this.boardId},
          group_id: "${this.targetGroup}",
          item_name: $name,
          column_values: $vals,
          create_labels_if_missing: true
        ) {
          id
        }
      }
    `;

    const res = await callMondayApi(mutation, {
      variables: {
        name,
        vals: JSON.stringify(colVals),
      },
    });

    return { id: res?.create_item?.id ?? null };
  }
}

export class DataSurVehiculeBoard {
  static readonly boardId = BOARD_IDS.DATA_SUR_VEHICULE;

  async executeGraphQL(query: string, vars: any = {}) {
    return callMondayApi(query, { variables: vars });
  }

  items() {
    return new ItemsQueryBuilder(DataSurVehiculeBoard.boardId);
  }

  item(_id?: string) {
    return {
      create: (data: any) => new ItemCreateBuilder(DataSurVehiculeBoard.boardId, data),
    };
  }
}

export class FactureChargemapBoard {
  static readonly boardId = BOARD_IDS.FACTURE_CHARGEMAP;

  async executeGraphQL(query: string, vars: any = {}) {
    return callMondayApi(query, { variables: vars });
  }
}

export class FactureTotalBoard {
  static readonly boardId = BOARD_IDS.FACTURE_TOTAL;

  async executeGraphQL(query: string, vars: any = {}) {
    return callMondayApi(query, { variables: vars });
  }
}

export class DataWellborneBoard {
  static readonly boardId = BOARD_IDS.DATA_WELLBORNE;

  async executeGraphQL(query: string, vars: any = {}) {
    return callMondayApi(query, { variables: vars });
  }
}

export class ReparationMachinesBoard {
  static readonly boardId = BOARD_IDS.REPARATION_MACHINES;

  async executeGraphQL(query: string, vars: any = {}) {
    return callMondayApi(query, { variables: vars });
  }
}
