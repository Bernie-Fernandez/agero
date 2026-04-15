/**
 * Run this script to send a test invitation email:
 *   node scripts/test-email.mjs
 *
 * Requires RESEND_API_KEY to be set in .env.local first.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// Parse .env.local
const envPath = join(__dir, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
    })
);

const RESEND_API_KEY = env.RESEND_API_KEY;
const FROM = env.RESEND_FROM || "Agero Safety <onboarding@resend.dev>";

if (!RESEND_API_KEY) {
  console.error("ERROR: RESEND_API_KEY is not set in .env.local");
  process.exit(1);
}

const { Resend } = await import("resend");
const resend = new Resend(RESEND_API_KEY);

const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
const registrationUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register/test-token-preview`;

const { data, error } = await resend.emails.send({
  from: FROM,
  to: "bfernandez@agero.com.au",
  subject: `[TEST] You've been invited to join Agero — Demo Subcontractor Pty Ltd`,
  html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:600px;margin:0 auto;padding:32px 16px">
    <h2 style="margin-top:0">You've been invited to Agero</h2>
    <p>Hi Ben,</p>
    <p><strong>Agero Safety</strong> has invited <strong>Demo Subcontractor Pty Ltd</strong> to join the Agero safety platform.</p>
    <p>Complete your company registration using the button below. This link expires on <strong>${expiresAt.toLocaleDateString("en-AU")}</strong>.</p>
    <p style="margin:32px 0">
      <a href="${registrationUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete registration →</a>
    </p>
    <p style="color:#71717a;font-size:14px">Or copy this link: ${registrationUrl}</p>
    <p style="font-size:14px">You'll be asked to provide your ABN, trade categories, and compliance documents.</p>
    <hr style="margin-top:40px;border:none;border-top:1px solid #e4e4e7"/>
    <p style="font-size:12px;color:#71717a;margin-top:16px">Agero Safety Platform · Victoria, Australia</p>
  </body></html>`,
});

if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}

console.log("✓ Test invitation sent to bfernandez@agero.com.au");
console.log("  Message ID:", data?.id);
