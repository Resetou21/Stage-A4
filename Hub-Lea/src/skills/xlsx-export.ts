import * as XLSX from 'xlsx';

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
    const { sheetName, columns, rows, columnWidths } = config;

    // Create array of arrays data: [headers, ...rows]
    const data = [columns, ...rows];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths if provided
    if (columnWidths) {
      ws['!cols'] = Object.entries(columnWidths).map(([colIdx, width]) => ({
        wch: Number(width) || 20,
      }));
    } else {
      ws['!cols'] = columns.map(() => ({ wch: 30 }));
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Feuille 1');

    // Write workbook to binary buffer and trigger download
    XLSX.writeFile(wb, filename);
  };

  return { exportToXlsx };
}
