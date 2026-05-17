import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | MBED",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20 font-dm text-charcoal">
      <h1 className="heading-display text-3xl mb-8">Privacy Policy</h1>

      <section className="space-y-6 text-[15px] leading-relaxed text-charcoal/80">
        <div>
          <h2 className="font-medium text-charcoal mb-2">What data we collect</h2>
          <p>
            When you submit the guide request form or contact form on this site, we collect
            your first name, last name, email address, and practice type. This information
            is provided voluntarily by you.
          </p>
        </div>

        <div>
          <h2 className="font-medium text-charcoal mb-2">How it is used</h2>
          <p>
            Your details are used to send you the Specialist&apos;s Guide to Residential
            Conversion, to follow up on any enquiry you have submitted, and to send
            relevant MBED updates where you have indicated interest. We do not use your
            information for any other purpose.
          </p>
        </div>

        <div>
          <h2 className="font-medium text-charcoal mb-2">How to unsubscribe</h2>
          <p>
            To stop receiving communications from MBED, email{" "}
            <a
              href="mailto:hello@mbed.com.au?subject=unsubscribe"
              className="text-charcoal underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              hello@mbed.com.au
            </a>{" "}
            with the subject line <strong>unsubscribe</strong>. We will remove your
            details promptly.
          </p>
        </div>

        <div>
          <h2 className="font-medium text-charcoal mb-2">Your data is not sold or shared</h2>
          <p>
            We do not sell, rent, or share your personal information with third parties.
            Your data is held securely and used solely for the purposes described above.
          </p>
        </div>

        <div>
          <h2 className="font-medium text-charcoal mb-2">Contact</h2>
          <p>
            For any privacy-related questions, contact us at{" "}
            <a
              href="mailto:hello@mbed.com.au"
              className="text-charcoal underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              hello@mbed.com.au
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
