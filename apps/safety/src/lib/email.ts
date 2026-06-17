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

export async function sendDilapidationEmail(opts: {
  to: string[];
  projectName: string;
  conductedAt: Date;
  conductedBy: string;
  pinCount: number;
  pdfUrl: string;
}) {
  const subject = `Dilapidation Report — ${opts.projectName}`;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Dilapidation Report — ${opts.projectName}</h2>
      <p>A pre-works dilapidation survey has been completed and is attached below.</p>
      <table style="font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#71717a;width:160px">Project</td><td><strong>${opts.projectName}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Date</td><td>${opts.conductedAt.toLocaleDateString("en-AU")}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Conducted by</td><td>${opts.conductedBy}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Items recorded</td><td>${opts.pinCount}</td></tr>
      </table>
      <p style="margin:32px 0"><a href="${opts.pdfUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View Dilapidation Report →</a></p>
      <p style="font-size:13px;color:#71717a">This report documents the pre-works condition of the site and surrounding areas. Retain for the duration of the project.</p>
    `),
  });
}

export async function sendRetentionReviewEmail(opts: {
  to: string;
  adminName: string | null;
  flaggedWorkers: { name: string; maskedMobile: string; lastActiveLabel: string }[];
  reviewUrl: string;
}) {
  const count = opts.flaggedWorkers.length;
  const subject = `Action required: ${count} worker${count !== 1 ? "s" : ""} flagged for data retention review`;
  const rows = opts.flaggedWorkers
    .map(
      (w) =>
        `<tr><td style="padding:6px 8px;font-size:13px">${w.name}</td><td style="padding:6px 8px;font-family:monospace;font-size:13px">${w.maskedMobile}</td><td style="padding:6px 8px;font-size:13px;color:#71717a">${w.lastActiveLabel}</td></tr>`,
    )
    .join("");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0;color:#18181b">Data retention review required</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p>The following ${count} worker${count !== 1 ? "s have" : " has"} been inactive on the Agero Safety platform for 2 or more years.
        Under APP 11 (Privacy Act 1988) and Agero's data retention policy, personal information that is no longer needed must be
        de-identified or destroyed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border:1px solid #e4e4e7;border-radius:6px">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Name</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Mobile</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Last active</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Please review each worker and choose to <strong>Anonymise</strong> (removes all personal information) or
        <strong>Dismiss</strong> (retain for a documented reason):</p>
      <p style="margin:32px 0">
        <a href="${opts.reviewUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Review flagged workers →</a>
      </p>
      <p style="font-size:13px;color:#71717a">Site visit history and attendance records are retained separately as they form part of the OHS audit trail.</p>
    `),
  });
}

// ── Sprint S4 ────────────────────────────────────────────────────────────────

export async function sendAnnualReviewDueEmail(opts: {
  to: string;
  adminName: string | null;
  dueTemplates: { name: string; nextReviewDate: string; daysUntil: number }[];
  reviewUrl: string;
}) {
  const count = opts.dueTemplates.length;
  const subject = `WHS annual review due: ${count} document${count !== 1 ? "s" : ""} within 30 days`;
  const rows = opts.dueTemplates
    .map(
      (t) =>
        `<tr><td style="padding:6px 8px;font-size:13px">${t.name}</td><td style="padding:6px 8px;font-size:13px;color:#71717a">${t.nextReviewDate}</td><td style="padding:6px 8px;font-size:13px;color:${t.daysUntil <= 7 ? "#dc2626" : "#d97706"}">${t.daysUntil <= 0 ? "Overdue" : `${t.daysUntil}d`}</td></tr>`,
    )
    .join("");
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html: html(`
      <h2 style="margin-top:0">Annual WHS documentation review due</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p>The following WHS document templates are due for their scheduled annual review (ISO 45001 Clause 10.3).
        Review and re-sign each to confirm it remains current against Victorian legislation.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border:1px solid #e4e4e7;border-radius:6px">
        <thead><tr style="background:#f4f4f5">
          <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Document</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Review due</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#71717a;font-weight:600">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:32px 0">
        <a href="${opts.reviewUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open annual review →</a>
      </p>
    `),
  });
}

export async function sendLegislationUpdateEmail(opts: {
  to: string;
  adminName: string | null;
  legislationTitle: string;
  newVersion: string;
  affectedTemplates: string[];
  reviewUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Legislation updated: ${opts.legislationTitle} — ${opts.affectedTemplates.length} template(s) flagged`,
    html: html(`
      <h2 style="margin-top:0;color:#d97706">Legislative change — review required</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p><strong>${opts.legislationTitle}</strong> has been updated to version <strong>${opts.newVersion}</strong>.</p>
      <p>The following document templates reference this legislation and have been flagged for review:</p>
      <ul style="font-size:14px">${opts.affectedTemplates.map((t) => `<li style="padding:2px 0">${t}</li>`).join("")}</ul>
      <p style="margin:32px 0">
        <a href="${opts.reviewUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Review flagged templates →</a>
      </p>
    `),
  });
}

export async function sendQuarterlyRetentionReportEmail(opts: {
  to: string;
  adminName: string | null;
  periodLabel: string;
  anonymised: number;
  dismissed: number;
  pendingRequests: number;
  reviewUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Quarterly data retention report — ${opts.periodLabel}`,
    html: html(`
      <h2 style="margin-top:0">Quarterly data retention report</h2>
      <p>Hi${opts.adminName ? ` ${opts.adminName}` : ""},</p>
      <p>Privacy retention activity for <strong>${opts.periodLabel}</strong> (APP 11, Privacy Act 1988):</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:6px 0;color:#71717a">Records anonymised</td><td style="padding:6px 0;font-weight:600;text-align:right">${opts.anonymised}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a">Flags dismissed (retained)</td><td style="padding:6px 0;font-weight:600;text-align:right">${opts.dismissed}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a">Deletion requests pending</td><td style="padding:6px 0;font-weight:600;text-align:right">${opts.pendingRequests}</td></tr>
      </table>
      <p style="margin:32px 0">
        <a href="${opts.reviewUrl}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open retention dashboard →</a>
      </p>
    `),
  });
}
