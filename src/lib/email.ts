/**
 * Email stubs — replace with Resend (resend.com) or SendGrid in production.
 * Each function logs the email content so you can see what would be sent.
 *
 * To wire up Resend:
 *   npm install resend
 *   import { Resend } from 'resend'
 *   const resend = new Resend(process.env.RESEND_API_KEY)
 *   await resend.emails.send({ from, to, subject, html })
 */

export async function sendInvitationEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  invitedBy: string;
  registrationUrl: string;
  expiresAt: Date;
}) {
  const subject = `You've been invited to join Agero — ${opts.companyName}`;
  const body = `
Hi ${opts.contactName},

${opts.invitedBy} has invited ${opts.companyName} to join the Agero safety platform.

Complete your company registration here:
${opts.registrationUrl}

This link expires on ${opts.expiresAt.toLocaleDateString("en-AU")}.

You'll be asked to provide your ABN, trade categories, and company documents.

Agero Safety Platform
  `.trim();

  console.log(`[EMAIL] To: ${opts.to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
  // TODO: await resend.emails.send({ from: 'noreply@agero.com.au', to: opts.to, subject, text: body })
}

export async function sendWelcomeEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  documentsUrl: string;
}) {
  const subject = `Welcome to Agero — complete your compliance documents`;
  const body = `
Hi ${opts.contactName},

Welcome to Agero! ${opts.companyName} has been registered on the platform.

Next step — upload your compliance documents:
${opts.documentsUrl}

Required documents:
• Public Liability Insurance (min. $20M)
• Workers Compensation Insurance
• Contract Works Insurance
• WHS Policy

Agero Safety Platform
  `.trim();

  console.log(`[EMAIL] To: ${opts.to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
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
  const body = `
Hi ${opts.contactName},

Your ${opts.documentType} for ${opts.companyName} expires on ${opts.expiryDate.toLocaleDateString("en-AU")} (${opts.daysUntilExpiry} days).

Please upload a renewal here:
${opts.documentsUrl}

If this document is not renewed before expiry, your workers will be blocked from signing in to site.

Agero Safety Platform
  `.trim();

  console.log(`[EMAIL] To: ${opts.to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
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
  const body = `
Hi ${opts.contactName},

Your Safe Work Method Statement for ${opts.projectName} has been reviewed and requires revision.

Safety manager comments:
${opts.reviewerComments}

Please revise your SWMS and resubmit here:
${opts.resubmitUrl}

Agero Safety Platform
  `.trim();

  console.log(`[EMAIL] To: ${opts.to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
}

export async function sendSwmsApprovedEmail(opts: {
  to: string;
  contactName: string;
  companyName: string;
  projectName: string;
}) {
  const subject = `SWMS approved — ${opts.projectName}`;
  const body = `
Hi ${opts.contactName},

Your Safe Work Method Statement for ${opts.projectName} has been reviewed and approved.

Your team may now begin work on this project.

Agero Safety Platform
  `.trim();

  console.log(`[EMAIL] To: ${opts.to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body:\n${body}`);
}
