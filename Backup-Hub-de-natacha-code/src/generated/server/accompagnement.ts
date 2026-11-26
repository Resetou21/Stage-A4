import { callMondayApi, monday } from '@api/BoardSDK';

export const BOARD_SALARIES_ID = 5108574616;
export const BOARD_ACCOMPAGNEMENTS_ID = 5108574626;

export const SALARIES_COLS = {
  phone: 'text_mm9esavp',
  langue: 'color_mm9enz2j',
  secteur: 'color_mm9essp0',
  chantier: 'text_mm9efgtq',
  statut: 'color_mm9ea1d9',
  lastUpdate: 'date_mm9ekt1k',
} as const;

export const ACCOMPAGNEMENT_COLS = {
  salarie: 'text_mm9eesg2',
  phone: 'text_mm9e4qyw',
  date: 'date_mm9e39vd',
  animatrice: 'color_mm9ekdvf',
  theme: 'color_mm9echbq',
  syntheseFr: 'long_text_mm9efr78',
  messageTraduit: 'long_text_mm9er6mr',
  langue: 'text_mm9ep2xf',
  url: 'link_mm9evx9w',
  photo: 'file_mm9e6pjq',
  statut: 'color_mm9epdm8',
} as const;

export const SUPPORTED_LANGUAGES = [
  { label: 'Français', code: 'fr', short: 'FR' },
  { label: 'Portugais', code: 'pt', short: 'PT' },
  { label: 'Espagnol', code: 'es', short: 'ES' },
  { label: 'Anglais', code: 'en', short: 'EN' },
  { label: 'Arabe', code: 'ar', short: 'AR' },
  { label: 'Roumain', code: 'ro', short: 'RO' },
  { label: 'Ukrainien', code: 'uk', short: 'UK' },
  { label: 'Turc', code: 'tr', short: 'TR' },
  { label: 'Italien', code: 'it', short: 'IT' },
  { label: 'Polonais', code: 'pl', short: 'PL' },
  { label: 'Russe', code: 'ru', short: 'RU' },
] as const;

export interface MessageTemplateRecord {
  id: string;
  label: string;
  theme: string;
  text: string;
  author: string;
  isDefault?: boolean;
}

export const ACCOMPAGNEMENT_THEMES = [
  'Protocole nettoyage',
  'Utilisation machine',
  'Sécurité / EPI',
  'Félicitations',
  'Organisation / Planning',
  'Autre',
] as const;

export interface SalarieRecord {
  id: string;
  name: string;
  phone: string;
  langue: string;
  secteur: string;
  chantier: string;
  statut: string;
  lastUpdate: string;
}

export interface AccompagnementRecord {
  id: string;
  title: string;
  salarie: string;
  phone: string;
  date: string;
  animatrice: string;
  theme: string;
  syntheseFr: string;
  messageTraduit: string;
  langue: string;
  url: string;
  statut: string;
  photoUrl?: string;
  photoName?: string;
}

export interface ParsedExcelSalarie {
  name: string;
  phone: string;
  langue: string;
  secteur: string;
  statut: 'En poste' | 'Sorti';
}

export function normalizePhoneForWhatsApp(raw: string): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  if (cleaned.startsWith('0') && cleaned.length === 10) return `33${cleaned.slice(1)}`;
  return cleaned;
}

export function formatPhoneDisplay(raw: string): string {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('33') && digits.length === 11) {
    return `+33 ${digits[2]} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  if (digits.startsWith('+33') && digits.length === 12) {
    return `+33 ${digits[3]} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  return raw.trim();
}

