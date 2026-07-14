import type { AppState } from "./types";

const DB_NAME = "resaleos-local";
const STORE_NAME = "workspace";
const STATE_KEY = "current-state";
const FALLBACK_KEY = "resaleos-state";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await openDatabase();
    const value = await new Promise<AppState | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve((request.result as AppState) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch {
    const fallback = window.localStorage.getItem(FALLBACK_KEY);
    return fallback ? (JSON.parse(fallback) as AppState) : null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });

  const maximum = 1200;
  const scale = Math.min(1, maximum / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function exportState(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resaleos-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importState(file: File): Promise<AppState> {
  const parsed = JSON.parse(await file.text()) as Partial<AppState>;
  if (parsed.version !== 1 || !parsed.settings || !Array.isArray(parsed.opportunities)) {
    throw new Error("Ce fichier n’est pas une sauvegarde ResaleOS valide.");
  }
  return parsed as AppState;
}
