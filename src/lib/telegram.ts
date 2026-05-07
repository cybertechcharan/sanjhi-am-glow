import { ref, onValue } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

interface TgConfig {
  bot_token: string;
  telegram_user_id: number;
}

let cachedConfig: TgConfig | null = null;

export function loadTelegramConfig(): Promise<TgConfig | null> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  return new Promise((resolve) => {
    const tgRef = ref(db, "telegram_settings");
    onValue(tgRef, (snapshot) => {
      if (snapshot.exists()) {
        cachedConfig = {
          bot_token: snapshot.child("bot_token").val() || "",
          telegram_user_id: snapshot.child("telegram_user_id").val() || 0,
        };
        resolve(cachedConfig);
      } else {
        resolve(null);
      }
    }, { onlyOnce: true });
  });
}

export function clearTelegramConfigCache() {
  cachedConfig = null;
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = await loadTelegramConfig();
  if (!config || !config.bot_token || !config.telegram_user_id) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram_user_id,
        text,
        parse_mode: "HTML",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// OTP generation & verification
let currentOtp: string | null = null;

export function generateOtp(): string {
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  currentOtp = otp;
  return otp;
}

export function verifyOtp(input: string): boolean {
  if (!currentOtp) return false;
  const match = input.trim() === currentOtp;
  if (match) currentOtp = null;
  return match;
}

export async function sendOtpToTelegram(action: string): Promise<boolean> {
  const otp = generateOtp();
  const msg = `🔐 <b>Dark x Panel 3.0 — 2FA OTP</b>\n\nAction: <b>${action}</b>\nOTP: <code>${otp}</code>\n\nThis OTP expires after one use.`;
  return sendTelegramMessage(msg);
}
