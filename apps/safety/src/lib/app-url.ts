/**
 * Returns the canonical app base URL:
 *  1. NEXT_PUBLIC_APP_URL  — set explicitly per environment (preferred)
 *  2. VERCEL_URL           — auto-injected by Vercel (no protocol, so we add https://)
 *  3. http://localhost:3000 — local dev fallback
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
