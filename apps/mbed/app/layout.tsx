import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MBED — Independent Medical Property & Project Advisory Melbourne",
  description:
    "Independent medical property and project advisory for specialist practices. Site strategy, residential conversion, compliance, and delivery. Melbourne & Victoria.",
  metadataBase: new URL("https://mbed.com.au"),
  alternates: {
    canonical: "https://mbed.com.au",
  },
  openGraph: {
    title: "MBED — Independent Medical Property & Project Advisory",
    description:
      "Embedded. Independent. So the only thing on your mind is your practice.",
    url: "https://mbed.com.au",
    type: "website",
    siteName: "MBED",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable}`}
    >
      <body>
        {children}

        <Script
          id="faq-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Do I need a planning permit to convert a residential property to a medical centre in Melbourne?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Almost always yes — but the pathway depends on the zone. In a General Residential Zone a planning permit is required for a change of use to a Medical Centre. In a Residential Growth Zone a permit-free pathway exists if the gross floor area is under 250 square metres, no car parking permit is required, and the site adjoins a Road Zone. In a Mixed Use Zone the requirements vary by council schedule. MBED confirms the planning pathway as part of every site assessment — before you commit to the property, not after."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What is the single biggest cost surprise in a residential conversion?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "DDA-compliant accessible amenities. Most residential properties have bathrooms that are too small to comply with AS 1428.1 — the standard for accessible toilet design. A compliant accessible toilet requires approximately 2.4 by 2.0 metres minimum. Retrofitting this into an existing residential floor plan often means relocating walls, moving plumbing, and in some cases structural work. MBED assesses this on site inspection — it is the first internal measurement we take on any candidate property, because if it cannot be resolved without major structural intervention the project economics change fundamentally."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How long does a residential conversion take from first conversation to opening day?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Six to twelve months is the realistic range. A straightforward conversion in a permissive zone with no heritage overlay and adequate on-site parking can be delivered in six months — site selection, planning, design, permit, construction, and handover. A heritage building, a complex planning permit, or a multi-disciplinary practice with greater clinical complexity adds time. MBED delivered the Canterbury dental conversion — a heritage-listed building with seven surgeries — in six months. The timeline is a product of how thoroughly the risks are resolved before the project begins."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What is open book construction management and why does it matter?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Open book construction management means the client sees every cost — every trade quote, every invoice, every variation — without markup or bundled contingency. MBED manages the project on your behalf, but you own the financial transparency. You know what each trade costs, you can introduce your own suppliers where it creates value, and you are not paying a fixed-price builder's margin on work you could have procured yourself. On the Canterbury project this approach delivered a 15% saving against comparable fixed-price quotes for the same scope."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I buy a medical property through my self-managed superannuation fund?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes — and it is one of the most effective structures available to specialist practitioners. A commercial property occupied by your own practice is a permitted investment for an SMSF under certain conditions. The compliance obligations are significant: trustee responsibilities, borrowing restrictions under a limited recourse borrowing arrangement, and ATO compliance requirements that apply throughout the life of the investment. MBED coordinated exactly this structure for a North Preston specialist centre — four specialties, cold shell fitout, acquisition and delivery both achieved under market rate. The key is having the financial, legal, and advisory disciplines coordinated from the outset, not assembled mid-transaction."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What is the difference between MBED and a medical fitout contractor?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "A fitout contractor arrives after the property decision is made, the lease is signed, and the brief is written. MBED arrives before any of that — when the options are still open, the risks are still manageable, and the decisions that will shape every subsequent cost are still being formed. MBED is independent, which means the advice is directed entirely at your outcome. A contractor's advice is directed at securing the work. That is not a criticism — it is a structural difference. If the site cannot support your clinical model, MBED will tell you before you commit. A contractor will price the remediation after you have."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Does MBED work on commercial tenancy fitouts as well as residential conversions?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. The North Preston specialist centre was a cold shell commercial tenancy within a mixed-use development — not a residential conversion. The same principles apply: independent advisory from site selection through to handover, open book cost management where appropriate, and a single coordinated engagement that covers strategy, acquisition, financial structure, compliance, design, and delivery. The residential conversion pathway is one of several ways MBED works with specialist practices — it is the most overlooked, which is why it anchors the free guide."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Do heritage overlays make a conversion impossible?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Rarely impossible — but always more complex and potentially more expensive. A heritage overlay requires planning approval for works that affect the heritage fabric, and depending on the statement of significance this can constrain everything from the entrance design to plant and equipment placement. The risk is not that heritage kills the project — it is that heritage costs are discovered after commitment rather than assessed before. MBED conducted a full heritage compliance review on the Canterbury project before exchange, which meant every cost was known and budgeted. The project was delivered without a single heritage-related surprise."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does car parking work for a medical centre in a residential zone?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Car parking is one of the most common triggers for a planning permit and one of the most common reasons a conversion becomes unworkable. Under Victoria's Amendment VC277 (December 2025), the parking requirement is now determined by a PTAL category system — the category assigned to your site on the Car Parking Requirement Maps determines the minimum spaces required. Sites in Category 4 areas have no minimum requirement. Sites within 400 metres of the Principal Public Transport Network attract reduced rates. Where the required number of spaces cannot be met on title, a planning permit and a Car Parking Demand Assessment are required. MBED assesses this as part of every site review."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What does MBED cost and how does the engagement work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "The engagement begins with a fifteen-minute practice growth consultation — no cost, no obligation. MBED then proposes a scope and fee structure calibrated to the specific project. For full advisory engagements covering strategy, acquisition, compliance, and delivery, fees are structured as a fixed engagement fee rather than a percentage of project cost — which means MBED's incentive is the quality of your outcome, not the size of your budget. The first conversation costs nothing. Book one at the link below."
                  }
                }
              ]
            }),
          }}
        />

        {GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA4_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
