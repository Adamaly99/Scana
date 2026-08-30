import { createClient } from './supabase-client';
import { getEncryptedState, setEncryptedState, getDatabase } from '@/lib/local-db';
import type { ScanDocument } from '@/lib/store';

interface SyncDocumentPayload {
  document_id: string;
  device_id: string;
  encrypted_metadata: { iv: number[]; ciphertext: number[]; version: number };
  encrypted_page_refs: Array<{ pageId: string; path: string; iv: number[] }>;
  updated_at: string;
}

export async function uploadDocument(
  userId: string,
  document: ScanDocument,
  deviceId: string
): Promise<void> {
  const supabase = createClient();
  
  // Chiffrer les métadonnées du document
  const metaString = JSON.stringify({
    name: document.name,
    pages: document.pages,
    createdAt: document.createdAt
  });
  
  const metaBytes = new TextEncoder().encode(metaString);
  const { iv, ciphertext } = await encryptForCloud(metaBytes);
  
  const payload: SyncDocumentPayload = {
    document_id: document.id,
    device_id: deviceId,
    encrypted_metadata: {
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
      version: 1
    },
    encrypted_page_refs: [], // Upload images first, then fill
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('documents_sync')
    .upsert(payload, { onConflict: 'user_id,document_id' });
    
  if (error) throw error;
}

export async function downloadDocuments(userId: string): Promise<unknown[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('documents_sync')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
}

// Helper pour chiffrement cloud (même clé maître que local)
async function encryptForCloud(bytes: ArrayBuffer): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const { encryptForStorage } = await import('@/lib/local-db');
  return encryptForStorage(bytes);
}
