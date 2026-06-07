export function generateSmsCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function toE164(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("61")) return `+${digits}`;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  return `+61${digits}`;
}

export async function sendSmsCode(mobile: string, code: string): Promise<void> {
  const message = `Your Agero Safety code is: ${code}. Valid for 10 minutes.`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[SMS DEV] To: ${mobile} | Code: ${code}`);
    return;
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials not configured.");
  }
  const to = toE164(mobile);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    console.error("[SMS] Twilio error:", text);
    throw new Error("Failed to send SMS. Please try again.");
  }
}