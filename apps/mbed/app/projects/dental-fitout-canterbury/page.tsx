import type { Metadata } from "next";
import ProjectPage from "@/components/ProjectPage";

export const metadata: Metadata = {
  title: "Dental Fitout Canterbury — Heritage Conversion",
  description:
    "MBED delivered a 7-surgery dental fitout in a heritage-listed Canterbury building — open book construction management, completed in 6 months, 15% under market rate.",
  keywords: [
    "dental fitout Canterbury Melbourne",
    "heritage building medical fitout",
    "dental practice conversion Melbourne",
    "open book construction management medical",
  ],
  alternates: {
    canonical: "https://mbed.com.au/projects/dental-fitout-canterbury",
  },
  openGraph: {
    title: "Dentistry in Canterbury — Heritage Conversion",
    description:
      "From 2 surgeries to 7. A heritage-listed Canterbury building delivered in 6 months.",
    url: "https://mbed.com.au/projects/dental-fitout-canterbury",
    images: [
      {
        url: "/images/imgco-11.jpg",
        width: 1200,
        height: 630,
        alt: "Dental fitout Canterbury Melbourne heritage building",
      },
    ],
  },
};

const projectSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Dentistry in Canterbury — Heritage Building Conversion",
  description:
    "MBED delivered a 7-surgery dental fitout in a 150-year-old heritage-listed building in Canterbury, Melbourne.",
  author: { "@type": "Organization", name: "MBED" },
  publisher: {
    "@type": "Organization",
    name: "MBED",
    url: "https://mbed.com.au",
  },
  image: "https://mbed.com.au/images/imgco-11.jpg",
  url: "https://mbed.com.au/projects/dental-fitout-canterbury",
};

const HUBSPOT_URL =
  process.env.NEXT_PUBLIC_HUBSPOT_MEETING_URL ??
  "https://meetings-ap1.hubspot.com/bernard-fernandez";

export default function CanterburyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }}
      />
      <ProjectPage
        title="Dentistry in Canterbury"
        suburb="Canterbury, Melbourne"
        category="Dental Fitout — Heritage Conversion"
        heroImage="/images/imgco-11.jpg"
        heroAlt="Dental practice fitout Canterbury Melbourne heritage building interior"
        summary="A 150-year-old heritage-listed building at the heart of Canterbury village — one of Melbourne's most architecturally significant inner suburbs. MBED managed the full engagement: heritage compliance, planning permit, construction management on an open book basis, and delivery of a 7-surgery dental practice in six months. The client moved from 2 surgeries to 7. The fitout came in 15% below comparable fixed-price quotes."
        stats={[
          { label: "Location", value: "Canterbury, Melbourne" },
          { label: "Delivery model", value: "Construction management — open book" },
          { label: "Timeline", value: "6 months — site selection to opening day" },
          { label: "Cost outcome", value: "15% below comparable fixed-price quotes" },
          { label: "Heritage", value: "150-year-old listed building" },
          {
            label: "Rooms delivered",
            value: "7 surgeries, 2 hygiene, X-ray, sterilisation, DDA amenities",
          },
        ]}
        images={[
          {
            src: "/images/imgco-11.jpg",
            alt: "Dental consulting room fitout Canterbury Melbourne",
          },
          {
            src: "/images/imgco-16.jpg",
            alt: "Heritage building interior dental practice Melbourne",
          },
          {
            src: "/images/imgco-17.jpg",
            alt: "Dental surgery room fitout Canterbury Victoria",
          },
          {
            src: "/images/imgco-07.jpg",
            alt: "Reception and waiting area dental practice Canterbury",
          },
          {
            src: "/images/imgco-15.jpg",
            alt: "Sterilisation lab dental fitout Melbourne",
          },
        ]}
        quote='"MBED expertly delivered every aspect of the project. The design outcome, the methodology, and the result exceeded what I thought was possible on this site. Moving from two surgeries to seven changed the trajectory of the business entirely."'
        quoteAuthor="Principal Dentist, Dentistry in Canterbury"
        ctaHref={HUBSPOT_URL}
      />
    </>
  );
}
