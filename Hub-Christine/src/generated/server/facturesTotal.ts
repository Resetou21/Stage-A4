import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { FactureTotalBoard } from '@api/BoardSDK';
import { fetchKeys, makeKey, valText } from './importUtils.server';
import { invalidateFacturesCache } from './chargemap';

// Colonnes servant à reconnaître une transaction déjà importée
const KEY_COLS = ['date_mm149d1c', 'numeric_mm14h357', 'numeric_mm14dtxd', 'numeric_mm144d2g', 'numeric_mm14ctaq'];
const BOARD = 5092674084;
const GROUP = 'group_mm273ayf';
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function toDate(v: string): string | null {
  const s = (v ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) return new Date(Math.round((Number(s) - 25569) * 86400000)).toISOString().slice(0, 10);
  const fr4 = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (fr4) return `${fr4[3]}-${fr4[2]!.padStart(2, '0')}-${fr4[1]!.padStart(2, '0')}`;
  const fr2 = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})(?!\d)/);
  if (fr2) {
    const year = Number(fr2[3]) < 70 ? `20${fr2[3]}` : `19${fr2[3]}`;
    return `${year}-${fr2[2]!.padStart(2, '0')}-${fr2[1]!.padStart(2, '0')}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function toNum(v: string): string | null {
  const s = (v ?? '').trim();
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return String(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3] ?? 0));
  const clean = s
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(',', '.')
    .replace(/[€%]/g, '')
    .replace(/eur/gi, '');
  const n = Number(clean);
  return Number.isFinite(n) ? String(n) : null;
}

// Analyse préalable des factures Total avec détection bi-mensuelle (15 et 30) et des doublons
export const analyzeFacturesTotal = createServerFn({ method: 'POST' })
  .validator(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }))
  .handler(async ({ data }) => {
    const board = new FactureTotalBoard();
    const meta = (await board.executeGraphQL(
      `query { boards(ids: [${BOARD}]) { columns { id title type } } }`, {}
    )) as { boards?: { columns?: { id: string; title: string; type: string }[] }[] };

    const cols = new Map((meta.boards?.[0]?.columns ?? []).map((c) => [norm(c.title), c]));
    
    // Recherche tolérante des colonnes Monday avec gestion des synonymes Total
    const findCol = (headerStr: string) => {
      const nh = norm(headerStr);
      if (cols.has(nh)) return cols.get(nh);
      for (const [colTitle, colObj] of cols.entries()) {
        if (colTitle === nh) return colObj;
        if (nh.includes('date') && colTitle.includes('date')) return colObj;
        if ((nh.includes('immat') || nh.includes('vehicule') || nh.includes('estampe') || nh.includes('plaque')) &&
            (colTitle.includes('immat') || colTitle.includes('estampe') || colTitle.includes('vehicule'))) return colObj;
        if ((nh.includes('produit') || nh.includes('carburant')) &&
            (colTitle.includes('produit') || colTitle.includes('carburant') || colTitle.includes('libelle'))) return colObj;
        if ((nh.includes('montant ttc') || nh.includes('prix ttc') || nh.includes('total ttc')) &&
            (colTitle.includes('montant ttc') || colTitle.includes('ttc'))) return colObj;
        if ((nh.includes('montant ht') || nh.includes('prix ht') || nh.includes('total ht')) &&
            (colTitle.includes('montant ht') || colTitle.includes('ht'))) return colObj;
        if ((nh.includes('quantite') || nh.includes('volume') || nh.includes('litre')) &&
            (colTitle.includes('quantite') || colTitle.includes('volume'))) return colObj;
        if ((nh.includes('station') || nh.includes('lieu') || nh.includes('centre')) &&
            (colTitle.includes('station') || colTitle.includes('lieu') || colTitle.includes('centre'))) return colObj;
      }
      return null;
    };

    const map = data.headers.map((h) => findCol(h));
    const nameIdx = data.headers.findIndex((h) => ['name', 'nom', 'element', 'élément'].includes(norm(h)));
    const dateIdx = data.headers.findIndex((h) => {
      const s = norm(h);
      return s.includes('date') || s.includes('jour');
    });
    const vehiculeIdx = data.headers.findIndex((h) => {
      const s = norm(h);
      return s.includes('immat') || s.includes('vehicule') || s.includes('estampe') || s.includes('plaque');
    });
    const montantIdx = data.headers.findIndex((h) => {
      const s = norm(h);
      return s.includes('ttc') || s.includes('montant') || s.includes('prix') || s.includes('total');
    });

    const gql = (q: string, v: Record<string, unknown>) => board.executeGraphQL(q, v);
    const seen = new Set(await fetchKeys(gql, BOARD, KEY_COLS));

    let newCount = 0;
    let dupCount = 0;
    const periods = new Set<string>();
    const previewList: { index: number; date: string; vehicule: string; montant: string; isDuplicate: boolean }[] = [];

    data.rows.forEach((row, idx) => {
      const values: Record<string, unknown> = {};
      row.forEach((cell, i) => {
        const c = map[i];
        if (!c || c.id === 'name' || !cell?.trim()) return;
        const v = cell.trim();
        if (c.type === 'status') values[c.id] = { label: v };
        else if (c.type === 'date') { const d = toDate(v); if (d) values[c.id] = { date: d }; }
        else if (c.type === 'numbers') { const n = toNum(v); if (n) values[c.id] = n; }
        else if (c.type === 'dropdown') values[c.id] = { labels: [v] };
        else if (c.type === 'text' || c.type === 'long_text') values[c.id] = v;
      });

      const dVal = (dateIdx >= 0 ? row[dateIdx] : '') || '';
      const parsedDate = toDate(dVal);
      if (parsedDate) {
        const d = Number(parsedDate.slice(8, 10));
        const ym = parsedDate.slice(0, 7);
        periods.add(`${ym} (${d <= 15 ? '1 au 15' : '16 à fin de mois'})`);
      }

      const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim() || 'Facture TOTAL';
      const key = makeKey(name, KEY_COLS.map((id) => valText(values[id])));
      const isDup = seen.has(key);

      if (isDup) {
        dupCount++;
      } else {
        seen.add(key);
        newCount++;
      }

      if (idx < 50 || isDup) {
        previewList.push({
          index: idx + 1,
          date: parsedDate || dVal || '—',
          vehicule: vehiculeIdx >= 0 ? row[vehiculeIdx] || '—' : '—',
          montant: montantIdx >= 0 ? row[montantIdx] || '—' : '—',
          isDuplicate: isDup,
        });
      }
    });

    return {
      total: data.rows.length,
      newCount,
      dupCount,
      periodsFound: Array.from(periods),
      preview: previewList.slice(0, 30),
    };
  });

// Import des lignes d'un fichier TotalEnergies dans « Facture TOTAL »
export const importFacturesTotal = createServerFn({ method: 'POST' })
  .validator(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())).max(50) }))
  .handler(async ({ data }) => {
    const board = new FactureTotalBoard();
    const meta = (await board.executeGraphQL(
      `query { boards(ids: [${BOARD}]) { columns { id title type } } }`, {}
    )) as { boards?: { columns?: { id: string; title: string; type: string }[] }[] };

    const cols = new Map((meta.boards?.[0]?.columns ?? []).map((c) => [norm(c.title), c]));
    const findCol = (headerStr: string) => {
      const nh = norm(headerStr);
      if (cols.has(nh)) return cols.get(nh);
      for (const [colTitle, colObj] of cols.entries()) {
        if (colTitle === nh) return colObj;
        if (nh.includes('date') && colTitle.includes('date')) return colObj;
        if ((nh.includes('immat') || nh.includes('vehicule') || nh.includes('estampe') || nh.includes('plaque')) &&
            (colTitle.includes('immat') || colTitle.includes('estampe') || colTitle.includes('vehicule'))) return colObj;
        if ((nh.includes('produit') || nh.includes('carburant')) &&
            (colTitle.includes('produit') || colTitle.includes('carburant') || colTitle.includes('libelle'))) return colObj;
        if ((nh.includes('montant ttc') || nh.includes('prix ttc') || nh.includes('total ttc')) &&
            (colTitle.includes('montant ttc') || colTitle.includes('ttc'))) return colObj;
        if ((nh.includes('montant ht') || nh.includes('prix ht') || nh.includes('total ht')) &&
            (colTitle.includes('montant ht') || colTitle.includes('ht'))) return colObj;
        if ((nh.includes('quantite') || nh.includes('volume') || nh.includes('litre')) &&
            (colTitle.includes('quantite') || colTitle.includes('volume'))) return colObj;
        if ((nh.includes('station') || nh.includes('lieu') || nh.includes('centre')) &&
            (colTitle.includes('station') || colTitle.includes('lieu') || colTitle.includes('centre'))) return colObj;
      }
      return null;
    };
    const map = data.headers.map((h) => findCol(h));
    const nameIdx = data.headers.findIndex((h) => ['name', 'nom', 'element', 'élément'].includes(norm(h)));

    const gql = (q: string, v: Record<string, unknown>) => board.executeGraphQL(q, v);
    const seen = new Set(await fetchKeys(gql, BOARD, KEY_COLS));
    let dup = 0;

    const results = await Promise.all(
      data.rows.map(async (row) => {
        const values: Record<string, unknown> = {};
        row.forEach((cell, i) => {
          const c = map[i];
          if (!c || c.id === 'name' || !cell?.trim()) return;
          const v = cell.trim();
          if (c.type === 'status') values[c.id] = { label: v };
          else if (c.type === 'date') { const d = toDate(v); if (d) values[c.id] = { date: d }; }
          else if (c.type === 'numbers') { const n = toNum(v); if (n) values[c.id] = n; }
          else if (c.type === 'dropdown') values[c.id] = { labels: [v] };
          else if (c.type === 'text' || c.type === 'long_text') values[c.id] = v;
        });

        const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim() || 'Facture TOTAL';
        const key = makeKey(name, KEY_COLS.map((id) => valText(values[id])));
        if (seen.has(key)) {
          dup++;
          return null;
        }
        seen.add(key);

        try {
          await board.executeGraphQL(
            `mutation ($name: String!, $vals: JSON!) {
              create_item(board_id: ${BOARD}, group_id: "${GROUP}", item_name: $name, column_values: $vals, create_labels_if_missing: true) {
                id
              }
            }`,
            { name, vals: JSON.stringify(values) }
          );
          return true;
        } catch (e) {
          console.error('import ligne TOTAL', e);
          return false;
        }
      })
    );

    invalidateFacturesCache();
    return { ok: results.filter((r) => r === true).length, ko: results.filter((r) => r === false).length, dup };
  });
