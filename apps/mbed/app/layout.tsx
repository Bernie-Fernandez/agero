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
