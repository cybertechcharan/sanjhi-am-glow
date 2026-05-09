import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { ref, get, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

const ISSUER = "Cyber Panel";
const LABEL = "Admin";

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getTotpUri(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: LABEL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export async function generateQrDataUrl(secret: string): Promise<string> {
  const uri = getTotpUri(secret);
  return QRCode.toDataURL(uri, { width: 256, margin: 2 });
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: LABEL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export async function saveTotpSecret(secret: string): Promise<void> {
  await set(ref(db, "security_settings/totp_secret"), secret);
  await set(ref(db, "security_settings/totp_enabled"), true);
}

export async function getTotpSettings(): Promise<{ enabled: boolean; secret: string | null }> {
  const [enabledSnap, secretSnap] = await Promise.all([
    get(ref(db, "security_settings/totp_enabled")),
    get(ref(db, "security_settings/totp_secret")),
  ]);
  return {
    enabled: enabledSnap.val() === true,
    secret: secretSnap.val() || null,
  };
}

export async function disableTotp(): Promise<void> {
  await set(ref(db, "security_settings/totp_enabled"), false);
  await set(ref(db, "security_settings/totp_secret"), null);
}
