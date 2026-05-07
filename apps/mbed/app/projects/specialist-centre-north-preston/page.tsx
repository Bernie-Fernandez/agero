import type { Metadata } from "next";
import ProjectPage from "@/components/ProjectPage";

export const metadata: Metadata = {
  title: "Specialist Centre North Preston — Multi-Disciplinary Fitout",
  description:
    "MBED acquired and delivered a multi-disciplinary specialist centre in Preston — gynaecology, obstetrics, colorectal surgery, and psychology — structured through an SMSF.",
  keywords: [
    "specialist rooms Preston Melbourne",
    "gynaecology consulting rooms Melbourne",
    "specialist centre fitout Melbourne",
    "SMSF medical property acquisition",
    "obstetrics rooms Melbourne fitout",
  ],
  alternates: {
    canonical:
      "https://mbed.com.au/projects/specialist-centre-north-preston",
  },
  openGraph: {
    title: "North Preston Specialists — Multi-Disciplinary Centre",
    description:
      "Gynaecology, obstetrics, colorectal surgery, and psychology under one roof. Acquired through an SMSF, delivered under budget.",
    url: "https://mbed.com.au/projects/specialist-centre-north-preston",
    images: [
      {
        url: "/images/north-preston-waiting.jpg",
        width: 1200,
        height: 630,
        alt: "Specialist centre waiting area North Preston Melbourne",
      },
    ],
  },
};

const projectSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "North Preston Specialists — Multi-Disciplinary Specialist Centre",
  description:
    "MBED acquired and delivered a multi-disciplinary specialist centre in Preston — gynaecology, obstetrics, colorectal surgery, and psychology — structured through a self-managed superannuation fund.",
  author: { "@type": "Organization", name: "MBED" },
  publisher: {
    "@type": "Organization",
    name: "MBED",
    url: "https://mbed.com.au",
  },
  image: "https://mbed.com.au/images/north-preston-waiting.jpg",
  url: "https://mbed.com.au/projects/specialist-centre-north-preston",
};

const HUBSPOT_URL =
  process.env.NEXT_PUBLIC_HUBSPOT_MEETING_URL ??
  "https://meetings-ap1.hubspot.com/bernard-fernandez";

export default function NorthPrestonPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }}
      />
      <ProjectPage
        title="North Preston Specialists"
        suburb="Preston, Melbourne"
        category="Multi-Disciplinary Specialist Centre"
        heroImage="/images/north-preston-waiting.jpg"
        heroAlt="Specialist consulting centre waiting area Preston Melbourne"
        summary="A commercial tenancy within a mixed-use development in Preston — acquired by MBED's financial team at a competitive rate and structured through a self-managed superannuation fund. Delivered as a cold shell fitout for a four-specialty practice: gynaecology, obstetrics, colorectal and general surgery, and psychology. The brief was warmth, light, and a space that felt nothing like a medical centre. The result proved it."
        stats={[
          { label: "Location", value: "Preston, Melbourne" },
          { label: "Delivery model", value: "Head contractor — MBED managed" },
          {
            label: "Specialties",
            value: "Gynaecology, obstetrics, colorectal surgery, psychology",
          },
          {
            label: "Acquisition structure",
            value: "Self-managed superannuation fund (SMSF)",
          },
          {
            label: "Rooms",
            value:
              "3 consulting rooms, treatment room, sterilisation, reception, amenities",
          },
          {
            label: "Cost outcome",
            value: "Acquisition and fitout — both under market rate",
          },
        ]}
        images={[
          {
            src: "/images/north-preston-waiting.jpg",
            alt: "Specialist centre waiting area Preston Melbourne warm design",
          },
          {
            src: "/images/north-preston-detail.jpg",
            alt: "Specialist consulting rooms Preston Melbourne interior detail",
          },
          {
            src: "/images/north-preston-reception-01.jpg",
            alt: "North Preston Specialists reception Melbourne",
          },
          {
            src: "/images/north-preston-reception-02.jpg",
            alt: "Gynaecology obstetrics consulting rooms Preston Melbourne",
          },
          {
            src: "/images/north-preston-reception-03.jpg",
            alt: "Specialist medical centre fitout Preston Victoria",
          },
        ]}
        quote={`"Every time I walk through the door I feel proud. The space uses the light and the outlook in a way I did not think was possible at this scale. My patients feel it too — they tell me. This practice changed my business and my family's future."`}
        quoteAuthor="Principal Specialist, North Preston Specialists"
        ctaHref={HUBSPOT_URL}
      />
    </>
  );
}
