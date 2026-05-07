import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "MBED — Independent Medical Property & Project Advisory Melbourne",
  description:
    "Independent medical property and project advisory for specialist practices in Melbourne. Residential conversion, planning compliance, construction management. Embedded from day one.",
  keywords: [
    "medical property advisory Melbourne",
    "residential conversion medical centre",
    "specialist rooms fitout Melbourne",
    "medical centre planning permit Victoria",
    "independent medical advisory",
  ],
  alternates: {
    canonical: "https://mbed.com.au",
  },
  openGraph: {
    title:
      "MBED — Embedded. Independent. So the only thing on your mind is your practice.",
    description:
      "Independent advisory for specialist practices. Site strategy, residential conversion, compliance, and delivery.",
    url: "https://mbed.com.au",
    images: [
      {
        url: "/images/imgco-11.jpg",
        width: 1200,
        height: 630,
        alt: "MBED medical practice fitout Melbourne",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  name: "MBED",
  description:
    "Independent medical property and project advisory for specialist practices.",
  url: "https://mbed.com.au",
  email: "hello@mbed.com.au",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Melbourne",
    addressRegion: "VIC",
    addressCountry: "AU",
  },
  areaServed: { "@type": "State", name: "Victoria" },
  serviceType: [
    "Medical Property Advisory",
    "Residential Conversion Advisory",
    "Construction Management",
    "Planning Compliance",
  ],
  priceRange: "$$$$",
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeClient />
    </>
  );
}
