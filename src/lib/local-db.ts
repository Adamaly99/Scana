import { del as legacyDel, get as legacyGet } from "idb-keyval";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";



const DB_NAME = "scana-local-db";

const DB_VERSION = 1;

const MASTER_KEY_ID = "master-aes-gcm-256";



interface MetaRecord {

  key: string;

  value: string;

}



interface ImageRecord {

  id: string;

  iv: Uint8Array;

  ciphertext: ArrayBuffer;

  mimeType: string;

  size: number;

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

    value: LocalOcrResult;

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

  if (!isBrowser()) throw new Error("Le stockage local sécurisé est disponible uniquement dans le navigateur.");

}



function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {

  if (value instanceof ArrayBuffer) return value;

  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

}



async function getDatabase(): Promise<IDBPDatabase<ScanaDatabase>> {

  requireBrowser();

  databasePromise ??= openDB<ScanaDatabase>(DB_NAME, DB_VERSION, {

    upgrade(db) {

      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });

      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });

      if (!db.objectStoreNames.contains("ocr")) {

        const store = db.createObjectStore("ocr", { keyPath: "id" });

        store.createIndex("by-page", "pageId");

      }

      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys", { keyPath: "id" });

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



async function encryptBytes(bytes: ArrayBuffer): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getMasterKey(), bytes);

  return { iv, ciphertext };

}



async function decryptBytes(record: Pick<ImageRecord, "iv" | "ciphertext">): Promise<ArrayBuffer> {

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

  if (record) return record.value;



  const legacy = await legacyGet<unknown>(name);

  if (typeof legacy !== "string") return null;

  await db.put("meta", { key: name, value: legacy });

  await legacyDel(name);

  return legacy;

}



export async function setEncryptedState(name: string, value: string): Promise<void> {

  if (!isBrowser()) return;

  const db = await getDatabase();

  await db.put("meta", { key: name, value });

}



export async function deleteEncryptedState(name: string): Promise<void> {

  if (!isBrowser()) return;

  const db = await getDatabase();

  await db.delete("meta", name);

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



export async function getLocalOcrResult(pageI
