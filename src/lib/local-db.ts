import { del as legacyDel, get as legacyGet } from "idb-keyval";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "scana-local-db";
const DB_VERSION = 2;
const MASTER_KEY_ID = "master-aes-gcm-256";

interface MetaRecord {
  key: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

interface ImageRecord {
  id: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  mimeType: string;
  size: number;
  savedAt: number;
}

interface OcrRecord {
  id: string;
  /** Identifiant opaque de page utilisé uniquement pour purger le cache associé. */
  pageId: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  savedAt: number;
}

export interface LocalOcrResult {
  id: string;
  pageId: string;
  cacheKey: string;
  text: string;
  confidence: number | null;
  language: string;
  processedAt: number;
}

interface KeyRecord {
  id: string;
  key: CryptoKey;
}

interface ScanaDatabase extends DBSchema {
  meta: {
    key: string;
    value: MetaRecord;
  };
  images: {
    key: string;
    value: ImageRecord;
  };
  ocr: {
    key: string;
    value: OcrRecord;
    indexes: { "by-page": string };
  };
  keys: {
    key: string;
    value: KeyRecord;
  };
}

let databasePromise: Promise<IDBPDatabase<ScanaDatabase>> | undefined;
let masterKeyPromise: Promise<CryptoKey> | undefined;

function isBrowser(): boolean {
  return typeof window !== "undefined" && Boolean(window.indexedDB && window.crypto?.subtle);
}

function requireBrowser(): void {
  if (!isBrowser()) {
    throw new Error("Le stockage local sécurisé est disponible uniquement dans le navigateur.");
  }
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function getDatabase(): Promise<IDBPDatabase<ScanaDatabase>> {
  requireBrowser();
  databasePromise ??= openDB<ScanaDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }

      // Version 1 stored OCR fields in clear text. Discard only that cache during
      // migration; source images and the encrypted application state are retained.
      if (oldVersion < 2 && db.objectStoreNames.contains("ocr")) {
        db.deleteObjectStore("ocr");
      }
      if (!db.objectStoreNames.contains("ocr")) {
        const store = db.createObjectStore("ocr", { keyPath: "id" });
        store.createIndex("by-page", "pageId");
      }
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "id" });
      }
    },
  });
  return databasePromise;
}

async function getMasterKey(): Promise<CryptoKey> {
  requireBrowser();
  masterKeyPromise ??= (async () => {
    const db = await getDatabase();
    const existing = await db.get("keys", MASTER_KEY_ID);
    if (existing?.key) return existing.key;

    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await db.put("keys", { id: MASTER_KEY_ID, key });
    return key;
  })();
  return masterKeyPromise;
}

async function encryptBytes(
  bytes: ArrayBuffer,
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getMasterKey(),
    bytes,
  );
  return { iv, ciphertext };
}

async function decryptBytes(
  record: Pick<MetaRecord, "iv" | "ciphertext">,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(record.iv) },
    await getMasterKey(),
    record.ciphertext,
  );
}

export async function getEncryptedState(name: string): Promise<string | null> {
  if (!isBrowser()) return null;
  const db = await getDatabase();
  const record = await db.get("meta", name);
  if (record) {
    const bytes = await decryptBytes(record);
    return new TextDecoder().decode(bytes);
  }

  const legacy = await legacyGet<unknown>(name);
  if (typeof legacy !== "string") return null;
  const encrypted = await encryptBytes(toArrayBuffer(new TextEncoder().encode(legacy)));
  await db.put("meta", { key: name, ...encrypted });
  await legacyDel(name);
  return legacy;
}

export async function setEncryptedState(name: string, value: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDatabase();
  const encrypted = await encryptBytes(toArrayBuffer(new TextEncoder().encode(value)));
  await db.put("meta", { key: name, ...encrypted });
}

export async function deleteEncryptedState(name: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDatabase();
  await db.delete("meta", name);
}

/**
 * Efface toutes les données Scana de cet appareil. La clé maître est supprimée
 * avec les données afin qu'aucun ancien blob ne puisse être déchiffré ensuite.
 */
export async function clearLocalData(): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDatabase();
  const tx = db.transaction(["meta", "images", "ocr", "keys"], "readwrite");
  await Promise.all([
    tx.objectStore("meta").clear(),
    tx.objectStore("images").clear(),
    tx.objectStore("ocr").clear(),
    tx.objectStore("keys").clear(),
  ]);
  await tx.done;
  await legacyDel("scana-store");
  masterKeyPromise = undefined;
}

export async function saveImageBlob(pageId: string, blob: Blob): Promise<void> {
  const db = await getDatabase();
  const encrypted = await encryptBytes(await blob.arrayBuffer());
  await db.put("images", {
    id: pageId,
    ...encrypted,
    mimeType: blob.type || "application/octet-stream",
    size: blob.size,
    savedAt: Date.now(),
  });
}

export async function getImageBlob(pageId: string): Promise<Blob | undefined> {
  if (!isBrowser()) return undefined;
  const db = await getDatabase();
  const record = await db.get("images", pageId);
  if (!record) return undefined;
  const bytes = await decryptBytes(record);
  return new Blob([bytes], { type: record.mimeType });
}

export async function deleteImageBlob(pageId: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDatabase();
  const tx = db.transaction(["images", "ocr"], "readwrite");
  await tx.objectStore("images").delete(pageId);
  const ocrRecords = await tx.objectStore("ocr").index("by-page").getAllKeys(pageId);
  await Promise.all(ocrRecords.map((key) => tx.objectStore("ocr").delete(key)));
  await tx.done;
}

export async function deleteImageBlobs(pageIds: string[]): Promise<void> {
  await Promise.all(pageIds.map((pageId) => deleteImageBlob(pageId)));
}

export function createOcrCacheKey(filter: string, width: number, height: number): string {
  return `${filter}:${width}x${height}`;
}

function ocrId(pageId: string, cacheKey: string): string {
  return `${pageId}:${cacheKey}`;
}

function encodeOcrResult(result: Omit<LocalOcrResult, "id">): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(JSON.stringify(result)));
}

async function decodeOcrResult(record: OcrRecord): Promise<LocalOcrResult> {
  const bytes = await decryptBytes(record);
  const result = JSON.parse(new TextDecoder().decode(bytes)) as Omit<LocalOcrResult, "id">;
  return { ...result, id: record.id };
}

export async function getLocalOcrResult(
  pageId: string,
  cacheKey: string,
): Promise<LocalOcrResult | undefined> {
  if (!isBrowser()) return undefined;
  const db = await getDatabase();
  const record = await db.get("ocr", ocrId(pageId, cacheKey));
  return record ? decodeOcrResult(record) : undefined;
}

export async function saveLocalOcrResult(
  result: Omit<LocalOcrResult, "id">,
): Promise<void> {
  const db = await getDatabase();
  const encrypted = await encryptBytes(encodeOcrResult(result));
  await db.put("ocr", {
    id: ocrId(result.pageId, result.cacheKey),
    pageId: result.pageId,
    ...encrypted,
    savedAt: Date.now(),
  });
}

export async function deleteLocalOcrResults(pageId: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDatabase();
  const tx = db.transaction("ocr", "readwrite");
  const keys = await tx.store.index("by-page").getAllKeys(pageId);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

export async function encryptForStorage(
  bytes: ArrayBuffer | Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  return encryptBytes(toArrayBuffer(bytes));
}

export async function decryptForStorage(
  record: Pick<ImageRecord, "iv" | "ciphertext">,
): Promise<ArrayBuffer> {
  return decryptBytes(record);
}
