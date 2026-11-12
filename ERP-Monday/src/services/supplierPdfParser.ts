import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Machine } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface SupplierReplacedPart {
  articleNumber: string;
  description: string;
  quantity: string;
  unit: string;
  warrantyFlag: string;
}

export interface SupplierLaborItem {
  total: string;
  activityType: string;
  accountingFlag: string;
  addedBy: string;
  date: string;
}

export interface ParsedSupplierOrder {
  supplierName: string;
  orderNumber: string;
  date: string; // YYYY-MM-DD
  dateDisplay: string; // DD/MM/YYYY
  clientAccount: string;
  siteAddress: string;
  equipmentName: string;
  serialNumber: string;
  articleNumber: string;
  technicianName: string;
  damageSummary: string;
  laborItems: SupplierLaborItem[];
  laborSummary: string;
  underWarranty: boolean;
  warrantyLabel: string;
  replacedParts: SupplierReplacedPart[];
  technicianNotes: string;
  customerSignature: string;
  technicianSignature: string;
  suggestedStatus: 'Réparée' | 'En cours de réparation' | 'En attente de devis' | 'À traiter';
  fileName?: string;
  rawTextPreview: string;
}

export interface MatchedMachineCandidate {
  machine: Machine;
  score: number;
  matchReasons: string[];
}

