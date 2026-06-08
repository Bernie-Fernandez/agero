/**
 * DRAFT PRIVACY POLICY — NOT YET EFFECTIVE
 * This page is flagged for legal review before publication.
 * Review required by: Bernie Fernandez (bfernandez@agero.com.au)
 * Items marked [TBC] require confirmation before publishing.
 */

import Link from "next/link";

const DRAFT = true;

export const metadata = {
  title: "Privacy Policy — Agero Safety",
  robots: DRAFT ? "noindex, nofollow" : "index, follow",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Agero Safety
          </Link>
          <span className="text-xs text-zinc-500">Privacy Policy</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {DRAFT && (
          <div className="mb-8 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 dark:border-amber-600 dark:bg-amber-950/30">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              DRAFT — FOR LEGAL REVIEW ONLY. NOT YET EFFECTIVE.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              This document has been prepared as a draft and must be reviewed by qualified legal counsel before
              publication. Items marked <strong>[TBC]</strong> require confirmation. This page is marked{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                noindex
              </code>{" "}
              and will not appear in search engines until published.
            </p>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
              Review contact: Bernie Fernandez — bfernandez@agero.com.au
            </p>
          </div>
        )}

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">
          <strong>Agero Group Pty Ltd</strong> (ABN <strong>[TBC]</strong>) ·{" "}
          <em>Last updated: [DRAFT — date TBC]</em>
        </p>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Agero Group Pty Ltd (<strong>&quot;Agero&quot;</strong>, <strong>&quot;we&quot;</strong>,{" "}
          <strong>&quot;us&quot;</strong>, <strong>&quot;our&quot;</strong>) operates the Agero Safety
          platform (<strong>&quot;Platform&quot;</strong>) at safety.agero.com.au. We are committed to
          protecting the privacy of workers, subcontractors, and all other individuals whose personal
          information is handled through the Platform.
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          This Privacy Policy is governed by the <em>Privacy Act 1988</em> (Cth) and the Australian
          Privacy Principles (APPs) contained in Schedule 1 of that Act. It also reflects obligations
          under the <em>Occupational Health and Safety Act 2004</em> (Vic) and the{" "}
          <em>Occupational Health and Safety Regulations 2017</em> (Vic) that require us to collect and
          retain certain information about workers on our project sites.
        </p>

        {/* Table of contents */}
        <nav className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Contents</p>
          <ol className="space-y-1.5 text-sm">
            {[
              ["#app1", "APP 1 — Open and transparent management"],
              ["#app2", "APP 2 — Anonymity and pseudonymity"],
              ["#app3", "APP 3 — Collection of personal information"],
              ["#app4", "APP 4 — Unsolicited personal information"],
              ["#app5", "APP 5 — Notification of collection"],
              ["#app6", "APP 6 — Use or disclosure"],
              ["#app7", "APP 7 — Direct marketing"],
              ["#app8", "APP 8 — Cross-border disclosure"],
              ["#app9", "APP 9 — Government-related identifiers"],
              ["#app10", "APP 10 — Quality of information"],
              ["#app11", "APP 11 — Security"],
              ["#app12", "APP 12 — Access"],
              ["#app13", "APP 13 — Correction"],
              ["#contact", "Contact us"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-blue-600 hover:underline dark:text-blue-400">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          <Section id="app1" title="APP 1 — Open and transparent management of personal information">
            <p>
              Agero manages personal information in an open and transparent way. This Privacy Policy
              describes the types of personal information we collect, how we collect it, the purposes
              for which it is held and used, and how individuals can access or correct their information.
            </p>
            <p>
              This policy is available at <strong>safety.agero.com.au/privacy</strong> and is provided
              to workers at the point of first registration. We will update this policy when our
              practices change and will notify affected individuals where practicable.
            </p>
            <p>
              Our Privacy Officer can be contacted at{" "}
              <a href="mailto:privacy@agero.com.au" className="text-blue-600 hover:underline dark:text-blue-400">
                privacy@agero.com.au
              </a>
              .
            </p>
          </Section>

          <Section id="app2" title="APP 2 — Anonymity and pseudonymity">
            <p>
              We recognise the right of individuals to interact anonymously or by pseudonym where
              lawful and practicable. However, due to obligations under occupational health and safety
              legislation — specifically the requirement to verify worker identity, licences, and
              emergency contact details before authorising site access — it is not practicable for
              workers to interact with this Platform anonymously or by pseudonym.
            </p>
            <p>
              Subcontractor company administrators who access the Platform for administrative purposes
              only (and do not register as site workers) are subject to a reduced collection scope.
            </p>
          </Section>

          <Section id="app3" title="APP 3 — Collection of solicited personal information">
            <p>
              We only collect personal information that is reasonably necessary for one or more of our
              functions or activities. The information we collect from workers and subcontractors
              includes:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Identity information:</strong> legal name, date of birth, mobile number,
                residential address.
              </li>
              <li>
                <strong>Identity documents:</strong> driver licence number and expiry, passport
                details, government-issued photo ID — collected to verify identity in accordance with
                OHS Regs 2017 r.39–r.42.
              </li>
              <li>
                <strong>Work credentials and licences:</strong> white card (General Construction
                Induction), high risk work licences (scaffolding, crane, forklift, EWP, dogging,
                rigging, confined space, explosive-powered tools), trade licences, first aid
                certificates, asbestos awareness certificates, and other training certificates.
                Collected under <em>OHS Regs 2017</em> s.39 and s.140.
              </li>
              <li>
                <strong>Emergency contact (next of kin):</strong> name, relationship, and mobile
                number. Collected under <em>OHS Act 2004</em> s.26 (duty to provide safe systems of
                work including emergency procedures).
              </li>
              <li>
                <strong>Health and medical information:</strong> self-disclosed medical conditions
                relevant to safe site access. This is sensitive information under the Privacy Act.
                Disclosure is voluntary, however non-disclosure may affect our ability to manage
                emergency situations appropriately.
              </li>
              <li>
                <strong>Site attendance records:</strong> date and time of site sign-in and sign-out,
                project name, and optional photo taken at sign-in.
              </li>
              <li>
                <strong>SWMS acknowledgement records:</strong> signature/acknowledgement of Safe Work
                Method Statements relevant to work performed.
              </li>
            </ul>
            <p>
              We collect personal information directly from individuals wherever practicable. Some
              information (such as employer name and company trade categories) may be collected from
              the employing subcontractor organisation.
            </p>
            <p>
              Photographs taken at sign-in are used for identity verification by site supervisors.
              Credential document photographs (e.g., licence scans) are processed by an AI system
              (Anthropic Claude) to extract document details such as credential number and expiry
              date. See APP 8 for cross-border processing details.
            </p>
          </Section>

          <Section id="app4" title="APP 4 — Dealing with unsolicited personal information">
            <p>
              If we receive personal information about an individual that we did not solicit, we will
              determine within a reasonable time whether we could have collected that information under
              APP 3. If we could have collected it, we will handle it as though we had solicited it. If
              we could not have collected it, we will destroy or de-identify the information as soon as
              practicable, provided it is lawful and reasonable to do so.
            </p>
          </Section>

          <Section id="app5" title="APP 5 — Notification of collection of personal information">
            <p>
              Workers are notified of the collection of their personal information at the point of
              first registration (via the privacy notice screen on the site sign-in page) and through
              this Privacy Policy. Specifically, we notify workers of:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Our identity and contact details:</strong> Agero Group Pty Ltd,
                privacy@agero.com.au.
              </li>
              <li>
                <strong>The purpose of collection:</strong> OHS compliance, site access management,
                workforce readiness verification, emergency contact management, and compliance
                auditing.
              </li>
              <li>
                <strong>The organisations or types of organisations to whom we disclose the
                information:</strong> project-specific site managers (employed by or contracted to
                Agero), the relevant subcontractor administrator for the worker&apos;s employing
                company, and regulatory bodies if required by law.
              </li>
              <li>
                <strong>Whether collection is required by law:</strong> yes — collection of worker
                identity, white card, and relevant licence details is required under the{" "}
                <em>OHS Regs 2017</em> (Vic).
              </li>
              <li>
                <strong>Consequences of not providing information:</strong> workers who do not provide
                the required information may be unable to access Agero project sites.
              </li>
            </ul>
          </Section>

          <Section id="app6" title="APP 6 — Use or disclosure of personal information">
            <p>
              We use personal information for the primary purpose for which it was collected (OHS
              compliance and site access management) and for related secondary purposes that a
              reasonable person would expect, including:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>Emergency response and next-of-kin notification</li>
              <li>Verification of worker eligibility to perform high-risk work on site</li>
              <li>Compliance auditing and reporting to Agero&apos;s internal safety management team</li>
              <li>Notifying workers of upcoming credential expiry</li>
              <li>
                Providing subcontractor administrators with workforce compliance status for their own
                employees (limited to compliance status — personal details such as date of birth,
                residential address, and medical conditions are not visible to subcontractor
                administrators)
              </li>
            </ul>
            <p>
              We do not sell, rent, or trade personal information to third parties. We do not disclose
              personal information for purposes unrelated to OHS compliance or site management without
              the individual&apos;s consent, except where required by law.
            </p>
            <p>
              <strong>[TBC — Legal review required]:</strong> Confirm whether disclosure to principal
              contractors or building owners is a primary or secondary purpose, and whether specific
              consent is required.
            </p>
          </Section>

          <Section id="app7" title="APP 7 — Direct marketing">
            <p>
              We do not use personal information collected through the Platform for direct marketing
              purposes. SMS messages sent through the Platform are limited to OTP verification codes
              and safety-related notifications (such as credential expiry alerts). Workers may opt out
              of non-essential notifications by contacting privacy@agero.com.au.
            </p>
          </Section>

          <Section id="app8" title="APP 8 — Cross-border disclosure of personal information">
            <p>
              Personal information is stored in Australia. Our primary database is hosted on Supabase
              (AWS ap-southeast-2, Sydney, Australia).
            </p>
            <p>
              Credential document photographs may be processed by{" "}
              <strong>Anthropic, PBC</strong> (San Francisco, California, USA) via the Claude API to
              extract credential details (number, expiry date, issuing body). Anthropic processes this
              data as a data processor on our behalf. Document images are not retained by Anthropic
              beyond the duration of each individual API request.
            </p>
            <p>
              SMS verification codes are delivered via <strong>Twilio Inc</strong> (San Francisco,
              California, USA). Only the recipient&apos;s mobile number and the verification code are
              transmitted; no other personal information is shared.
            </p>
            <p>
              Before disclosing personal information to overseas recipients, Agero takes reasonable
              steps to ensure the recipient complies with the APPs or is otherwise bound by enforceable
              privacy obligations substantially similar to the APPs. Where such steps are taken, Agero
              remains accountable for any breach of the APPs by the overseas recipient under APP 8.1.
            </p>
            <p>
              <strong>[TBC — Legal review required]:</strong> Confirm whether Anthropic&apos;s and
              Twilio&apos;s data processing agreements satisfy APP 8 requirements, and whether
              workers&apos; consent to cross-border AI processing should be obtained explicitly at
              registration.
            </p>
          </Section>

          <Section id="app9" title="APP 9 — Adoption, use or disclosure of government-related identifiers">
            <p>
              We collect government-related identifiers including driver licence numbers, passport
              numbers, and licence numbers issued by state and territory licensing bodies (e.g., HRWL
              numbers issued by WorkSafe Victoria).
            </p>
            <p>
              We do not adopt these identifiers as our own identifier for the individual, nor do we
              disclose them to other organisations for the purpose of identifying the individual except
              as required by law or for the direct purpose of verifying the credential with the issuing
              authority.
            </p>
          </Section>

          <Section id="app10" title="APP 10 — Quality of personal information">
            <p>
              We take reasonable steps to ensure that the personal information we hold is accurate,
              up-to-date, and complete, having regard to the purpose for which it is used.
            </p>
            <p>
              Workers are encouraged to keep their profile information current, including contact
              details and credentials. The Platform provides automated alerts when credentials are
              approaching expiry (default: 30 days prior). Workers can update their own information at
              any time via the worker profile page.
            </p>
          </Section>

          <Section id="app11" title="APP 11 — Security of personal information">
            <p>
              We take reasonable steps to protect the personal information we hold from misuse,
              interference, loss, unauthorised access, modification, or disclosure. Our security
              measures include:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Encryption in transit:</strong> all data is transmitted over HTTPS/TLS.
              </li>
              <li>
                <strong>Encryption at rest:</strong> database and file storage are encrypted at rest
                using industry-standard AES-256 encryption (provided by Supabase / AWS).
              </li>
              <li>
                <strong>Access controls:</strong> role-based access control (RBAC) ensures that
                individuals can only access data relevant to their role. Subcontractor administrators
                can only view compliance status for workers they employ. Workers can only access their
                own data.
              </li>
              <li>
                <strong>Authentication:</strong> worker access is protected by SMS-based
                one-time-password (OTP) verification. Administrator access is protected by
                multi-factor authentication via Clerk.
              </li>
              <li>
                <strong>Audit logging:</strong> administrative actions affecting personal information
                are logged with timestamps and user identity.
              </li>
            </ul>
            <p>
              When we no longer need personal information for any purpose for which it may be used or
              disclosed, and we are not required by law to retain it, we will take reasonable steps to
              destroy or de-identify it. See our retention policy: [TBC — confirm retention periods,
              particularly for site attendance records and credential documents, in light of OHS Regs
              2017 record-keeping requirements].
            </p>
          </Section>

          <Section id="app12" title="APP 12 — Access to personal information">
            <p>
              Individuals have the right to access the personal information we hold about them.
              Workers can access and review their own information directly through the worker profile
              page at any time.
            </p>
            <p>
              To request a full export of your personal information, or to request access to
              information that is not available through the self-service profile page, please contact
              us at{" "}
              <a href="mailto:privacy@agero.com.au" className="text-blue-600 hover:underline dark:text-blue-400">
                privacy@agero.com.au
              </a>
              . We will respond within 30 days.
            </p>
            <p>
              We may refuse access in circumstances permitted by the Privacy Act, including where
              providing access would pose a serious threat to the life, health, or safety of an
              individual or to public health or safety. If we refuse access, we will give reasons in
              writing.
            </p>
          </Section>

          <Section id="app13" title="APP 13 — Correction of personal information">
            <p>
              If you believe that personal information we hold about you is inaccurate, out-of-date,
              incomplete, irrelevant, or misleading, you have the right to request correction.
            </p>
            <p>
              Workers can correct most of their own information directly through the worker profile
              page. For information that cannot be self-corrected, or if you believe a correction has
              been incorrectly refused, please contact us at{" "}
              <a href="mailto:privacy@agero.com.au" className="text-blue-600 hover:underline dark:text-blue-400">
                privacy@agero.com.au
              </a>
              .
            </p>
            <p>
              We will respond to correction requests within 30 days. If we decline to make the
              correction, we will provide written reasons and information about how to lodge a
              complaint.
            </p>
          </Section>

          <Section id="contact" title="Contact us and complaints">
            <p>
              If you have a question about this Privacy Policy, wish to make a privacy complaint, or
              want to exercise any of your rights under the Privacy Act, please contact our Privacy
              Officer:
            </p>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Agero Group Pty Ltd</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Privacy Officer<br />
                [TBC — Street Address]<br />
                [TBC — Suburb, VIC, Postcode]<br />
                <a href="mailto:privacy@agero.com.au" className="text-blue-600 hover:underline dark:text-blue-400">
                  privacy@agero.com.au
                </a>
              </p>
            </div>
            <p className="mt-4">
              We will acknowledge your complaint within 5 business days and aim to resolve it within
              30 days. If you are not satisfied with our response, you may complain to the Office of
              the Australian Information Commissioner (OAIC) at{" "}
              <a
                href="https://www.oaic.gov.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                www.oaic.gov.au
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Agero Group Pty Ltd. ABN [TBC].
            {DRAFT && (
              <span className="ml-2 font-semibold text-amber-600 dark:text-amber-500">
                DRAFT — NOT YET EFFECTIVE
              </span>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
