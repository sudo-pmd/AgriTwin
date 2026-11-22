import type { ParcelConfig, ParcelDocument } from '../types/agritwin';

const PARCELS_KEY = 'agritwin.parcels.v1';
const DB_NAME = 'agritwin-verification';
const STORE = 'documents';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putDocumentFile(id: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getDocumentFile(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

export async function deleteDocumentFile(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function loadParcelConfigs(): ParcelConfig[] {
  try {
    const raw = window.localStorage.getItem(PARCELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParcelConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveParcelConfigs(configs: ParcelConfig[]) {
  window.localStorage.setItem(PARCELS_KEY, JSON.stringify(configs));
}

export function upsertParcelConfig(config: ParcelConfig): ParcelConfig[] {
  const existing = loadParcelConfigs();
  const next = existing.some((item) => item.id === config.id)
    ? existing.map((item) => (item.id === config.id ? config : item))
    : [...existing, config];
  saveParcelConfigs(next);
  return next;
}

export function documentLabel(kind: ParcelDocument['kind']): string {
  switch (kind) {
    case 'identite':
      return "Pièce d'identité";
    case 'foncier':
      return 'Titre foncier ou bail';
    case 'exploitation':
      return "Justificatif d'exploitation";
    default:
      return 'Photo de la parcelle';
  }
}