interface TextToken {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface PdfRow {
  page: number;
  y: number;
  tokens: TextToken[];
  text: string;
}

function normalizeFrDateToIso(raw: string): string {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return new Date().toISOString().split('T')[0];
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Reconstruit les lignes visuelles d'un PDF à partir des coordonnées (x, y) de pdfjs-dist.
 */
export async function extractPdfRowsFromArrayBuffer(buffer: ArrayBuffer): Promise<PdfRow[]> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const allRows: PdfRow[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const tokens: TextToken[] = [];

    for (const item of content.items as any[]) {
      const str = (item?.str || '').trim();
      if (!str) continue;
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      tokens.push({
        str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: item.width ?? 0,
      });
    }

    // Regrouper par ligne (tolérance verticale 4.5 pt)
    tokens.sort((a, b) => b.y - a.y || a.x - b.x);
    const rowBuckets: { y: number; tokens: TextToken[] }[] = [];

    for (const tok of tokens) {
      const existing = rowBuckets.find((b) => Math.abs(b.y - tok.y) <= 4.5);
      if (existing) {
        existing.tokens.push(tok);
      } else {
        rowBuckets.push({ y: tok.y, tokens: [tok] });
      }
    }

    for (const bucket of rowBuckets) {
      bucket.tokens.sort((a, b) => a.x - b.x);
      let line = '';
      let prevEnd = -1;
      for (const tok of bucket.tokens) {
        if (prevEnd >= 0) {
          const gap = tok.x - prevEnd;
          line += gap > 14 ? '   ' : ' ';
        }
        line += tok.str;
        prevEnd = tok.x + tok.width;
      }
      allRows.push({
        page: p,
        y: bucket.y,
        tokens: bucket.tokens,
        text: line.trim(),
      });
    }
  }

  return allRows;
}

/**
 * Parse les lignes spatiales extraites d'un acte d'intervention fournisseur (format SAP / Diversey ou générique).
 */
export function parseSupplierOrderFromRows(rows: PdfRow[], fileName?: string): ParsedSupplierOrder {
  const fullText = rows.map((r) => r.text).join('\n');
  const lowerAll = fullText.toLowerCase();

  // 1. Détection fournisseur
  let supplierName = 'Fournisseur Externe';
  if (lowerAll.includes('diversey') || lowerAll.includes('solenis')) {
    supplierName = 'Diversey (Solenis)';
  } else if (lowerAll.includes('karcher') || lowerAll.includes('kärcher')) {
    supplierName = 'Kärcher';
  } else if (lowerAll.includes('nilfisk')) {
    supplierName = 'Nilfisk';
  } else if (lowerAll.includes('numatic')) {
    supplierName = 'Numatic';
  } else if (lowerAll.includes('hako')) {
    supplierName = 'Hako';
  } else if (lowerAll.includes('tennant')) {
    supplierName = 'Tennant';
  } else if (lowerAll.includes('comac') || lowerAll.includes('fimap')) {
    supplierName = lowerAll.includes('comac') ? 'Comac' : 'Fimap';
  }

  // Utilitaire : extraire un champ dans une colonne gauche (x < 300) ou droite (x >= 300) sur la même bande Y
  const getSideValue = (labelPattern: RegExp, side: 'left' | 'right' | 'any' = 'any'): string => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sideTokens = row.tokens.filter((t) => {
        if (side === 'left') return t.x < 300;
        if (side === 'right') return t.x >= 295;
        return true;
      });
      const sideText = sideTokens.map((t) => t.str).join(' ');
      if (labelPattern.test(sideText)) {
        // Prendre les tokens sur la même ligne après le label (ou à un X plus grand)
        // Chercher où commence la valeur après le dernier token du label
        let foundLabelEnd = -1;
        let acc = '';
        for (const t of sideTokens) {
          acc = (acc ? acc + ' ' : '') + t.str;
          if (labelPattern.test(acc) && foundLabelEnd < 0) {
            foundLabelEnd = t.x + t.width;
            break;
          }
        }
        if (foundLabelEnd >= 0) {
          const valTokens = sideTokens.filter((t) => t.x > foundLabelEnd + 2);
          const val = valTokens.map((t) => t.str).join(' ').trim();
          if (val) return val;
        }
        // Si le label est sur deux lignes (ex: "Technicien\nassigné"), vérifier les tokens alignés à droite
        const directMatch = sideText.replace(labelPattern, '').trim();
        if (directMatch && !/^(assigné|supplémentaire|number|de commande sap)$/i.test(directMatch)) {
          return directMatch;
        }
      }
    }
    return '';
  };

  // 2. Numéro de commande / bon
  let orderNumber = '';
  const sapMatch = fullText.match(/Num[ée]ro\s+de\s+(?:commande\s+SAP|bon|commande|dossier)\s*[:\-]?\s*([A-Z0-9\-]{4,})/i);
  if (sapMatch) {
    orderNumber = sapMatch[1].trim();
  } else {
    for (let i = 0; i < rows.length; i++) {
      if (/num[ée]ro\s+de/i.test(rows[i].text)) {
        const chunk = rows.slice(i, i + 3).map((r) => r.text).join(' ');
        const numM = chunk.match(/\b(\d{7,14})\b/);
        if (numM) {
          orderNumber = numM[1];
          break;
        }
      }
    }
  }
  if (!orderNumber && fileName) {
    const fnMatch = fileName.match(/(\d{6,})/);
    if (fnMatch) orderNumber = fnMatch[1];
  }

  // 3. Date
  let dateDisplay = '';
  const dateMatch = fullText.match(/(?:Date\s+de\s+cr[ée]ation|Date\s+d'intervention|Date)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (dateMatch) {
    dateDisplay = dateMatch[1];
  } else {
    const anyDate = fullText.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
    if (anyDate) dateDisplay = anyDate[1];
  }
  const isoDate = dateDisplay ? normalizeFrDateToIso(dateDisplay) : new Date().toISOString().split('T')[0];

  // 4. Client & Adresse (côté gauche du bloc Informations client)
  const clientAccount =
    getSideValue(/^Compte\b/i, 'left') ||
    getSideValue(/^Nom de l'adresse\b/i, 'left') ||
    '';
  const addrLine = getSideValue(/^Add?resse\s+ligne\s*2\b/i, 'left') || getSideValue(/^Adresse\b/i, 'left');
  const cityLine = getSideValue(/^Pays\b/i, 'left') || getSideValue(/^Ville\b/i, 'left');
  const zipLine = getSideValue(/^Code\s+Postal\b/i, 'left');
  const siteAddress = [addrLine, [zipLine, cityLine].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  // 5. Technicien assigné (côté droit)
  let technicianName = '';
  for (let i = 0; i < rows.length; i++) {
    const rightToks = rows[i].tokens.filter((t) => t.x >= 295);
    const rightTxt = rightToks.map((t) => t.str).join(' ');
    if (/Technicien/i.test(rightTxt)) {
      const val = rightToks
        .filter((t) => !/^(Technicien|assign[ée])$/i.test(t.str))
        .map((t) => t.str)
        .join(' ')
        .trim();
      if (val) {
        technicianName = val;
        break;
      }
    }
  }

  // 6. Équipement, N° série, N° article (sous "Statut de la commande" / "Nom de l'équipement")
  let equipmentName = '';
  let serialNumber = '';
  let articleNumber = '';
  for (let i = 0; i < rows.length; i++) {
    if (/Nom de l'[ée]quipement/i.test(rows[i].text) && /Num[ée]ro de s[ée]rie/i.test(rows[i].text)) {
      const equipCol = rows[i].tokens.find((t) => /équipement/i.test(t.str));
      const serialCol = rows[i].tokens.find((t) => /serie|série/i.test(t.str));
      const artCol = rows[i].tokens.find((t) => /article/i.test(t.str));
      const dataRow = rows[i + 1];
      if (dataRow) {
        const xEquipMin = equipCol ? equipCol.x - 40 : 100;
        const xSerialMin = serialCol ? serialCol.x - 15 : 330;
        const xArtMin = artCol ? artCol.x - 15 : 440;

        equipmentName = dataRow.tokens
          .filter((t) => t.x >= xEquipMin && t.x < xSerialMin)
          .map((t) => t.str)
          .join(' ')
          .trim();
        serialNumber = dataRow.tokens
          .filter((t) => t.x >= xSerialMin && t.x < xArtMin)
          .map((t) => t.str)
          .join(' ')
          .trim();
        articleNumber = dataRow.tokens
          .filter((t) => t.x >= xArtMin)
          .map((t) => t.str)
          .join(' ')
          .trim();
      }
      break;
    }
  }
  if (!equipmentName) {
    const genEquip = fullText.match(/(?:Mat[ée]riel|Machine|Mod[èe]le|[ÉE]quipement)\s*[:\-]\s*([^\n]+)/i);
    if (genEquip) equipmentName = genEquip[1].trim();
  }
  if (!serialNumber) {
    const genSerial = fullText.match(/(?:N[°o]\s*de\s*s[ée]rie|Serial|S\/N)\s*[:\-]?\s*([A-Z0-9\-]{4,})/i);
    if (genSerial) serialNumber = genSerial[1].trim();
  }

  // 7. Analyse des commandes (Dommages / Causes / Solutions) par bandes X de colonnes
  let damageSummary = '';
  for (let i = 0; i < rows.length; i++) {
    if (/Groupe\s+de\s+dommages/i.test(rows[i].text)) {
      const colDomGroupe: string[] = [];
      const colDomCode: string[] = [];
      const colCauseCode: string[] = [];
      const colSolution: string[] = [];

      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j];
        if (/Heures\s+de\s+travail/i.test(r.text)) break;
        for (const t of r.tokens) {
          if (/^solution$/i.test(t.str)) continue;
          if (t.x < 135) colDomGroupe.push(t.str);
          else if (t.x >= 135 && t.x < 225) colDomCode.push(t.str);
          else if (t.x >= 315 && t.x < 408) colCauseCode.push(t.str);
          else if (t.x >= 495) colSolution.push(t.str);
        }
      }
      const parts = [
        colDomGroupe.join(' ').trim(),
        colDomCode.length ? `Dommage : ${colDomCode.join(' ').trim()}` : '',
        colCauseCode.length ? `Cause : ${colCauseCode.join(' ').trim()}` : '',
        colSolution.length ? `Solution : ${colSolution.join(' ').trim()}` : '',
      ].filter(Boolean);
      damageSummary = parts.join(' · ');
      break;
    }
  }

  // 8. Heures de travail et coûts (extraction basée sur les tokens/colonnes)
  const laborItems: SupplierLaborItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (/Type\s+d'activit[ée]/i.test(rows[i].text) && /Total\s+des\s+activit[ée]s/i.test(rows[i].text)) {
      const colType = rows[i].tokens.find((t) => /Type\s+d'activit/i.test(t.str))?.x ?? 130;
      const colAcc = rows[i].tokens.find((t) => /Indicateur/i.test(t.str))?.x ?? 295;
      const colAdd = rows[i].tokens.find((t) => /Ajout[ée]/i.test(t.str))?.x ?? 415;
      const colDate = rows[i].tokens.find((t) => /Date/i.test(t.str))?.x ?? 480;

      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j];
        if (/Mat[ée]riaux\s+utilis[ée]s/i.test(r.text) || /Commentaires\s+du\s+technicien/i.test(r.text)) break;
        const totalTok = r.tokens.filter((t) => t.x < colType - 10).map((t) => t.str).join(' ').trim();
        const actTok = r.tokens.filter((t) => t.x >= colType - 10 && t.x < colAcc - 10).map((t) => t.str).join(' ').trim();
        const accTok = r.tokens.filter((t) => t.x >= colAcc - 10 && t.x < colAdd - 10).map((t) => t.str).join(' ').trim();
        const addTok = r.tokens.filter((t) => t.x >= colAdd - 10 && t.x < colDate - 10).map((t) => t.str).join(' ').trim();
        const dateTok = r.tokens.filter((t) => t.x >= colDate - 10).map((t) => t.str).join(' ').trim();
        if (totalTok && actTok) {
          laborItems.push({
            total: totalTok,
            activityType: actTok,
            accountingFlag: accTok,
            addedBy: addTok,
            date: dateTok,
          });
        }
      }
      break;
    }
  }

  const laborSummary =
    laborItems.length > 0
      ? laborItems.map((l) => `${l.activityType} (${l.total})`).join(' · ')
      : '';

  // 9. Matériaux utilisés (Pièces remplacées, extraction basée sur coordonnées X)
  const replacedParts: SupplierReplacedPart[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (/Num[ée]ro\s+d'article/i.test(rows[i].text) && /Description\s+du\s+mat[ée]riel/i.test(rows[i].text)) {
      const colDesc = rows[i].tokens.find((t) => /Description/i.test(t.str))?.x ?? 140;
      const qtyTokens = rows[i].tokens.filter((t) => /Quantit[ée]/i.test(t.str));
      const colQty = qtyTokens[0]?.x ?? 335;
      const colUnit = qtyTokens[1]?.x ?? 390;
      const colInd = rows[i].tokens.find((t) => /Indicateur/i.test(t.str))?.x ?? 445;

      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j];
        if (/Commentaires\s+du\s+technicien/i.test(r.text) || r.page !== rows[i].page) break;
        const art = r.tokens.filter((t) => t.x < colDesc - 10).map((t) => t.str).join(' ').trim();
        const desc = r.tokens.filter((t) => t.x >= colDesc - 10 && t.x < colQty - 10).map((t) => t.str).join(' ').trim();
        const qty = r.tokens.filter((t) => t.x >= colQty - 10 && t.x < colUnit - 10).map((t) => t.str).join(' ').trim();
        const unit = r.tokens.filter((t) => t.x >= colUnit - 10 && t.x < colInd - 10).map((t) => t.str).join(' ').trim();
        const flag = r.tokens.filter((t) => t.x >= colInd - 10).map((t) => t.str).join(' ').trim();
        if (art && desc) {
          replacedParts.push({
            articleNumber: art,
            description: desc,
            quantity: qty || '1',
            unit: unit || 'EA',
            warrantyFlag: flag,
          });
        }
      }
      break;
    }
  }

  // 10. Note de service (Commentaires du technicien)
  let technicianNotes = '';
  for (let i = 0; i < rows.length; i++) {
    if (/Note\s+de\s+service/i.test(rows[i].text) || /Commentaires\s+du\s+technicien/i.test(rows[i].text)) {
      const startIdx = /Note\s+de\s+service/i.test(rows[i].text) ? i : i + 1;
      const lines: string[] = [];
      for (let j = startIdx; j < rows.length; j++) {
        const r = rows[j];
        if (/Signature\s+du\s+client/i.test(r.text)) break;
        if (/Commentaires\s+du\s+technicien/i.test(r.text)) continue;
        // Exclure le label "Note de service" à gauche (x < 110)
        const rightText = r.tokens
          .filter((t) => !(t.x < 110 && /Note\s+de\s+service/i.test(t.str)))
          .map((t) => t.str)
          .join(' ')
          .trim();
        if (rightText) lines.push(rightText);
      }
      technicianNotes = lines.join(' ').replace(/\s+/g, ' ').trim();
      if (technicianNotes) break;
    }
  }

  // 11. Signatures
  let customerSignature = '';
  let technicianSignature = '';
  for (let i = 0; i < rows.length; i++) {
    if (/Signature\s+du\s+client/i.test(rows[i].text)) {
      const sigTokens: string[] = [];
      let sigDate = '';
      for (let j = i + 1; j < rows.length; j++) {
        if (/Signature\s+du\s+technicien/i.test(rows[j].text) || /Avis\s+de\s+non/i.test(rows[j].text)) break;
        if (/Sign[ée]\s+par/i.test(rows[j].text)) {
          sigTokens.push(rows[j].tokens.filter((t) => t.x >= 110).map((t) => t.str).join(' ').trim());
        }
        if (/^Date\b/i.test(rows[j].text)) {
          sigDate = rows[j].tokens.filter((t) => t.x >= 110).map((t) => t.str).join(' ').trim();
        }
      }
      customerSignature = [sigTokens.join(' '), sigDate].filter(Boolean).join(' · ');
    }
    if (/Signature\s+du\s+technicien/i.test(rows[i].text)) {
      const sigTokens: string[] = [];
      let sigDate = '';
      for (let j = i + 1; j < rows.length; j++) {
        if (/Avis\s+de\s+non/i.test(rows[j].text)) break;
        if (/Sign[ée]\s+par/i.test(rows[j].text)) {
          sigTokens.push(rows[j].tokens.filter((t) => t.x >= 110).map((t) => t.str).join(' ').trim());
        }
        if (/^Date\b/i.test(rows[j].text)) {
          sigDate = rows[j].tokens.filter((t) => t.x >= 110).map((t) => t.str).join(' ').trim();
        }
      }
      technicianSignature = [sigTokens.join(' '), sigDate].filter(Boolean).join(' · ');
    }
  }

  // 12. Garantie (détecter si la note technicien indique "sous garantie" même si SAP met Non: Garantie)
  const notesLower = technicianNotes.toLowerCase();
  const hasWarrantyInNotes = notesLower.includes('sous garantie') || notesLower.includes('sous garanti');
  const sapSaysNonGarantie = lowerAll.includes('non: garantie');
  const underWarranty = hasWarrantyInNotes || (!sapSaysNonGarantie && lowerAll.includes('garantie'));
  const warrantyLabel = hasWarrantyInNotes
    ? 'Sous garantie (confirmé par le technicien)'
    : underWarranty
    ? 'Sous garantie'
    : 'Hors garantie';

  // 13. Statut suggéré
  let suggestedStatus: ParsedSupplierOrder['suggestedStatus'] = 'Réparée';
  if (
    notesLower.includes('tout est ok') ||
    notesLower.includes("fin d'intervention") ||
    lowerAll.includes('100 repare') ||
    lowerAll.includes('réparé')
  ) {
    suggestedStatus = 'Réparée';
  } else if (notesLower.includes('devis') || notesLower.includes('commander') || notesLower.includes('attente')) {
    suggestedStatus = 'En attente de devis';
  }

  return {
    supplierName,
    orderNumber: orderNumber || 'N/C',
    date: isoDate,
    dateDisplay: dateDisplay || isoDate,
    clientAccount,
    siteAddress,
    equipmentName,
    serialNumber,
    articleNumber,
    technicianName: technicianName || technicianSignature.split('·')[0]?.trim() || '',
    damageSummary,
    laborItems,
    laborSummary,
    underWarranty,
    warrantyLabel,
    replacedParts,
    technicianNotes,
    customerSignature,
    technicianSignature,
    suggestedStatus,
    fileName,
    rawTextPreview: fullText,
  };
}

