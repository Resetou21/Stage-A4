import { callMondayApi } from './mondayApi';

export const BOARD_IDS = {
  TABLEAU_COMPLET_CHANTIER: 1976599627,
};

const CHANTIER_COLS: Record<string, { id: string; type: string }> = {
  interlocuteur: { id: 'dropdown_mkrb9ma', type: 'dropdown' },
  adresseMail: { id: 'dropdown_mkrbwbya', type: 'dropdown' },
  telephone: { id: 'dropdown_mkrbfhrg', type: 'dropdown' },
};

class ItemsQueryBuilder {
  private boardId: number;
  private cols: string[] = [];
  private limitCount = 500;
  private cursorStr?: string;

  constructor(boardId: number) {
    this.boardId = boardId;
  }

  withColumns(cols: string[]) {
    this.cols = cols;
    return this;
  }

  withPagination(opts: { limit?: number; cursor?: string | null }) {
    if (opts.limit) this.limitCount = opts.limit;
    if (opts.cursor) this.cursorStr = opts.cursor;
    return this;
  }

  async execute(): Promise<{ items: any[]; cursor?: string | null }> {
    const colIds = this.cols
      .map((c) => CHANTIER_COLS[c]?.id || c)
      .filter(Boolean);

    const q = this.cursorStr
      ? `query ($c: String!) {
          next_items_page(limit: ${this.limitCount}, cursor: $c) {
            cursor
            items {
              id
              name
              group {
                id
                title
              }
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
                group {
                  id
                  title
                }
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
      ? (res?.next_items_page || res?.data?.next_items_page)
      : (res?.boards?.[0]?.items_page || res?.data?.boards?.[0]?.items_page);

    const rawItems = page?.items || [];
    const parsedItems = rawItems.map((item: any) => {
      const obj: Record<string, any> = {
        id: item.id,
        name: item.name,
        group: item.group ? { id: item.group.id, title: item.group.title } : undefined,
      };

      for (const colKey of this.cols) {
        const colDef = CHANTIER_COLS[colKey];
        const targetId = colDef?.id || colKey;
        const cv = item.column_values?.find((v: any) => v.id === targetId);
        if (cv) {
          // Split into array if string has multiple values, or return array of string labels
          const textVal = cv.text?.trim() || '';
          obj[colKey] = textVal ? textVal.split(',').map((s: string) => s.trim()) : [];
        } else {
          obj[colKey] = [];
        }
      }

      return obj;
    });

    return {
      items: parsedItems,
      cursor: page?.cursor || null,
    };
  }
}

export class TableauCompletChantierBoard {
  public id = BOARD_IDS.TABLEAU_COMPLET_CHANTIER;

  items() {
    return new ItemsQueryBuilder(this.id);
  }
}
