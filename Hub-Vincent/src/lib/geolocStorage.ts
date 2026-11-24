import type { GeoWorkbookResult } from './geolocParser';

export interface StoredGeolocWorkbook {
  weekId: string;
  weekLabel: string;
  fileName: string;
  importedAt: string;
  totalVehicles: number;
  activeVehicles: number;
  totalTrips: number;
  totalKm: number;
  workbook: GeoWorkbookResult;
}

const DB_NAME = 'facility_hub_vincent_geoloc_v1';
const STORE_NAME = 'workbooks';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'weekId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erreur ouverture IndexedDB'));
  });
}

export async function saveGeolocWorkbookToHistory(workbook: GeoWorkbookResult): Promise<StoredGeolocWorkbook> {
  const entry: StoredGeolocWorkbook = {
    weekId: workbook.weekId,
    weekLabel: workbook.weekLabel,
    fileName: workbook.fileName,
    importedAt: new Date().toISOString(),
    totalVehicles: workbook.totalVehicles,
    activeVehicles: workbook.activeVehicles,
    totalTrips: workbook.totalTrips,
    totalKm: workbook.totalKm,
    workbook,
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Sauvegarde historique local Excel ignorée:', err);
  }
  return entry;
}

export async function listGeolocWorkbooksHistory(): Promise<StoredGeolocWorkbook[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<StoredGeolocWorkbook[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredGeolocWorkbook[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => (b.workbook?.startDate || b.importedAt).localeCompare(a.workbook?.startDate || a.importedAt));
  } catch (err) {
    console.warn('Lecture historique local Excel impossible:', err);
    return [];
  }
}

export async function deleteGeolocWorkbookFromHistory(weekId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(weekId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Suppression historique local Excel impossible:', err);
  }
}
