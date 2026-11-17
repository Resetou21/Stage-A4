import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { FactureChargemapBoard } from '@api/BoardSDK';
import { fetchKeys, makeKey, valText } from './importUtils.server';
import { invalidateFacturesCache } from './chargemap';

// Colonnes servant à reconnaître une ligne déjà importée
const KEY_COLS = ['date_mm0x7t7d', 'numeric_mm0xw0c7', 'numeric_mm0xgbyh', 'dropdown_mm0xh1q5', 'color_mm0xxga9'];
const BOARD_ID = 5092349771;
const GROUP = 'group_mm0zberz';

type T = 'status' | 'date' | 'num' | 'text' | 'dropdown';
const COLS: Record<string, [string, T]> = {
  'business unit': ['color_mm0xfchr', 'status'],
  'date': ['date_mm0x7t7d', 'date'],
  'heure': ['numeric_mm0xw0c7', 'num'],
  'date cdr': ['date_mm0x251n', 'date'],
  'fuseau horaire': ['color_mm0xrpc', 'status'],
  'type de depense': ['color_mm0x9sz9', 'status'],
  'business-invoicy.invoices.export.license_type': ['text_mm0xvcnf', 'text'],
  'badge': ['color_mm0xn4gn', 'status'],
  'commentaire du badge': ['color_mm0xaqmx', 'status'],
  'conducteur': ['color_mm0xwk8k', 'status'],
  'prenom du conducteur': ['color_mm0x602b', 'status'],
  'nom du conducteur': ['color_mm0x3jm3', 'status'],
  'matricule': ['numeric_mm0x89t1', 'num'],
  'vehicule': ['color_mm0xyjbt', 'status'],
  'type de recharge': ['color_mm0xa74h', 'status'],
  'localisation': ['color_mm0x8e1p', 'status'],
  'pays': ['color_mm0x2rqs', 'status'],
  'energie (kwh)': ['numeric_mm0xk1ka', 'num'],
  'duree (hh:mm:ss)': ['numeric_mm0xr5vm', 'num'],
  'business-invoicy.invoices.export.chargebox_id': ['text_mm0x5rw7', 'text'],
  'prix ttc (€)': ['numeric_mm0xgbyh', 'num'],
  'prix ht (€)': ['numeric_mm0xkqc5', 'num'],
  'montant tva (€)': ['numeric_mm0x9y71', 'num'],
  'taux tva (%)': ['numeric_mm0x59dy', 'num'],
  'centre de cout': ['text_mm0xrjwx', 'text'],
  'n° de facture': ['color_mm0xxga9', 'status'],
  'uuid recharge': ['dropdown_mm0xh1q5', 'dropdown'],
  'status de remboursement': ['text_mm0xt4e0', 'text'],
  'badge tele-peage': ['text_mm0x87ag', 'text'],
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace('prix ttc (eur)', 'prix ttc (€)');

function toDate(v: string): string | null {
  const s = (v ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]!.padStart(2, '0')}-${fr[1]!.padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function toNum(v: string): string | null {
  const s = (v ?? '').trim();
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return String(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3] ?? 0));
  const n = Number(s.replace(/\s/g, '').replace(',', '.').replace(/[€%]/g, ''));
  return Number.isFinite(n) ? String(n) : null;
}

// Analyse préalable des lignes avant import (rapport visuel des doublons et des lignes valides)
export const analyzeFacturesChargemap = createServerFn({ method: 'POST' })
  .validator(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }))
  .handler(async ({ data }) => {
    const board = new FactureChargemapBoard();
    const map = data.headers.map((h) => COLS[norm(h)] ?? null);
    const nameIdx = data.headers.findIndex((h) => norm(h) === 'name' || norm(h) === 'nom');
    const dateIdx = data.headers.findIndex((h) => norm(h) === 'date');
    const vehiculeIdx = data.headers.findIndex((h) => norm(h) === 'vehicule');
    const montantIdx = data.headers.findIndex((h) => norm(h).includes('prix ttc') || norm(h).includes('prix ht'));

    const gql = (q: string, v: Record<string, unknown>) => board.executeGraphQL(q, v);
    const seen = new Set(await fetchKeys(gql, BOARD_ID, KEY_COLS));

    let newCount = 0;
    let dupCount = 0;
    const previewList: { index: number; date: string; vehicule: string; montant: string; isDuplicate: boolean }[] = [];

    data.rows.forEach((row, idx) => {
      const values: Record<string, unknown> = {};
      row.forEach((cell, i) => {
        const m = map[i];
        if (!m || !cell?.trim()) return;
        const [id, type] = m;
        if (type === 'status') values[id] = { label: cell.trim() };
        else if (type === 'date') { const d = toDate(cell); if (d) values[id] = { date: d }; }
        else if (type === 'num') { const n = toNum(cell); if (n) values[id] = n; }
        else if (type === 'dropdown') values[id] = { labels: [cell.trim()] };
        else values[id] = cell.trim();
      });

      const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim() || 'Facture Chargemap';
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
          date: dateIdx >= 0 ? row[dateIdx] || '—' : '—',
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
      preview: previewList.slice(0, 30),
    };
  });

export const importFactures = createServerFn({ method: 'POST' })
  .validator(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())).max(50) }))
  .handler(async ({ data }) => {
    const board = new FactureChargemapBoard();
    const map = data.headers.map((h) => COLS[norm(h)] ?? null);
    const nameIdx = data.headers.findIndex((h) => norm(h) === 'name' || norm(h) === 'nom');
    const gql = (q: string, v: Record<string, unknown>) => board.executeGraphQL(q, v);
    const seen = new Set(await fetchKeys(gql, BOARD_ID, KEY_COLS));
    let dup = 0;

    const results = await Promise.all(
      data.rows.map(async (row) => {
        const values: Record<string, unknown> = {};
        row.forEach((cell, i) => {
          const m = map[i];
          if (!m || !cell?.trim()) return;
          const [id, type] = m;
          if (type === 'status') values[id] = { label: cell.trim() };
          else if (type === 'date') { const d = toDate(cell); if (d) values[id] = { date: d }; }
          else if (type === 'num') { const n = toNum(cell); if (n) values[id] = n; }
          else if (type === 'dropdown') values[id] = { labels: [cell.trim()] };
          else values[id] = cell.trim();
        });

        const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim() || 'Facture Chargemap';
        const key = makeKey(name, KEY_COLS.map((id) => valText(values[id])));
        if (seen.has(key)) {
          dup++;
          return null;
        }
        seen.add(key);

        try {
          await board.executeGraphQL(
            `mutation ($name: String!, $vals: JSON!) {
              create_item(board_id: ${BOARD_ID}, group_id: "${GROUP}", item_name: $name, column_values: $vals, create_labels_if_missing: true) {
                id
              }
            }`,
            { name, vals: JSON.stringify(values) }
          );
          return true;
        } catch (e) {
          console.error('import ligne Chargemap', e);
          return false;
        }
      })
    );

    invalidateFacturesCache();
    return {
      ok: results.filter((r) => r === true).length,
      ko: results.filter((r) => r === false).length,
      dup,
      mapped: map.filter(Boolean).length,
    };
  });