export function inferLanguageFromNationality(nat: string): string {
  const n = (nat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!n || n.includes('franc')) return 'Français';
  if (n.includes('portug') || n.includes('bresil') || n.includes('cap-vert') || n.includes('cap vert')) return 'Portugais';
  if (n.includes('espagn') || n.includes('colomb') || n.includes('perou') || n.includes('mexic')) return 'Espagnol';
  if (n.includes('maroc') || n.includes('alger') || n.includes('tunis') || n.includes('egypt') || n.includes('syri') || n.includes('liban')) return 'Arabe';
  if (n.includes('roum') || n.includes('mold')) return 'Roumain';
  if (n.includes('ukrain')) return 'Ukrainien';
  if (n.includes('turc') || n.includes('turq')) return 'Turc';
  if (n.includes('ital')) return 'Italien';
  if (n.includes('pologn') || n.includes('polon')) return 'Polonais';
  if (n.includes('russ')) return 'Russe';
  if (n.includes('angl') || n.includes('brit') || n.includes('nigeri') || n.includes('ghan')) return 'Anglais';
  return 'Français';
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const waPhone = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text);
  return waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export async function translateFromFrench(text: string, targetLangLabel: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  const lang = SUPPORTED_LANGUAGES.find(
    (l) => l.label.toLowerCase() === targetLangLabel.trim().toLowerCase()
  );
  if (!lang || lang.code === 'fr') return clean;

  // MyMemory API (gratuite, CORS ouvert, max ~500 chars par chunk)
  const chunks: string[] = [];
  const paragraphs = clean.split('\n');
  let buffer = '';
  for (const p of paragraphs) {
    if ((buffer + '\n' + p).length > 440 && buffer) {
      chunks.push(buffer);
      buffer = p;
    } else {
      buffer = buffer ? `${buffer}\n${p}` : p;
    }
  }
  if (buffer) chunks.push(buffer);

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    // Paramètre `de=` gratuit MyMemory : étend le quota gratuit de 5 000 à 50 000 caractères/jour
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=fr|${lang.code}&de=contact@groupefacility.fr`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Service de traduction indisponible');
    const json = await res.json();
    const out = json?.responseData?.translatedText;
    translatedChunks.push(out ? String(out) : chunk);
  }
  return translatedChunks.join('\n');
}

export async function fetchSalaries(): Promise<SalarieRecord[]> {
  const colIds = Object.values(SALARIES_COLS).map((id) => `"${id}"`).join(', ');
  let cursor: string | null = null;
  const rawItems: any[] = [];
  let pages = 0;

  do {
    pages++;
    const query = cursor
      ? `query ($c: String!) {
          next_items_page(limit: 500, cursor: $c) {
            cursor
            items {
              id
              name
              column_values(ids: [${colIds}]) { id text }
            }
          }
        }`
      : `query {
          boards(ids: [${BOARD_SALARIES_ID}]) {
            items_page(limit: 500) {
              cursor
              items {
                id
                name
                column_values(ids: [${colIds}]) { id text }
              }
            }
          }
        }`;

    const res: any = cursor
      ? await callMondayApi(query, { variables: { c: cursor }, bypassCache: true })
      : await callMondayApi(query, { bypassCache: true });

    const page = cursor ? res?.data?.next_items_page : res?.data?.boards?.[0]?.items_page;
    if (page?.items?.length) rawItems.push(...page.items);
    cursor = page?.cursor || null;
  } while (cursor && pages < 5);

  return rawItems
    .map((it) => {
      const m = new Map<string, string>();
      (it.column_values || []).forEach((cv: any) => {
        if (cv?.id) m.set(cv.id, String(cv.text || '').trim());
      });
      return {
        id: String(it.id),
        name: String(it.name || '').trim(),
        phone: m.get(SALARIES_COLS.phone) || '',
        langue: m.get(SALARIES_COLS.langue) || 'Français',
        secteur: m.get(SALARIES_COLS.secteur) || '',
        chantier: m.get(SALARIES_COLS.chantier) || '',
        statut: m.get(SALARIES_COLS.statut) || 'En poste',
        lastUpdate: m.get(SALARIES_COLS.lastUpdate) || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function updateSalarieFields(
  itemId: string,
  fields: { phone?: string; langue?: string; secteur?: string; chantier?: string; statut?: string }
): Promise<void> {
  const colObj: Record<string, any> = {
    [SALARIES_COLS.lastUpdate]: { date: new Date().toISOString().slice(0, 10) },
  };
  if (fields.phone !== undefined) colObj[SALARIES_COLS.phone] = fields.phone.trim();
  if (fields.langue !== undefined) colObj[SALARIES_COLS.langue] = { label: fields.langue };
  if (fields.secteur !== undefined) colObj[SALARIES_COLS.secteur] = { label: fields.secteur };
  if (fields.chantier !== undefined) colObj[SALARIES_COLS.chantier] = fields.chantier.trim();
  if (fields.statut !== undefined) colObj[SALARIES_COLS.statut] = { label: fields.statut };

  const mutation = `mutation ($itemId: ID!, $vals: JSON!) {
    change_multiple_column_values(
      board_id: ${BOARD_SALARIES_ID},
      item_id: $itemId,
      column_values: $vals,
      create_labels_if_missing: true
    ) { id }
  }`;

  await callMondayApi(mutation, { variables: { itemId, vals: JSON.stringify(colObj) } });
}

export async function createSalarieItem(input: {
  name: string;
  phone: string;
  langue: string;
  secteur?: string;
  chantier?: string;
  statut?: 'En poste' | 'Sorti';
}): Promise<SalarieRecord> {
  const today = new Date().toISOString().slice(0, 10);
  const colObj: Record<string, any> = {
    [SALARIES_COLS.phone]: input.phone.trim(),
    [SALARIES_COLS.langue]: { label: input.langue || 'Français' },
    [SALARIES_COLS.statut]: { label: input.statut || 'En poste' },
    [SALARIES_COLS.lastUpdate]: { date: today },
  };
  if (input.secteur) colObj[SALARIES_COLS.secteur] = { label: input.secteur };
  if (input.chantier) colObj[SALARIES_COLS.chantier] = input.chantier.trim();

  const mutation = `mutation ($name: String!, $vals: JSON!) {
    create_item(
      board_id: ${BOARD_SALARIES_ID},
      item_name: $name,
      column_values: $vals,
      create_labels_if_missing: true
    ) { id name }
  }`;

  const res: any = await callMondayApi(mutation, {
    variables: {
      name: input.name.trim(),
      vals: JSON.stringify(colObj),
    },
  });
  const created = res?.data?.create_item;
  if (!created?.id) throw new Error('Création du salarié impossible sur Monday.');

  return {
    id: String(created.id),
    name: String(created.name || input.name.trim()),
    phone: input.phone.trim(),
    langue: input.langue || 'Français',
    secteur: input.secteur || '',
    chantier: input.chantier || '',
    statut: input.statut || 'En poste',
    lastUpdate: today,
  };
}

export async function fetchAccompagnements(): Promise<AccompagnementRecord[]> {
  const colIds = Object.values(ACCOMPAGNEMENT_COLS).map((id) => `"${id}"`).join(', ');
  const query = `query {
    boards(ids: [${BOARD_ACCOMPAGNEMENTS_ID}]) {
      items_page(limit: 200) {
        items {
          id
          name
          assets { id name public_url url }
          column_values(ids: [${colIds}]) { id text value }
        }
      }
    }
  }`;

  const res: any = await callMondayApi(query, { bypassCache: true });
  const rawItems: any[] = res?.data?.boards?.[0]?.items_page?.items || [];

  return rawItems
    .map((it) => {
      const m = new Map<string, any>();
      (it.column_values || []).forEach((cv: any) => {
        if (cv?.id) m.set(cv.id, cv);
      });
      const getTxt = (id: string) => String(m.get(id)?.text || '').trim();
      let linkUrl = '';
      const linkVal = m.get(ACCOMPAGNEMENT_COLS.url)?.value;
      if (linkVal) {
        try {
          const parsed = JSON.parse(linkVal);
          linkUrl = parsed?.url || '';
        } catch {
          // ignore
        }
      }
      if (!linkUrl) linkUrl = getTxt(ACCOMPAGNEMENT_COLS.url);

      const firstAsset = Array.isArray(it.assets) && it.assets.length > 0 ? it.assets[0] : null;

      return {
        id: String(it.id),
        title: String(it.name || '').trim(),
        salarie: getTxt(ACCOMPAGNEMENT_COLS.salarie),
        phone: getTxt(ACCOMPAGNEMENT_COLS.phone),
        date: getTxt(ACCOMPAGNEMENT_COLS.date),
        animatrice: getTxt(ACCOMPAGNEMENT_COLS.animatrice),
        theme: getTxt(ACCOMPAGNEMENT_COLS.theme),
        syntheseFr: getTxt(ACCOMPAGNEMENT_COLS.syntheseFr),
        messageTraduit: getTxt(ACCOMPAGNEMENT_COLS.messageTraduit),
        langue: getTxt(ACCOMPAGNEMENT_COLS.langue) || 'Français',
        url: linkUrl,
        statut: getTxt(ACCOMPAGNEMENT_COLS.statut) || 'Envoyé WhatsApp',
        photoUrl: firstAsset?.public_url || firstAsset?.url || undefined,
        photoName: firstAsset?.name || undefined,
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function uploadAccompagnementPhoto(itemId: string, file: File): Promise<string | null> {
  try {
    const query = `mutation ($file: File!) { add_file_to_column (item_id: ${itemId}, column_id: "${ACCOMPAGNEMENT_COLS.photo}", file: $file) { id public_url url } }`;
    const res: any = await (monday as any).api(query, { variables: { file } });
    const asset = res?.data?.add_file_to_column;
    if (asset?.public_url || asset?.url) {
      return asset.public_url || asset.url;
    }
  } catch (err) {
    console.warn('[Accompagnement] Upload photo SDK fallback:', err);
  }
  return null;
}

export async function createAccompagnementRecord(input: {
  salarieName: string;
  phone: string;
  date: string;
  animatrice: string;
  theme: string;
  syntheseFr: string;
  messageTraduit: string;
  langue: string;
  url?: string;
  statut?: 'Envoyé WhatsApp' | 'Brouillon';
  photoFile?: File | null;
}): Promise<{ id: string; photoUrl: string | null }> {
  const title = `${input.salarieName} — ${input.theme} (${input.date})`;
  const colObj: Record<string, any> = {
    [ACCOMPAGNEMENT_COLS.salarie]: input.salarieName,
    [ACCOMPAGNEMENT_COLS.phone]: input.phone,
    [ACCOMPAGNEMENT_COLS.date]: { date: input.date },
    [ACCOMPAGNEMENT_COLS.animatrice]: { label: input.animatrice },
    [ACCOMPAGNEMENT_COLS.theme]: { label: input.theme },
    [ACCOMPAGNEMENT_COLS.syntheseFr]: { text: input.syntheseFr },
    [ACCOMPAGNEMENT_COLS.messageTraduit]: { text: input.messageTraduit },
    [ACCOMPAGNEMENT_COLS.langue]: input.langue || 'Français',
    [ACCOMPAGNEMENT_COLS.statut]: { label: input.statut || 'Envoyé WhatsApp' },
  };
  if (input.url && input.url.trim()) {
    const cleanUrl = input.url.trim().startsWith('http') ? input.url.trim() : `https://${input.url.trim()}`;
    colObj[ACCOMPAGNEMENT_COLS.url] = { url: cleanUrl, text: cleanUrl };
  }

  const mutation = `mutation ($name: String!, $vals: JSON!) {
    create_item(
      board_id: ${BOARD_ACCOMPAGNEMENTS_ID},
      item_name: $name,
      column_values: $vals,
      create_labels_if_missing: true
    ) { id }
  }`;

  const res: any = await callMondayApi(mutation, {
    variables: {
      name: title.slice(0, 250),
      vals: JSON.stringify(colObj),
    },
  });
  const createdId = String(res?.data?.create_item?.id || '');
  if (!createdId) throw new Error('Enregistrement de la trace impossible sur Monday.');

  let photoUrl: string | null = null;
  if (input.photoFile) {
    photoUrl = await uploadAccompagnementPhoto(createdId, input.photoFile);
  }
  return { id: createdId, photoUrl };
}

