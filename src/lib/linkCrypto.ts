/**
 * AES-GCM encryption for public share link tokens.
 * The URL contains only the encrypted blob — the decryption key lives in Firebase.
 */

export async function generateLinkKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(new Uint8Array(exported));
}

export async function encryptToken(plaintext: string, keyBase64: string): Promise<string> {
  const keyData = base64ToBuf(keyBase64);
  const key = await crypto.subtle.importKey("raw", keyData.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Format: base64(iv + ciphertext)
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bufToBase64(combined);
}

export async function decryptToken(encryptedBase64: string, keyBase64: string): Promise<string> {
  const combined = base64ToBuf(encryptedBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const keyData = base64ToBuf(keyBase64);
  const key = await crypto.subtle.importKey("raw", keyData.buffer as ArrayBuffer, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function bufToBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
