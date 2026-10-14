import { encryptSecretPayload, decryptSecretPayload, previousEncryptionKeys } from '@idp/shared/dist/security/secret-crypto';

export type EncryptedPayload = {
  iv: string;
  authTag: string;
  encryptedValue: string;
};

const getKeyFromEnv = (envName: string, expectedBytes: number): Buffer => {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`${envName} is required`);
  }
  const isHex = /^[a-fA-F0-9]+$/.test(raw) && raw.length === expectedBytes * 2;
  const buffer = isHex ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buffer.length !== expectedBytes) {
    throw new Error(`${envName} must decode to ${expectedBytes} bytes`);
  }
  return buffer;
};

export const getEncryptionKey = () => {
  return getKeyFromEnv(
    process.env.CORE_ENCRYPTION_KEY ? 'CORE_ENCRYPTION_KEY' : 'ENCRYPTION_KEY',
    32
  );
};

export const encryptSecret = (value: string): EncryptedPayload => {
  return encryptSecretPayload(value, getEncryptionKey());
};

export const decryptSecret = (payload: EncryptedPayload): string => {
  return decryptSecretPayload(payload, [getEncryptionKey(), ...previousEncryptionKeys()]);
};
