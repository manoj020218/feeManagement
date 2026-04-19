import type { Institution } from '@/core/types';

const ENCRYPTED_BACKUP_KIND = 'feeflow.encrypted.backup';
const ENCRYPTED_BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 250000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedBackupEnvelopeV1 {
  kind: typeof ENCRYPTED_BACKUP_KIND;
  version: typeof ENCRYPTED_BACKUP_VERSION;
  kdf: {
    name: 'PBKDF2-SHA256';
    iterations: number;
    saltB64: string;
  };
  cipher: {
    name: 'AES-GCM';
    ivB64: string;
  };
  meta: {
    exportedAt: string;
    institutionId?: string;
    inviteCode?: string;
  };
  payloadB64: string;
}

function assertPassphrase(passphrase: string) {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Encryption passphrase must be at least 8 characters');
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toArrayBuffer(salt),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedBackupEnvelope(value: unknown): value is EncryptedBackupEnvelopeV1 {
  const obj = value as EncryptedBackupEnvelopeV1 | null;
  return !!obj
    && typeof obj === 'object'
    && obj.kind === ENCRYPTED_BACKUP_KIND
    && obj.version === ENCRYPTED_BACKUP_VERSION
    && obj.kdf?.name === 'PBKDF2-SHA256'
    && typeof obj.kdf?.iterations === 'number'
    && typeof obj.kdf?.saltB64 === 'string'
    && obj.cipher?.name === 'AES-GCM'
    && typeof obj.cipher?.ivB64 === 'string'
    && typeof obj.payloadB64 === 'string';
}

export function isPlainBackupShape(value: unknown): boolean {
  const obj = value as { institution?: unknown; members?: unknown; transactions?: unknown } | null;
  return !!obj
    && typeof obj === 'object'
    && !!obj.institution
    && Array.isArray(obj.members)
    && Array.isArray(obj.transactions);
}

export async function encryptBackupObject(
  backup: object,
  passphrase: string,
  institution?: Pick<Institution, 'id' | 'inviteCode'>,
): Promise<EncryptedBackupEnvelopeV1> {
  assertPassphrase(passphrase);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveAesKey(passphrase, salt);
  const payload = encoder.encode(JSON.stringify(backup));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(payload),
  );

  return {
    kind: ENCRYPTED_BACKUP_KIND,
    version: ENCRYPTED_BACKUP_VERSION,
    kdf: {
      name: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      saltB64: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      ivB64: bytesToBase64(iv),
    },
    meta: {
      exportedAt: new Date().toISOString(),
      institutionId: institution?.id,
      inviteCode: institution?.inviteCode,
    },
    payloadB64: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackupEnvelope(
  envelope: EncryptedBackupEnvelopeV1,
  passphrase: string,
): Promise<unknown> {
  assertPassphrase(passphrase);
  const salt = base64ToBytes(envelope.kdf.saltB64);
  const iv = base64ToBytes(envelope.cipher.ivB64);
  const payload = base64ToBytes(envelope.payloadB64);
  const key = await deriveAesKey(passphrase, salt);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(payload),
    );
    return JSON.parse(decoder.decode(plainBuffer));
  } catch {
    throw new Error('Could not decrypt backup. Check your passphrase.');
  }
}

export async function normalizeBackupPayload(
  payload: unknown,
  passphrase: string,
): Promise<unknown> {
  if (isEncryptedBackupEnvelope(payload)) {
    return decryptBackupEnvelope(payload, passphrase);
  }
  return payload;
}
