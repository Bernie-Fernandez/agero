/**
 * Alert stubs — replace with Twilio (SMS) + SendGrid/Resend (email) in production.
 * Each function logs to console so you can see what would be sent.
 */

export async function sendUnknownWorkerAlert(opts: {
  workerName: string;
  workerMobile: string;
  projectName: string;
  siteVisitId: string;
  supervisorMobile?: string;
  supervisorEmail?: string;
  projectManagerEmail?: string;
}) {
  const msg = `AGERO ALERT: Unknown worker "${opts.workerName}" (${opts.workerMobile}) signed in at ${opts.projectName}. Verify within 1 hour. Visit ID: ${opts.siteVisitId}`;
  console.log("[ALERT - SMS]", opts.supervisorMobile, msg);
  console.log("[ALERT - EMAIL]", opts.supervisorEmail, msg);
  console.log("[ALERT - EMAIL]", opts.projectManagerEmail, msg);
  // TODO: await twilio.messages.create({ to: opts.supervisorMobile, body: msg, from: process.env.TWILIO_FROM })
  // TODO: await sendgrid.send({ to: opts.supervisorEmail, subject: 'Unknown worker sign-in', text: msg })
}

export async function sendEscalationAlert(opts: {
  siteVisitId: string;
  workerName: string;
  projectName: string;
}) {
  const msg = `AGERO ESCALATION: Unverified worker "${opts.workerName}" at ${opts.projectName} has not been verified within 1 hour. Visit ID: ${opts.siteVisitId}`;
  console.log("[ESCALATION - EMAIL] agero-admin", msg);
  // TODO: send to configured Agero admin email
}

export async function sendInductionLink(opts: {
  workerName: string;
  workerMobile: string;
  workerEmail?: string;
  inductionUrl: string;
}) {
  const msg = `Hi ${opts.workerName}, complete your Agero safety induction here: ${opts.inductionUrl}`;
  console.log("[INDUCTION - SMS]", opts.workerMobile, msg);
  if (opts.workerEmail) {
    console.log("[INDUCTION - EMAIL]", opts.workerEmail, msg);
  }
  // TODO: await twilio.messages.create({ to: opts.workerMobile, body: msg, from: process.env.TWILIO_FROM })
}

export async function sendExpiryAlert(opts: {
  recipientEmail: string;
  documentType: string;
  entityName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}) {
  const msg = `AGERO EXPIRY: ${opts.documentType} for ${opts.entityName} expires in ${opts.daysUntilExpiry} days (${opts.expiryDate.toLocaleDateString("en-AU")}).`;
  console.log("[EXPIRY - EMAIL]", opts.recipientEmail, msg);
  // TODO: integrate with email provider
}
