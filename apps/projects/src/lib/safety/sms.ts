export function generateSmsCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendSmsCode(mobile: string, code: string): Promise<void> {
  const message = `Your Agero Safety code is: ${code}. Valid for 10 minutes.`;

  if (process.env.NODE_ENV !== "production") {
    // Dev fallback — show code on screen via devCode, log to console
    console.log(`[SMS DEV] To: ${mobile} | Code: ${code}`);
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // TWILIO_PHONE_NUMBER may be a numeric E.164 number (+61412345678) or an
  // alphanumeric sender ID (e.g. "AgeroSafety") — both are passed as-is to
  // Twilio's From field; no transformation needed.
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials not configured.");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: mobile, From: from, Body: message }).toString(),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("[SMS] Twilio error:", text);
    throw new Error("Failed to send SMS. Please try again.");
  }
}
