import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects — Medical Fitout & Property Advisory Melbourne",
  description:
    "Selected medical property and fitout engagements delivered by MBED across Melbourne — dental practices, specialist centres, and residential conversions.",
  keywords: [
    "medical fitout Melbourne portfolio",
    "medical property advisory projects",
    "specialist centre fitout Melbourne",
  ],
  alternates: { canonical: "https://mbed.com.au/projects" },
  openGraph: {
    url: "https://mbed.com.au/projects",
  },
};

const linked = [
  {
    href: "/projects/dental-fitout-canterbury",
    src: "/images/imgco-11.jpg",
    alt: "Dental fitout Canterbury Melbourne",
    name: "Dentistry in Canterbury",
    suburb: "Canterbury, Melbourne",
    category: "Dental Fitout — Heritage Conversion",
  },
  {
    href: "/projects/specialist-centre-north-preston",
    src: "/images/north-preston-waiting.jpg",
    alt: "Specialist centre North Preston Melbourne",
    name: "North Preston Specialists",
    suburb: "Preston, Melbourne",
    category: "Multi-Disciplinary Specialist Centre",
  },
];

const unlinkable = [
  {
    src: "/images/imgco-17.jpg",
    alt: "Northwest Health Thames Street",
    name: "Northwest Health",
    suburb: "Melbourne, Victoria",
    category: "Thames Street — Project Advisory",
  },
  {
    src: "/images/imgco-07.jpg",
    alt: "Ekera Medical Centre fitout Melbourne",
    name: "Ekera Medical Centre",
    suburb: "Melbourne, Victoria",
    category: "Fitout & Refurbishment",
  },
  {
    src: "/images/imgco-15.jpg",
    alt: "MBED medical project Melbourne",
    name: "MBED Project",
    suburb: "Melbourne, Victoria",
    category: "Medical Fitout",
  },
];

function ProjectCard({
  src,
  alt,
  name,
  suburb,
  category,
}: {
  src: string;
  alt: string;
  name: string;
  suburb: string;
  category: string;
}) {
  return (
    <div className="bg-white group">
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="pt-4 pb-6 px-1">
        <p className="font-dm text-[#00897B] text-[10px] font-semibold uppercase tracking-widest mb-1">
          {category}
        </p>
        <p className="font-cormorant text-charcoal text-xl font-medium">{name}</p>
        <p className="font-dm text-stone text-[12px] mt-0.5">{suburb}</p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <div className="bg-[#FDFCFA] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-dm text-[17px] font-medium tracking-[0.2em] text-charcoal hover:opacity-70 transition-opacity"
          >
            MBED
          </Link>
          <Link
            href="/#contact"
            className="font-dm text-[12px] text-stone hover:text-charcoal transition-colors tracking-wide"
          >
            Contact
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <p className="section-tag text-stone mb-5">Selected projects</p>
        <h1 className="heading-display text-charcoal text-3xl lg:text-4xl mb-14">
          Work
        </h1>

        {/* Linked project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {linked.map((p) => (
            <Link key={p.href} href={p.href} className="block">
              <ProjectCard
                src={p.src}
                alt={p.alt}
                name={p.name}
                suburb={p.suburb}
                category={p.category}
              />
            </Link>
          ))}

          {/* Non-linked cards */}
          {unlinkable.map((p) => (
            <div key={p.name}>
              <ProjectCard
                src={p.src}
                alt={p.alt}
                name={p.name}
                suburb={p.suburb}
                category={p.category}
              />
              <p className="font-dm text-stone/60 text-[11px] mt-1 px-1">
                More coming soon
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-charcoal py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="font-dm text-white text-[17px] font-medium tracking-[0.2em]">
            MBED
          </p>
          <p className="font-dm text-white/30 text-[11px]">
            &copy; 2026 MBED. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
