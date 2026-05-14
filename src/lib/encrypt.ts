// AES-GCM encryption for Plaid access tokens at rest.
// Key is a 32-byte hex string stored in PLAID_TOKEN_ENCRYPTION_KEY env var.
// Server-side only — never import in client components.

const ALG = "AES-GCM";
const IV_LENGTH = 12; // bytes

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getKey(): Promise<CryptoKey> {
  const keyHex = process.env.PLAID_TOKEN_ENCRYPTION_KEY!;
  const keyBuffer = hexToBytes(keyHex);
  return crypto.subtle.importKey("raw", keyBuffer, { name: ALG }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const ivBuffer = crypto.getRandomValues(new Uint8Array(IV_LENGTH)).buffer as ArrayBuffer;
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALG, iv: ivBuffer }, key, encoded);
  return `${bytesToHex(ivBuffer)}:${bytesToHex(ciphertext)}`;
}

export async function decrypt(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, ctHex] = encrypted.split(":");
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ctHex);
  const plaintext = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
