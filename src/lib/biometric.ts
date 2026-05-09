/**
 * Biometric (Fingerprint) Login — Beta Feature
 * 
 * Uses Web Crypto API to encrypt/decrypt credentials stored in localStorage.
 * Uses WebAuthn (navigator.credentials) for biometric verification.
 * Falls back gracefully if biometrics are not supported.
 */

const CRED_KEY = "bio_creds_enc";
const IV_KEY = "bio_creds_iv";
const CRYPTO_KEY_NAME = "bio_crypto_key";

// Check if WebAuthn / biometrics are available on this device
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

// Check if credentials are already saved
export const hasSavedCredentials = (): boolean => {
  return !!localStorage.getItem(CRED_KEY) && !!localStorage.getItem(IV_KEY);
};

// Generate a stable crypto key for this device
const getOrCreateCryptoKey = async (): Promise<CryptoKey> => {
  const stored = localStorage.getItem(CRYPTO_KEY_NAME);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const exported = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem(CRYPTO_KEY_NAME, btoa(String.fromCharCode(...new Uint8Array(exported))));
  return key;
};

// Encrypt and save credentials
export const saveCredentials = async (email: string, password: string): Promise<void> => {
  try {
    const key = await getOrCreateCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify({ email, password }));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    localStorage.setItem(IV_KEY, btoa(String.fromCharCode(...iv)));
  } catch (err) {
    console.warn("Failed to save biometric credentials:", err);
  }
};

// Decrypt and retrieve saved credentials
export const getCredentials = async (): Promise<{ email: string; password: string } | null> => {
  try {
    const encB64 = localStorage.getItem(CRED_KEY);
    const ivB64 = localStorage.getItem(IV_KEY);
    if (!encB64 || !ivB64) return null;

    const key = await getOrCreateCryptoKey();
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text);
  } catch {
    clearCredentials();
    return null;
  }
};

// Clear saved credentials
export const clearCredentials = (): void => {
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(IV_KEY);
  localStorage.removeItem(CRYPTO_KEY_NAME);
};

// ── Pattern Lock ──

const PATTERN_KEY = "pattern_lock_hash";
const PATTERN_CRED_KEY = "pattern_creds_enc";
const PATTERN_IV_KEY = "pattern_creds_iv";

// Hash a pattern array into a string
const hashPattern = async (pattern: number[]): Promise<string> => {
  const data = new TextEncoder().encode(pattern.join("-"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
};

// Save pattern + encrypted credentials
export const savePattern = async (pattern: number[], email: string, password: string): Promise<void> => {
  try {
    const hash = await hashPattern(pattern);
    localStorage.setItem(PATTERN_KEY, hash);
    const key = await getOrCreateCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify({ email, password }));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    localStorage.setItem(PATTERN_CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    localStorage.setItem(PATTERN_IV_KEY, btoa(String.fromCharCode(...iv)));
  } catch (err) {
    console.warn("Failed to save pattern:", err);
  }
};

// Re-save credentials for existing pattern (keeps the pattern hash, updates encrypted creds)
export const savePatternCreds = async (email: string, password: string): Promise<void> => {
  try {
    if (!localStorage.getItem(PATTERN_KEY)) return;
    const key = await getOrCreateCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify({ email, password }));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    localStorage.setItem(PATTERN_CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    localStorage.setItem(PATTERN_IV_KEY, btoa(String.fromCharCode(...iv)));
  } catch (err) {
    console.warn("Failed to save pattern creds:", err);
  }
};

// Check if pattern is saved
export const hasSavedPattern = (): boolean => {
  return !!localStorage.getItem(PATTERN_KEY) && !!localStorage.getItem(PATTERN_CRED_KEY);
};

// Verify pattern and return credentials
export const verifyPattern = async (pattern: number[]): Promise<{ email: string; password: string } | null> => {
  try {
    const savedHash = localStorage.getItem(PATTERN_KEY);
    if (!savedHash) return null;
    const inputHash = await hashPattern(pattern);
    if (inputHash !== savedHash) return null;
    // Decrypt credentials
    const encB64 = localStorage.getItem(PATTERN_CRED_KEY);
    const ivB64 = localStorage.getItem(PATTERN_IV_KEY);
    if (!encB64 || !ivB64) return null;
    const key = await getOrCreateCryptoKey();
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    clearPattern();
    return null;
  }
};

// Clear pattern data
export const clearPattern = (): void => {
  localStorage.removeItem(PATTERN_KEY);
  localStorage.removeItem(PATTERN_CRED_KEY);
  localStorage.removeItem(PATTERN_IV_KEY);
};

// Trigger biometric verification using WebAuthn
export const verifyBiometric = async (): Promise<boolean> => {
  try {
    // Check if we already have a credential registered
    const credIdB64 = localStorage.getItem("bio_cred_id");
    
    if (!credIdB64) {
      // First time: register a credential
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Cyber Panel", id: window.location.hostname },
          user: {
            id: userId,
            name: "panel-user",
            displayName: "Panel User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) return false;
      localStorage.setItem("bio_cred_id", btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
      return true;
    }

    // Authenticate with existing credential
    const credId = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0));
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: credId, type: "public-key", transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch (err: any) {
    // User cancelled or biometric failed
    if (err?.name === "NotAllowedError") return false;
    console.warn("Biometric verification failed:", err);
    return false;
  }
};
