import ExcelJS from 'exceljs';

export interface SpreadsheetTheme {
  primary?: string;
  secondary?: string;
  accent?: string;
  neutral?: string;
  font?: string;
}

export interface SpreadsheetConfig {
  sheetName: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
  columnWidths?: Record<number, number>;
  theme?: SpreadsheetTheme;
}

export function createTheme(theme: SpreadsheetTheme): SpreadsheetTheme {
  return theme;
}

export function createSpreadsheet(config: SpreadsheetConfig): SpreadsheetConfig {
  return config;
}

export function useXlsxExport() {
  const exportToXlsx = async (config: SpreadsheetConfig, filename: string) => {
    const { sheetName, columns, rows, columnWidths, theme } = config;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Groupe Facility — Hub Communication';
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName || 'Contacts clients', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Configuration des colonnes et largeurs
    ws.columns = columns.map((colName, idx) => ({
      header: colName,
      key: `col_${idx}`,
      width: columnWidths?.[idx] || 35,
    }));

    const primaryColor = (theme?.primary || 'FF39A9DC').replace('#', '');
    const neutralColor = (theme?.neutral || 'FFE1F2FA').replace('#', '');
    const fontName = theme?.font || 'Calibri';

    // Formatage de la ligne d'en-tête (Bleu Facility, texte blanc gras, filtres)
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: primaryColor },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: primaryColor } },
        bottom: { style: 'thin', color: { argb: 'FF3989B7' } },
        left: { style: 'thin', color: { argb: primaryColor } },
        right: { style: 'thin', color: { argb: primaryColor } },
      };
    });

    // Lignes de données alternées (Zebra striping)
    rows.forEach((row, rowIdx) => {
      const r = ws.addRow(row);
      r.height = 20;
      const isAltRow = rowIdx % 2 === 1; // Ligne alternée
      const bgColor = isAltRow ? neutralColor : 'FFFFFFFF';

      r.eachCell((cell) => {
        cell.font = { name: fontName, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE6EEF3' } },
          bottom: { style: 'thin', color: { argb: 'FFE6EEF3' } },
          left: { style: 'thin', color: { argb: 'FFE6EEF3' } },
          right: { style: 'thin', color: { argb: 'FFE6EEF3' } },
        };
      });
    });

    // Activation automatique des filtres Excel (flèches déroulantes sur les en-têtes)
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length },
    };

    // Génération du fichier binaire et déclenchement du téléchargement (compatible mobile Monday WebView)
    const buffer = await wb.xlsx.writeBuffer();
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([buffer], { type: mimeType });

    const isMobileOrTouch =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024));

    if (isMobileOrTouch && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], filename, { type: mimeType });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return { exportToXlsx };
}