export async function createCustomMessageTemplate(input: {
  label: string;
  theme: string;
  text: string;
  author: string;
}): Promise<MessageTemplateRecord> {
  const colObj: Record<string, any> = {
    [ACCOMPAGNEMENT_COLS.animatrice]: { label: input.author },
    [ACCOMPAGNEMENT_COLS.theme]: { label: input.theme || 'Autre' },
    [ACCOMPAGNEMENT_COLS.syntheseFr]: { text: input.text.trim() },
    [ACCOMPAGNEMENT_COLS.date]: { date: new Date().toISOString().slice(0, 10) },
    [ACCOMPAGNEMENT_COLS.statut]: { label: 'Modèle' },
  };

  const mutation = `mutation ($name: String!, $vals: JSON!) {
    create_item(
      board_id: ${BOARD_ACCOMPAGNEMENTS_ID},
      item_name: $name,
      column_values: $vals,
      create_labels_if_missing: true
    ) { id name }
  }`;

  const res: any = await callMondayApi(mutation, {
    variables: {
      name: input.label.trim().slice(0, 120),
      vals: JSON.stringify(colObj),
    },
  });
  const created = res?.data?.create_item;
  if (!created?.id) throw new Error('Enregistrement du modèle impossible sur Monday.');

  return {
    id: String(created.id),
    label: String(created.name || input.label.trim()),
    theme: input.theme || 'Autre',
    text: input.text.trim(),
    author: input.author,
  };
}

export async function archiveAccompagnementOrTemplate(itemId: string): Promise<void> {
  const mutation = `mutation ($itemId: ID!) { archive_item(item_id: $itemId) { id } }`;
  await callMondayApi(mutation, { variables: { itemId } });
}
