import Image from "next/image";
import Link from "next/link";

interface ProjectPageProps {
  title: string;
  suburb: string;
  category: string;
  heroImage: string;
  heroAlt: string;
  summary: string;
  stats: { label: string; value: string }[];
  images: { src: string; alt: string }[];
  quote: string;
  quoteAuthor: string;
  ctaHref: string;
}

export default function ProjectPage({
  title,
  suburb,
  category,
  heroImage,
  heroAlt,
  summary,
  stats,
  images,
  quote,
  quoteAuthor,
  ctaHref,
}: ProjectPageProps) {
  return (
    <div className="bg-white min-h-screen">
      {/* Minimal site header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b border-gray-100 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-dm text-[17px] font-medium tracking-[0.2em] text-charcoal hover:opacity-70 transition-opacity"
          >
            MBED
          </Link>
          <Link
            href="/projects"
            className="font-dm text-[12px] text-stone hover:text-charcoal transition-colors tracking-wide"
          >
            ← All projects
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative w-full" style={{ minHeight: "480px", paddingTop: "56px" }}>
        <div className="relative w-full" style={{ minHeight: "480px" }}>
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 lg:p-12">
            <p className="font-dm text-white/70 text-sm uppercase tracking-widest mb-2">
              {suburb} &nbsp;·&nbsp; {category}
            </p>
            <h1 className="font-cormorant text-white font-bold text-3xl md:text-5xl leading-tight">
              {title}
            </h1>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 py-5">
        <ol className="flex items-center gap-2 font-dm text-[12px] text-stone">
          <li>
            <Link href="/projects" className="hover:text-charcoal transition-colors">
              Work
            </Link>
          </li>
          <li className="text-stone/50">/</li>
          <li className="text-charcoal">{title}</li>
        </ol>
      </nav>

      {/* Summary */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-12">
        <p
          className="font-dm text-gray-700 text-lg leading-relaxed"
          style={{ maxWidth: "680px" }}
        >
          {summary}
        </p>
      </section>

      {/* Stats panel */}
      <section className="bg-[#F5F5F0] py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-200">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#F5F5F0] p-6">
                <p className="font-dm text-[#00897B] text-xs font-semibold uppercase tracking-widest">
                  {stat.label}
                </p>
                <p className="font-dm text-gray-900 font-bold text-xl mt-1">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {images.map((img) => (
            <div
              key={img.src}
              className="relative overflow-hidden rounded-sm"
              style={{ aspectRatio: "4/3" }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10 pb-16">
        <blockquote
          className="border-l-4 border-[#00897B] pl-6"
          style={{ maxWidth: "720px" }}
        >
          <p className="font-cormorant text-gray-900 text-xl italic leading-relaxed">
            {quote}
          </p>
          <footer className="font-dm text-stone text-[13px] mt-4">
            — {quoteAuthor}
          </footer>
        </blockquote>
      </section>

      {/* CTA */}
      <section className="bg-[#111111] py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <p className="font-cormorant text-white text-3xl mb-3 italic">
            Ready to start?
          </p>
          <p className="font-dm text-white/60 text-[14px] mb-8">
            Book a no-obligation consultation with MBED.
          </p>
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-dm text-[13px] tracking-wide px-8 py-3.5 border border-[#00897B] text-[#00897B] hover:bg-[#00897B] hover:text-white transition-colors duration-200"
          >
            Book a consultation
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal py-8">
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
