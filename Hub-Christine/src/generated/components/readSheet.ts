// Lecture d'un fichier XLSX ou CSV dans le navigateur, sans librairie externe.
// Supporte UTF-8, Windows-1252, délimiteurs multiples (;, ,, \t) et formats tolérants.

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Fichier non reconnu (non-ZIP)');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extra = v.getUint16(p + 30, true);
    const comment = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    out.set(name, method === 8 ? await inflate(raw) : raw);
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  const shared: string[] = [];
  const ss = files.get('xl/sharedStrings.xml');
  if (ss) xml(dec.decode(ss)).querySelectorAll('si').forEach((si) => {
    shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
  });
  // Recherche tolérante de la première feuille de calcul
  const sheetNames = [...files.keys()].filter((k) => /^xl\/worksheets\/.*\.xml$/i.test(k));
  const sheetName = sheetNames.find((k) => /sheet1\.xml$/i.test(k)) || sheetNames.sort()[0];
  if (!sheetName) throw new Error('Aucune feuille trouvée dans le fichier Excel');
  const doc = xml(dec.decode(files.get(sheetName)!));
  const rows: string[][] = [];
  doc.querySelectorAll('sheetData > row').forEach((r) => {
    const row: string[] = [];
    r.querySelectorAll('c').forEach((c) => {
      const t = c.getAttribute('t');
      const val = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const text = t === 's' ? shared[Number(val)] ?? ''
        : t === 'inlineStr' ? Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('') : val;
      row[colIndex(c.getAttribute('r') ?? 'A')] = text;
    });
    rows.push(Array.from(row, (x) => x ?? ''));
  });
  return rows;
}

// Détection automatique du délimiteur CSV dominant (; , ou tabulation \t)
function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (!lines.length) return ';';
  let semi = 0;
  let comma = 0;
  let tab = 0;
  for (const line of lines) {
    semi += (line.match(/;/g) || []).length;
    comma += (line.match(/,/g) || []).length;
    tab += (line.match(/\t/g) || []).length;
  }
  if (semi >= comma && semi >= tab && semi > 0) return ';';
  if (tab > comma && tab > semi) return '\t';
  if (comma > 0) return ',';
  return ';';
}

function readCsv(text: string): string[][] {
  const sep = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') {
      q = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

// Décodage intelligent du texte : UTF-8 avec bascule automatique Windows-1252 si accents corrompus
async function decodeFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (utf8.includes('\uFFFD')) {
    try {
      const win1252 = new TextDecoder('windows-1252').decode(buf);
      return win1252.replace(/^\uFEFF/, '');
    } catch {}
  }
  return utf8.replace(/^\uFEFF/, '');
}

export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  // Si c'est un fichier CSV ou TXT
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await decodeFileText(file);
    return readCsv(text).filter((r) => r.some((c) => c.trim()));
  }

  // Si c'est un fichier .xls (ancien format binaire Excel 97-2003 ou export HTML/CSV déguisé)
  if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    try {
      const text = await decodeFileText(file);
      // Cas 1 : Table HTML déguisée en .xls (courant dans les exports d'outils de facturation)
      if (text.toLowerCase().includes('<table') || text.toLowerCase().includes('<tr')) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const rows: string[][] = [];
        doc.querySelectorAll('tr').forEach((tr) => {
          const row: string[] = [];
          tr.querySelectorAll('td, th').forEach((cell) => {
            row.push(cell.textContent?.trim() ?? '');
          });
          if (row.some((c) => c.trim())) rows.push(row);
        });
        if (rows.length > 0) return rows;
      }
      // Cas 2 : CSV ou TSV déguisé en .xls
      if (text.includes(';') || text.includes(',') || text.includes('\t')) {
        return readCsv(text).filter((r) => r.some((c) => c.trim()));
      }
    } catch {}
    throw new Error(
      "Le fichier est au format ancien Excel (.xls binaire). Veuillez l'ouvrir dans Excel et l'enregistrer sous le format moderne (.xlsx) ou (.csv) avant de l'importer."
    );
  }

  // Fichier XLSX standard
  const rows = await readXlsx(await file.arrayBuffer());
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Détection intelligente et automatique de la véritable ligne d'en-tête
// Ignore les lignes d'introduction, sous-titres ou lignes vides avant le tableau
export function extractHeadersAndRows(rows: string[][]): { headers: string[]; dataRows: string[][] } {
  if (!rows || rows.length === 0) return { headers: [], dataRows: [] };

  const headerKeywords = [
    'date', 'heure', 'time', 'immat', 'plaque', 'vehicule', 'estampe', 'carte',
    'badge', 'produit', 'carburant', 'montant', 'prix', 'total', 'ttc', 'ht',
    'tva', 'station', 'volume', 'quantite', 'kwh', 'energie', 'duree', 'facture',
    'conducteur', 'matricule', 'starttime', 'start', 'nom', 'name'
  ];

  let bestHeaderIndex = 0;
  let bestScore = 0;

  // Analyser les 15 premières lignes pour repérer la ligne qui contient les en-têtes
  const maxScan = Math.min(rows.length, 15);
  for (let i = 0; i < maxScan; i++) {
    const r = rows[i];
    if (!r || !r.length) continue;
    let score = 0;
    for (const cell of r) {
      if (!cell) continue;
      const clean = cell.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      for (const kw of headerKeywords) {
        if (clean.includes(kw)) {
          score += 2;
          break;
        }
      }
    }
    const nonEmptyCount = r.filter((c) => c && c.trim()).length;
    if (nonEmptyCount >= 4) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestHeaderIndex = i;
    }
  }

  if (bestScore >= 3) {
    const headers = rows[bestHeaderIndex].map((h) => (h ?? '').trim());
    const dataRows = rows.slice(bestHeaderIndex + 1).filter((r) => r.some((c) => c && c.trim()));
    return { headers, dataRows };
  }

  return {
    headers: (rows[0] || []).map((h) => (h ?? '').trim()),
    dataRows: rows.slice(1).filter((r) => r.some((c) => c && c.trim())),
  };
}
