import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "Agero Safety <onboarding@resend.dev>";

function html(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:600px;margin:0 auto;padding:32px 16px">${body}<hr style="margin-top:40px;border:none;border-top:1px solid #e4e4e7"/><p style="font-size:12px;color:#71717a;margin-top:16px">Agero Safety Platform · Victoria, Australia</p></body></html>`;
}

export async function sendUnknownWorkerAlert(opts: {
  workerName: string;
  workerMobile: string;
  projectName: string;
  siteVisitId: string;
  supervisorMobile?: string;
  supervisorEmail?: string;
  projectManagerEmail?: string;
}) {
  const subject = `⚠ Unknown worker signed in — ${opts.projectName}`;
  const recipients = [opts.supervisorEmail, opts.projectManagerEmail].filter(Boolean) as string[];

  if (recipients.length > 0) {
    await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html: html(`
        <h2 style="margin-top:0;color:#d97706">Unknown worker sign-in alert</h2>
        <p>An unregistered worker has signed in at <strong>${opts.projectName}</strong>.</p>
        <table style="font-size:14px;border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:6px 12px 6px 0;color:#71717a;width:140px">Name</td><td style="padding:6px 0;font-weight:600">${opts.workerName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#71717a">Mobile</td><td style="padding:6px 0">${opts.workerMobile}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#71717a">Site visit ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${opts.siteVisitId}</td></tr>
        </table>
        <p style="font-size:14px;color:#b45309">Please verify this worker's identity within 1 hour.</p>
      `),
    });
  }

  // Log for SMS integration (Twilio not yet configured)
  if (opts.supervisorMobile) {
    console.log(`[ALERT - SMS] ${opts.supervisorMobile}: Unknown worker "${opts.workerName}" (${opts.workerMobile}) signed in at ${opts.projectName}. Visit ID: ${opts.siteVisitId}`);
  }
}

export async function sendEscalationAlert(opts: {
  siteVisitId: string;
  workerName: string;
  projectName: string;
}) {
  console.log(`[ESCALATION] Unverified worker "${opts.workerName}" at ${opts.projectName} not verified within 1 hour. Visit ID: ${opts.siteVisitId}`);
  // TODO: send to configured Agero admin email when admin email env var is added
}

export async function sendInductionLink(opts: {
  workerName: string;
  workerMobile: string;
  workerEmail?: string;
  inductionUrl: string;
}) {
  const msg = `Hi ${opts.workerName}, complete your Agero safety induction here: ${opts.inductionUrl}`;
  // SMS via Twilio (not yet configured)
  console.log("[INDUCTION - SMS]", opts.workerMobile, msg);

  if (opts.workerEmail) {
    await resend.emails.send({
      from: FROM,
      to: opts.workerEmail,
      subject: "Complete your Agero safety induction",
      html: html(`
        <h2 style="margin-top:0">Safety induction required</h2>
        <p>Hi ${opts.workerName},</p>
        <p>Please complete your safety induction before signing in to site.</p>
        <p style="margin:32px 0">
          <a href="${opts.inductionUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Start induction →</a>
        </p>
      `),
    });
  }
}

export async function sendExpiryAlert(opts: {
  recipientEmail: string;
  documentType: string;
  entityName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}) {
  const urgent = opts.daysUntilExpiry <= 7;
  const prefix = urgent ? "URGENT: " : "";
  const badgeColor = urgent ? "#dc2626" : "#d97706";
  await resend.emails.send({
    from: FROM,
    to: opts.recipientEmail,
    subject: `${prefix}${opts.documentType} expiring in ${opts.daysUntilExpiry} days — ${opts.entityName}`,
    html: html(`
      <h2 style="margin-top:0;color:${badgeColor}">${urgent ? "⚠ Urgent: " : ""}Document expiring soon</h2>
      <p><strong>${opts.documentType}</strong> for <strong>${opts.entityName}</strong> expires on
        <strong>${opts.expiryDate.toLocaleDateString("en-AU")}</strong>
        (${opts.daysUntilExpiry} days).</p>
      <p style="font-size:13px;color:#71717a">Log in to Agero to upload a renewal.</p>
    `),
  });
}