export async function parseSupplierOrderPdf(file: File): Promise<ParsedSupplierOrder> {
  const buffer = await file.arrayBuffer();
  const rows = await extractPdfRowsFromArrayBuffer(buffer);
  return parseSupplierOrderFromRows(rows, file.name);
}

/**
 * Trouve les machines du parc Monday qui correspondent le mieux à l'équipement / site du PDF.
 */
export function findBestMatchingMachines(
  order: ParsedSupplierOrder,
  machines: Machine[]
): MatchedMachineCandidate[] {
  const cleanSerial = (order.serialNumber || '').replace(/^0+/, '').toLowerCase();
  const equipLower = (order.equipmentName || '').toLowerCase();
  const siteLower = `${order.clientAccount} ${order.siteAddress}`.toLowerCase();

  // Mots-clés significatifs du modèle machine (ex: "ultimaxx", "360")
  const equipTokens = equipLower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !['kit', 'rtu', 'brush', 'compl', 'avec'].includes(w));

  // Mots-clés significatifs du site (ex: "rivage", "thalasso", "baule", "escoublac")
  const siteTokens = siteLower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !['groupe', 'facility', 'boulevard', 'ocean', 'océan', 'france'].includes(w));

  const candidates: MatchedMachineCandidate[] = [];

  for (const m of machines) {
    let score = 0;
    const matchReasons: string[] = [];

    const colTexts = (m.column_values || []).map((c) => c.text || '').join(' ');
    const fullMachineText = `${m.name} ${colTexts}`.toLowerCase();

    if (cleanSerial.length >= 4 && fullMachineText.includes(cleanSerial)) {
      score += 100;
      matchReasons.push(`N° série ${cleanSerial}`);
    }

    for (const tok of equipTokens) {
      if (fullMachineText.includes(tok)) {
        score += 35;
        matchReasons.push(`Modèle « ${tok.toUpperCase()} »`);
      }
    }

    for (const tok of siteTokens) {
      if (fullMachineText.includes(tok)) {
        score += 30;
        matchReasons.push(`Site « ${tok} »`);
      }
    }

    if (score > 0) {
      candidates.push({
        machine: m,
        score,
        matchReasons: Array.from(new Set(matchReasons)),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}
