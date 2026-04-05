import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "Agero Safety <onboarding@resend.dev>";

function html(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:600px;margin:0 auto;padding:32px 16px">${body}<hr style="margin-top:40px;border:none;border-top:1px solid #e4e4e7"/><p style="font-size:12px;color:#71717a;margin-top:16px">Agero Safety Platform · Victoria, Australia</p></body></html>`;
}

export async function sendInvitationEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  invitedBy: string;
  registrationUrl: string;
  expiresAt: Date;
}) {
  const subject = `You've been invited to join Agero — ${opts.companyName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">You've been invited to Agero</h2>
      <p>Hi ${opts.contactName},</p>
      <p><strong>${opts.invitedBy}</strong> has invited <strong>${opts.companyName}</strong> to join the Agero safety platform.</p>
      <p>Complete your company registration using the button below. This link expires on <strong>${opts.expiresAt.toLocaleDateString("en-AU")}</strong>.</p>
      <p style="margin:32px 0">
        <a href="${opts.registrationUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete registration →</a>
      </p>
      <p style="color:#71717a;font-size:14px">Or copy this link: ${opts.registrationUrl}</p>
      <p style="font-size:14px">You'll be asked to provide your ABN, trade categories, and compliance documents.</p>
    `),
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  documentsUrl: string;
}) {
  const subject = `Welcome to Agero — complete your compliance documents`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Welcome to Agero!</h2>
      <p>Hi ${opts.contactName},</p>
      <p><strong>${opts.companyName}</strong> has been registered on the platform.</p>
      <p>Next step — upload your compliance documents:</p>
      <p style="margin:32px 0">
        <a href="${opts.documentsUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Upload documents →</a>
      </p>
      <p style="font-size:14px"><strong>Required documents:</strong></p>
      <ul style="font-size:14px;color:#3f3f46">
        <li>Public Liability Insurance (min. $20M)</li>
        <li>Workers Compensation Insurance</li>
        <li>Contract Works Insurance</li>
        <li>WHS Policy</li>
      </ul>
    `),
  });
}

export async function sendDocumentExpiryEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  documentType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  urgent: boolean;
  documentsUrl: string;
}) {
  const prefix = opts.urgent ? "URGENT: " : "";
  const subject = `${prefix}${opts.documentType} expiring in ${opts.daysUntilExpiry} days — ${opts.companyName}`;
  const badgeColor = opts.urgent ? "#dc2626" : "#d97706";
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:${badgeColor}">${opts.urgent ? "⚠ Urgent: " : ""}Document expiring soon</h2>
      <p>Hi ${opts.contactName},</p>
      <p>Your <strong>${opts.documentType}</strong> for <strong>${opts.companyName}</strong> expires on
        <strong>${opts.expiryDate.toLocaleDateString("en-AU")}</strong>
        (${opts.daysUntilExpiry} days from now).</p>
      <p>Please upload a renewal to avoid disruption to your workers on site.</p>
      <p style="margin:32px 0">
        <a href="${opts.documentsUrl}" style="background:${badgeColor};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Renew document →</a>
      </p>
      <p style="font-size:13px;color:#71717a">If this document is not renewed before expiry, your workers may be blocked from signing in to site.</p>
    `),
  });
}

export async function sendSwmsRejectedEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  projectName: string;
  reviewerComments: string;
  resubmitUrl: string;
}) {
  const subject = `SWMS rejected — ${opts.projectName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#dc2626">SWMS requires revision</h2>
      <p>Hi ${opts.contactName},</p>
      <p>Your Safe Work Method Statement for <strong>${opts.projectName}</strong> has been reviewed and requires revision.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:20px 0">
        <p style="margin:0;font-size:14px;font-weight:600;color:#991b1b">Safety manager comments:</p>
        <p style="margin:8px 0 0;font-size:14px;color:#7f1d1d;white-space:pre-wrap">${opts.reviewerComments}</p>
      </div>
      <p style="margin:32px 0">
        <a href="${opts.resubmitUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Resubmit SWMS →</a>
      </p>
    `),
  });
}

export async function sendInductionBlockedAlert(opts: {
  to: string;
  adminName: string;
  workerName: string;
  companyName: string;
  inductionTitle: string;
  projectName: string;
  blockedUntil: Date;
}) {
  const subject = `Worker blocked from site — induction failed 3 times · ${opts.workerName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#dc2626">Worker blocked from site</h2>
      <p>Hi ${opts.adminName},</p>
      <p><strong>${opts.workerName}</strong> from <strong>${opts.companyName}</strong> has failed the induction
        <strong>${opts.inductionTitle}</strong> on project <strong>${opts.projectName}</strong>
        three times and has been <strong style="color:#dc2626">blocked from site access for 24 hours</strong>.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#991b1b">
          Block expires: <strong>${opts.blockedUntil.toLocaleString("en-AU")}</strong>
        </p>
      </div>
      <p style="font-size:14px">Please ensure ${opts.workerName} reviews the safety material and retries the induction
        after the block period has ended. If you have questions, contact your Agero safety manager.</p>
    `),
  });
}

export async function sendSwmsApprovedEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  projectName: string;
}) {
  const subject = `SWMS approved — ${opts.projectName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#16a34a">SWMS approved</h2>
      <p>Hi ${opts.contactName},</p>
      <p>Your Safe Work Method Statement for <strong>${opts.projectName}</strong> has been reviewed and <strong style="color:#16a34a">approved</strong>.</p>
      <p>Your team may now begin work on this project.</p>
    `),
  });
}
