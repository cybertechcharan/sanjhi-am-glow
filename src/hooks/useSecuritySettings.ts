import { useState, useEffect } from "react";
import { ref, onValue } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

export type OtpMethod = "telegram" | "totp";

export interface SecuritySettings {
  otp_on_delete: boolean;
  otp_on_login: boolean;
  forward_sms_to_tg: boolean;
  biometric_login: boolean;
  pattern_login: boolean;
  totp_enabled: boolean;
  totp_secret: string | null;
  otp_method: OtpMethod;
}

export function useSecuritySettings() {
  const [security, setSecurity] = useState<SecuritySettings>({ otp_on_delete: false, otp_on_login: false, forward_sms_to_tg: false, biometric_login: false, pattern_login: false, totp_enabled: false, totp_secret: null, otp_method: "telegram" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const secRef = ref(db, "security_settings");
    const unsub = onValue(secRef, (snapshot) => {
      if (snapshot.exists()) {
        setSecurity({
          otp_on_delete: snapshot.child("otp_on_delete").val() ?? false,
          otp_on_login: snapshot.child("otp_on_login").val() ?? false,
          forward_sms_to_tg: snapshot.child("forward_sms_to_tg").val() ?? false,
          biometric_login: snapshot.child("biometric_login").val() ?? false,
          pattern_login: snapshot.child("pattern_login").val() ?? false,
          totp_enabled: snapshot.child("totp_enabled").val() ?? false,
          totp_secret: snapshot.child("totp_secret").val() ?? null,
          otp_method: snapshot.child("otp_method").val() ?? "telegram",
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { security, loading };
}
