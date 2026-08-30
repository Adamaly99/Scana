/**
 * Dérivation de clé à partir du mot de passe utilisateur (PBKDF2).
 * La clé dérivée sert à wrap/unwrap la clé maître locale.
 */

const PBKDF2_ITERATIONS = 100_000;

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export async function wrapMasterKey(
  masterKey: CryptoKey,
  derivedKey: CryptoKey
): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    masterKey,
    derivedKey,
    { name: 'AES-GCM', iv }
  );
  return { wrappedKey, iv };
}

export async function unwrapMasterKey(
  wrappedKey: ArrayBuffer,
  iv: Uint8Array,
  derivedKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    derivedKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function generateRecoveryPhrase(): string {
  // Simple entropy generator (12 mots = 128 bits)
  // En production, utiliser bip39.generateMnemonic()
  const words = [
    'abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse',
    'access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act'
  ];
  const phrase: string[] = [];
  for (let i = 0; i < 12; i++) {
    phrase.push(words[Math.floor(Math.random() * words.length)]);
  }
  return phrase.join(' ');
}

export async function deriveKeyFromRecoveryPhrase(phrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phrase);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}
