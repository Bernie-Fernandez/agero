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
  const subject = `You've been invited to join Agero Safety — ${opts.companyName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">You've been invited to Agero Safety</h2>
      <p>Hi ${opts.contactName},</p>
      <p><strong>${opts.invitedBy}</strong> has invited <strong>${opts.companyName}</strong> to join the Agero Safety platform.</p>
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
  const subject = `Welcome to Agero Safety — complete your compliance documents`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Welcome to Agero Safety!</h2>
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

export async function sendSitePrepChecklistEmail(opts: {
  to: string[];
  projectName: string;
  completionDate: string;
  managerName: string;
  yesCount: number;
  noCount: number;
  naCount: number;
  pdfUrl: string | null;
}) {
  const subject = `Site Preparation Checklist completed — ${opts.projectName}`;
  const statusColor = opts.noCount > 0 ? "#d97706" : "#16a34a";
  const statusText =
    opts.noCount > 0
      ? `${opts.noCount} non-compliant item${opts.noCount !== 1 ? "s" : ""} — corrective action required`
      : "All items compliant";
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Site Preparation Checklist — ${opts.projectName}</h2>
      <p>The site preparation checklist has been completed and signed off.</p>
      <table style="font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#71717a;width:160px">Project</td><td style="padding:4px 0"><strong>${opts.projectName}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Completion date</td><td style="padding:4px 0">${opts.completionDate}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Site manager</td><td style="padding:4px 0">${opts.managerName}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Items passed</td><td style="padding:4px 0"><strong style="color:#16a34a">${opts.yesCount}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Items failed (NO)</td><td style="padding:4px 0"><strong style="color:${opts.noCount > 0 ? "#dc2626" : "#16a34a"}">${opts.noCount}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Not applicable</td><td style="padding:4px 0">${opts.naCount}</td></tr>
      </table>
      <p style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:4px solid ${statusColor};border-radius:4px;color:${statusColor};font-weight:600">${statusText}</p>
      ${opts.pdfUrl ? `<p style="margin:32px 0"><a href="${opts.pdfUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View PDF →</a></p>` : ""}
      <p style="font-size:13px;color:#71717a">Non-compliant items require corrective action and re-inspection before site mobilisation can proceed.</p>
    `),
  });
}

export async function sendPreStartAssessmentEmail(opts: {
  to: string[];
  projectName: string;
  assessmentDate: string;
  assessorName: string;
  hrwCount: number;
  psychCount: number;
  pdfUrl: string | null;
}) {
  const subject = `Pre-Start Risk Assessment completed — ${opts.projectName}`;
  const flagSummary =
    opts.hrwCount === 0 && opts.psychCount === 0
      ? '<p style="color:#16a34a">No high-risk classifications or psychosocial hazards were identified.</p>'
      : `<ul style="font-size:14px">
          ${opts.hrwCount > 0 ? `<li><strong>${opts.hrwCount} high-risk work classification${opts.hrwCount !== 1 ? "s" : ""}</strong> identified — sub-forms required</li>` : ""}
          ${opts.psychCount > 0 ? `<li><strong>${opts.psychCount} psychosocial hazard${opts.psychCount !== 1 ? "s" : ""}</strong> identified — prevention plans required (VIC Dec 2025 Regs)</li>` : ""}
        </ul>`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Pre-Start Risk Assessment — ${opts.projectName}</h2>
      <p>A Pre-Start Risk Assessment has been completed and signed off.</p>
      <table style="font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#71717a;width:160px">Project</td><td style="padding:4px 0"><strong>${opts.projectName}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Assessment date</td><td style="padding:4px 0">${opts.assessmentDate}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Assessed by</td><td style="padding:4px 0">${opts.assessorName}</td></tr>
      </table>
      <div style="margin:16px 0">${flagSummary}</div>
      ${opts.pdfUrl ? `<p style="margin:32px 0"><a href="${opts.pdfUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View PDF →</a></p>` : ""}
      <p style="font-size:13px;color:#71717a">This assessment satisfies ISO 45001:2018 Clause 6.1 and Clause 8.1.4.2. The Site Preparation Checklist can now be started.</p>
    `),
  });
}

export async function sendMobReminderEmail(opts: {
  to: string;
  adminName: string | null;
  orgName: string;
  projectName: string;
  mobilisationDate: Date;
  pendingWorkers: { mobile: string; checklistUrl: string }[];
}) {
  const subject = `Reminder: ${opts.pendingWorkers.length} worker${opts.pendingWorkers.length !== 1 ? "s" : ""} haven't completed their pre-mobilisation checklist — ${opts.projectName}`;
  const rows = opts.pendingWorkers
    .map(
      (w) =>
        `<tr><td style="padding:6px 8px;font-family:monospace;font-size:13px">${w.mobile}</td><td style="padding:6px 8px"><a href="${w.checklistUrl}" style="color:#2563eb;font-size:13px">Complete checklist →</a></td></tr>`,
    )
    .join("");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#d97706">Pre-mobilisation checklist reminder</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p>The following workers from <strong>${opts.orgName}</strong> haven't completed their
        pre-mobilisation safety checklist for <strong>${opts.projectName}</strong>.
        Mobilisation is scheduled for <strong>${opts.mobilisationDate.toLocaleDateString("en-AU")}</strong>.</p>
      <p>An SMS reminder has been sent to each worker. You can also forward the links below directly:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border:1px solid #e4e4e7;border-radius:6px">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Mobile</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Checklist link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:13px;color:#71717a">Workers who haven't submitted their checklist before mobilisation may be blocked from site access.</p>
    `),
  });
}

export async function sendMobGateBlockedEmail(opts: {
  to: string;
  adminName: string | null;
  workerName: string;
  companyName: string;
  projectName: string;
  issues: string[];
  checklistUrl: string;
}) {
  const subject = `Worker blocked from site — pre-mobilisation incomplete · ${opts.workerName}`;
  const issueList = opts.issues.map((i) => `<li style="font-size:14px;color:#7f1d1d">${i}</li>`).join("");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#dc2626">Worker blocked from site sign-in</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p><strong>${opts.workerName}</strong> from <strong>${opts.companyName}</strong> attempted to sign in to
        <strong>${opts.projectName}</strong> but was blocked because the following pre-mobilisation
        requirements have not been met:</p>
      <ul style="margin:12px 0">${issueList}</ul>
      <p>Please ask ${opts.workerName} to complete their pre-mobilisation checklist before their next visit:</p>
      <p style="margin:32px 0">
        <a href="${opts.checklistUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete checklist →</a>
      </p>
      <p style="color:#71717a;font-size:13px">Or copy this link: ${opts.checklistUrl}</p>
      <p style="font-size:13px;color:#71717a">An SMS has also been sent to the worker. This notification will not repeat for 24 hours.</p>
    `),
  });
}
