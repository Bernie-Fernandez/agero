"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HUBSPOT_URL = process.env.NEXT_PUBLIC_HUBSPOT_MEETING_URL ?? "https://meetings-ap1.hubspot.com/bernard-fernandez";

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const textColor = scrolled ? "text-charcoal" : "text-white";
  const bgStyle = scrolled
    ? "bg-[#FDFCFA] border-b border-[#E8E5E0]"
    : "bg-transparent";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bgStyle}`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <a
          href="/"
          className={`font-dm text-[17px] font-medium tracking-[0.2em] transition-colors duration-300 ${textColor}`}
        >
          MBED
        </a>

        {/* Centre links */}
        <div className={`hidden lg:flex items-center gap-8 text-[13px] font-dm font-400 tracking-wide transition-colors duration-300 ${textColor}`}>
          <a href="#difference" className="hover:opacity-70 transition-opacity">The Difference</a>
          <a href="#services" className="hover:opacity-70 transition-opacity">Services</a>
          <a href="#portfolio" className="hover:opacity-70 transition-opacity">Projects</a>
          <a href="#serve" className="hover:opacity-70 transition-opacity">Who We Serve</a>
          <a href="#contact" className="hover:opacity-70 transition-opacity">Contact</a>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-4">
          <a
            href="#guide"
            className={`hidden sm:inline-block font-dm text-[13px] tracking-wide border transition-colors duration-300 px-4 py-2 ${
              scrolled
                ? "border-charcoal text-charcoal hover:bg-charcoal hover:text-white"
                : "border-white text-white hover:bg-white hover:text-charcoal"
            }`}
          >
            Free Guide
          </a>
          <a
            href={HUBSPOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm text-[13px] tracking-wide bg-stone text-white px-4 py-2 hover:bg-dusk transition-colors duration-200"
          >
            Book a Meeting
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ height: "100vh", minHeight: "680px" }}
    >
      {/* Background image with zoom animation */}
      <div className="absolute inset-0 hero-bg">
        <Image
          src="/images/imgco-11.jpg"
          alt="MBED medical practice"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(20,18,16,0.90) 0%, rgba(20,18,16,0.22) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-6 lg:px-10 max-w-4xl mx-auto">
        <p className="section-tag text-white/70 mb-6">
          Independent medical property &amp; project advisory — Melbourne &amp; Victoria
        </p>
        <h1
          className="heading-display text-white text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6"
          style={{ fontStyle: "normal" }}
        >
          Embedded. Independent. So the only thing on your mind is your practice.
        </h1>
        <p className="font-dm text-white/80 text-base lg:text-lg leading-relaxed mb-6 max-w-2xl">
          You have built something exceptional. MBED exists to make sure the property and project decisions that surround your practice are worthy of it — from the first strategic conversation through to the day you open the doors.
        </p>

        {/* Proof point stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 mb-8 max-w-3xl">
          <div className="flex flex-col justify-center border-l-2 border-[#00897B] pl-4">
            <span className="font-bold text-white text-2xl md:text-3xl">6 months</span>
            <span className="text-white/60 text-xs uppercase tracking-widest mt-1">From site selection to opening day</span>
            <span className="text-white/40 text-xs mt-0.5 hidden md:block">Canterbury Dental — heritage conversion</span>
          </div>
          <div className="flex flex-col justify-center border-l-2 border-[#00897B] pl-4">
            <span className="font-bold text-white text-2xl md:text-3xl">15% under market rate</span>
            <span className="text-white/60 text-xs uppercase tracking-widest mt-1">Open book construction management</span>
            <span className="text-white/40 text-xs mt-0.5 hidden md:block">Verified against fixed-price comparable quotes</span>
          </div>
          <div className="flex flex-col justify-center border-l-2 border-[#00897B] pl-4">
            <span className="font-bold text-white text-2xl md:text-3xl">7 surgeries from 2</span>
            <span className="text-white/60 text-xs uppercase tracking-widest mt-1">Practice capacity more than tripled</span>
            <span className="text-white/40 text-xs mt-0.5 hidden md:block">Without disruption to the existing practice</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="#guide"
            className="font-dm text-[13px] tracking-wide bg-stone text-white px-6 py-3.5 text-center hover:bg-dusk transition-colors duration-200"
          >
            Download the Free Specialist Guide to Residential Conversion
          </a>
          <a
            href={HUBSPOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm text-[13px] tracking-wide text-white/80 underline underline-offset-4 flex items-center justify-center sm:justify-start hover:text-white transition-colors duration-200"
          >
            Or book a 15-minute practice growth consultation
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Credential Strip ────────────────────────────────────────────────────────

function CredentialStrip() {
  const items = [
    "Dentistry in Canterbury",
    "North Preston Specialists",
    "Northwest Health — Thames Street",
    "Ekera Medical Centre",
  ];

  return (
    <div className="bg-charcoal py-4 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center gap-0 whitespace-nowrap">
          <span className="font-dm text-white/50 text-[11px] tracking-[0.12em] uppercase mr-6 shrink-0">
            Selected medical engagements
          </span>
          {items.map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              {i > 0 && (
                <div className="w-px h-3.5 bg-white/20 mx-5" />
              )}
              <span className="font-dm text-white/70 text-[12px] tracking-wide">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── The Difference ──────────────────────────────────────────────────────────

function DifferenceSection() {
  const pillars = [
    { num: "01", title: "Genuinely independent advice" },
    { num: "02", title: "Strategy before anything is committed" },
    { num: "03", title: "Expert resources seamlessly coordinated" },
  ];

  return (
    <section id="difference" className="bg-linen py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left */}
          <div>
            <p className="section-tag text-stone mb-5">The Difference</p>
            <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-8">
              Embedded from the start. Independent throughout.
            </h2>
            <div className="space-y-5 font-dm text-charcoal/75 text-[15px] leading-relaxed">
              <p>
                MBED is a single, trusted partner embedded in your property and project decisions from the very beginning — present when decisions are forming, not arriving after the brief is written and the budget is set.
              </p>
              <p>
                The independence is the product. Our advice is grounded in deep industry knowledge and directed entirely at your outcome. No agenda other than yours.
              </p>
              <p>
                We exist to protect your vision, your capital, and your life&apos;s work. That is the only thing we are here to do.
              </p>
            </div>
          </div>

          {/* Right — pillars */}
          <div className="flex flex-col justify-center space-y-6">
            {pillars.map((p) => (
              <div key={p.num} className="border-t border-charcoal/15 pt-6">
                <div className="flex gap-5 items-start">
                  <span className="font-dm text-stone text-[12px] tracking-[0.1em] mt-1 shrink-0">
                    {p.num}
                  </span>
                  <span className="heading-display text-charcoal text-xl lg:text-2xl">
                    {p.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── What MBED Eliminates ────────────────────────────────────────────────────

function EliminatesSection() {
  const cards = [
    { num: "01", text: "Committing to a site that cannot support your clinical model." },
    { num: "02", text: "Overpaying because you did not know what to ask or what to challenge." },
    { num: "03", text: "A project that consumes the time and attention your patients deserve." },
    { num: "04", text: "Budget overruns that threaten the financial foundation of your practice." },
    { num: "05", text: "Compliance failures that delay your opening or force costly remediation." },
    { num: "06", text: "A finished space that falls short of the clinical vision you started with." },
  ];

  return (
    <section className="bg-charcoal py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-white/50 mb-5">What MBED eliminates</p>
        <h2 className="heading-display text-white text-3xl lg:text-4xl leading-snug mb-12 max-w-2xl">
          The risks that derail a specialist practice property decision are predictable. And entirely preventable.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
          {cards.map((card) => (
            <div key={card.num} className="bg-charcoal p-7">
              <span className="font-dm text-stone text-[11px] tracking-[0.12em] uppercase block mb-4">
                {card.num}
              </span>
              <p className="font-dm text-white/80 text-[14px] leading-relaxed">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Services ────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    num: "01", tag: "Strategy", title: "Practice growth & business strategy",
    desc: "Before any site or project exists, MBED maps where your practice is heading — financially, clinically, and geographically. The strategic foundation that every subsequent decision is built on. This is where the engagement begins.",
  },
  {
    num: "02", tag: "Acquisition", title: "Site acquisition & lease advisory",
    desc: "Site identification, due diligence, lease negotiation, and purchase strategy — including residential conversion opportunities that most advisers overlook entirely. MBED does not hand off at lease execution. That is where the real work begins.",
  },
  {
    num: "03", tag: "Financial", title: "Financial strategy & feasibility",
    desc: "Capital structure, funding strategy, CAPEX planning, and ROI modelling — before a dollar is committed to design or delivery. The numbers have to work. MBED makes sure they do.",
  },
  {
    num: "04", tag: "Compliance", title: "Technical compliance & risk assessment",
    desc: "Planning, DDA, infection control, clinical waste, equipment loads, heritage overlays, and hours-of-operation conditions — assessed before commitment, not discovered mid-project. The compliance layer that cannot be retrofitted.",
  },
  {
    num: "05", tag: "Delivery", title: "Independent project management",
    desc: "MBED manages the project entirely on your behalf — brief, consultant selection, contractor procurement, programme, and delivery oversight. One point of contact. No gaps in the brief. No surprises at handover.",
  },
  {
    num: "06", tag: "Delivery", title: "Construction management",
    desc: "Where you require it, MBED steps into construction management on a fully open-book basis. Complete cost transparency. Contractor accountability. Your project, run the way it should be run.",
  },
  {
    num: "07", tag: "Advisory", title: "Funding & property strategy",
    desc: "Coordinate the full advisory stack — finance, planning, compliance — so your funding and project structure are aligned from the outset. Not assembled on the run when problems emerge.",
  },
  {
    num: "08", tag: "Advisory", title: "Early contractor involvement",
    desc: "Bring the right expertise into your project at the point it creates the most value — when it shapes the brief, reduces risk, and produces outcomes that a late-stage tender cannot achieve.",
  },
  {
    num: "09", tag: "Ongoing", title: "Post-occupancy & practice support",
    desc: "MBED stays engaged through practical completion, defects, and the post-occupancy period. The relationship does not end at handover. That is when most practices need a trusted adviser most.",
  },
];

function ServicesSection() {
  return (
    <section id="services" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-stone mb-5">Services</p>
        <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-12">
          What we do
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-charcoal/10">
          {SERVICES.map((s) => (
            <div key={s.num} className="bg-white p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-dm text-[10px] tracking-[0.14em] uppercase text-white bg-stone px-2 py-0.5">
                  {s.tag}
                </span>
                <span className="font-dm text-stone text-[11px] tracking-[0.1em]">
                  {s.num}
                </span>
              </div>
              <h3 className="heading-display text-charcoal text-[20px] leading-snug mb-3">
                {s.title}
              </h3>
              <p className="font-dm text-charcoal/65 text-[13px] leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Guide Download / Notify Me ──────────────────────────────────────────────

const CHECKLIST = [
  "Zoning and planning scheme requirements",
  "Disability access and DDA compliance",
  "Car parking requirements by council and specialty",
  "Infection control and clinical waste",
  "Structural requirements for equipment loads",
  "Heritage overlays and what they prevent",
  "Neighbour amenity and hours-of-operation conditions",
];

const GUIDE_PDF = "/downloads/specialist-guide-residential-conversion.pdf";

function GuideSection() {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", specialty: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  function validate() {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.specialty.trim()) e.specialty = "Required";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/guide-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        // Trigger automatic download after successful CRM post
        const link = document.createElement("a");
        link.href = GUIDE_PDF;
        link.download = "specialist-guide-residential-conversion.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSubmitted(true);
      } else {
        const data = await res.json();
        setServerError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="guide" className="bg-linen py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left */}
          <div>
            <p className="section-tag text-stone mb-5">
              Free download — available now
            </p>
            <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-3">
              The Specialist&apos;s Guide to Residential Conversion
            </h2>
            <p className="font-dm text-charcoal/50 text-[13px] mb-6 tracking-wide">
              Download instantly. No spam. Unsubscribe at any time.
            </p>
            <p className="font-dm text-charcoal/70 text-[15px] leading-relaxed">
              Residential conversion is the most overlooked pathway to purpose-built specialist rooms in metropolitan Melbourne. This guide covers the compliance requirements, planning considerations, and deal-breakers to assess before you commit — so you arrive at the transaction knowing exactly what you are buying.
            </p>
          </div>

          {/* Right */}
          <div>
            {/* Checklist */}
            <ul className="space-y-2.5 mb-8">
              {CHECKLIST.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-stone shrink-0" />
                  <span className="font-dm text-charcoal/75 text-[13px] leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            {/* Form */}
            {submitted ? (
              <div className="bg-charcoal/5 border border-charcoal/15 p-6 space-y-4">
                <h3 className="heading-display text-charcoal text-xl">
                  Your guide is downloading now.
                </h3>
                <p className="font-dm text-charcoal/70 text-[14px] leading-relaxed">
                  The Specialist&apos;s Guide to Residential Conversion is on its way. If the download did not start automatically, use the button below.
                </p>
                <a
                  href={GUIDE_PDF}
                  download
                  className="inline-block font-dm text-[13px] tracking-wide bg-charcoal text-white px-5 py-3 hover:bg-stone transition-colors duration-200"
                >
                  Download guide (PDF)
                </a>
                <p className="font-dm text-charcoal/50 text-[13px] leading-relaxed pt-2 border-t border-charcoal/10">
                  While you have it open — book a 15-minute practice growth consultation.{" "}
                  <a
                    href={HUBSPOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-charcoal underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Book a time →
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="First name"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className={`w-full font-dm text-[13px] bg-white border px-4 py-3 placeholder:text-charcoal/40 ${errors.first_name ? "border-red-400" : "border-charcoal/20"} focus:border-charcoal`}
                    />
                    {errors.first_name && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Last name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className={`w-full font-dm text-[13px] bg-white border px-4 py-3 placeholder:text-charcoal/40 ${errors.last_name ? "border-red-400" : "border-charcoal/20"} focus:border-charcoal`}
                    />
                    {errors.last_name && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.last_name}</p>}
                  </div>
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`w-full font-dm text-[13px] bg-white border px-4 py-3 placeholder:text-charcoal/40 ${errors.email ? "border-red-400" : "border-charcoal/20"} focus:border-charcoal`}
                  />
                  {errors.email && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.email}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Your specialty (e.g. Gynaecologist, Surgeon)"
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    className={`w-full font-dm text-[13px] bg-white border px-4 py-3 placeholder:text-charcoal/40 ${errors.specialty ? "border-red-400" : "border-charcoal/20"} focus:border-charcoal`}
                  />
                  {errors.specialty && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.specialty}</p>}
                </div>
                {serverError && (
                  <p className="font-dm text-red-500 text-[12px]">{serverError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full font-dm text-[13px] tracking-wide bg-charcoal text-white py-3.5 hover:bg-stone transition-colors duration-200 disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Download the free guide →"}
                </button>
                <p className="font-dm text-charcoal/45 text-[11px] leading-relaxed">
                  Your details are used only to send you the guide and relevant MBED updates. Unsubscribe at any time.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Practice growth consultation",
    desc: "Fifteen minutes. You tell MBED where your practice is heading. We tell you what stands between you and there — and exactly what it will take to get there. No obligation. No agenda other than clarity.",
  },
  {
    num: "02",
    title: "Strategy & acquisition",
    desc: "MBED maps the financial and strategic landscape, identifies the right sites or conversion opportunities, and takes you through acquisition with full due diligence and compliance assessment completed before you sign.",
  },
  {
    num: "03",
    title: "Design & delivery",
    desc: "MBED manages the full project — consultants, contractors, programme, and budget — as a single coordinated team. You receive one brief, one budget, one point of contact. Nothing falls through the gaps.",
  },
  {
    num: "04",
    title: "Handover & beyond",
    desc: "Practical completion, defects, and post-occupancy — MBED stays. The relationship that began with strategy does not end at handover. Your practice continues to evolve. MBED continues alongside it.",
  },
];

function HowItWorksSection() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-stone mb-5">Process</p>
        <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-2.5 left-full w-full h-px bg-charcoal/10 -z-10" />
              )}
              <span className="font-dm text-stone text-[12px] tracking-[0.12em] uppercase block mb-4">
                {step.num}
              </span>
              <h3 className="heading-display text-charcoal text-xl mb-3">{step.title}</h3>
              <p className="font-dm text-charcoal/65 text-[13px] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

function PortfolioSection() {
  return (
    <section id="portfolio" className="bg-charcoal py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-white/50 mb-5">Selected projects</p>
        <h2 className="heading-display text-white text-3xl lg:text-4xl leading-snug mb-10">
          Work
        </h2>

        {/* Mosaic grid — hero spans 2 rows, third row full-width split */}
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: "55% 1fr 1fr",
            gridTemplateRows: "1fr 1fr 180px",
            height: "600px",
          }}
        >
          {/* Hero — spans rows 1+2 */}
          <div className="portfolio-item relative" style={{ gridColumn: "1", gridRow: "1 / span 2" }}>
            <Image
              src="/images/imgco-11.jpg"
              alt="Dentistry in Canterbury"
              fill
              className="object-cover object-center"
              sizes="55vw"
            />
            <div className="caption">
              <p className="font-dm text-white text-[13px] font-medium">Dentistry in Canterbury</p>
              <p className="font-dm text-white/65 text-[11px]">Fitout & Project Management — Canterbury VIC</p>
              <p className="text-[#00897B] text-xs font-semibold mt-1 tracking-wide">7 surgeries. 6 months. 15% under market rate.</p>
            </div>
          </div>

          {/* imgco-16 — top right */}
          <div className="portfolio-item relative" style={{ gridColumn: "2 / span 2", gridRow: "1" }}>
            <Image
              src="/images/imgco-16.jpg"
              alt="North Preston Specialists"
              fill
              className="object-cover object-center"
              sizes="45vw"
            />
            <div className="caption">
              <p className="font-dm text-white text-[13px] font-medium">North Preston Specialists</p>
              <p className="font-dm text-white/65 text-[11px]">Specialist Centre — Preston VIC</p>
              <p className="text-[#00897B] text-xs font-semibold mt-1 tracking-wide">4 specialties. SMSF acquisition. Delivered under budget.</p>
            </div>
          </div>

          {/* imgco-17 — middle right */}
          <div className="portfolio-item relative" style={{ gridColumn: "2 / span 2", gridRow: "2" }}>
            <Image
              src="/images/imgco-17.jpg"
              alt="Northwest Health"
              fill
              className="object-cover object-center"
              sizes="45vw"
            />
            <div className="caption">
              <p className="font-dm text-white text-[13px] font-medium">Northwest Health</p>
              <p className="font-dm text-white/65 text-[11px]">Thames Street — Project Advisory</p>
            </div>
          </div>

          {/* imgco-07 — bottom row left */}
          <div className="portfolio-item relative" style={{ gridColumn: "1 / span 2", gridRow: "3" }}>
            <Image
              src="/images/imgco-07.jpg"
              alt="Ekera Medical Centre"
              fill
              className="object-cover object-center"
              sizes="55vw"
            />
            <div className="caption">
              <p className="font-dm text-white text-[13px] font-medium">Ekera Medical Centre</p>
              <p className="font-dm text-white/65 text-[11px]">Fitout & Refurbishment — Melbourne VIC</p>
            </div>
          </div>

          {/* imgco-15 — bottom row right */}
          <div className="portfolio-item relative" style={{ gridColumn: "3", gridRow: "3" }}>
            <Image
              src="/images/imgco-15.jpg"
              alt="Medical project"
              fill
              className="object-cover object-center"
              sizes="22vw"
            />
            <div className="caption">
              <p className="font-dm text-white text-[13px] font-medium">MBED Project</p>
              <p className="font-dm text-white/65 text-[11px]">Melbourne, Victoria</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Who We Serve ────────────────────────────────────────────────────────────

function ServeSection() {
  return (
    <section id="serve" className="bg-linen py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-stone mb-5">Who we serve</p>
        <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-12">
          Built for the people who built their practice.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-charcoal/10">
          {/* Card 1 */}
          <div className="bg-linen p-8 flex flex-col">
            <span className="section-tag text-stone mb-3">Specialists &amp; surgeons</span>
            <h3 className="heading-display text-charcoal text-2xl mb-4">Private specialist practices</h3>
            <p className="font-dm text-charcoal/70 text-[13px] leading-relaxed flex-1">
              Gynaecologists, surgeons, dermatologists, urologists — specialists running or establishing a private practice who require rooms that reflect the standard of their clinical work. You know what you want. MBED makes sure nothing stands between that vision and the space that delivers it.
            </p>
            <a
              href="#guide"
              className="mt-6 font-dm text-stone text-[12px] tracking-wide hover:text-charcoal transition-colors"
            >
              Download the residential conversion guide →
            </a>
          </div>

          {/* Card 2 */}
          <div className="bg-linen p-8 flex flex-col">
            <span className="section-tag text-stone mb-3">GP &amp; allied health</span>
            <h3 className="heading-display text-charcoal text-2xl mb-4">GP super clinics &amp; growing practices</h3>
            <p className="font-dm text-charcoal/70 text-[13px] leading-relaxed flex-1">
              Owner-led, developer-style decision making. Capital commitments that will shape your practice for a decade or more. MBED provides the strategic grounding, acquisition advice, and delivery oversight to get it right — once, properly, without the detours.
            </p>
            <a
              href={HUBSPOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 font-dm text-stone text-[12px] tracking-wide hover:text-charcoal transition-colors"
            >
              Book a practice growth consultation →
            </a>
          </div>

          {/* Card 3 */}
          <div className="bg-linen p-8 flex flex-col">
            <span className="section-tag text-stone mb-3">Collectives &amp; developments</span>
            <h3 className="heading-display text-charcoal text-2xl mb-4">Medical centres &amp; corporate groups</h3>
            <p className="font-dm text-charcoal/70 text-[13px] leading-relaxed flex-1">
              Corporate medical groups and specialist centre developers making capital decisions at scale. You already have advisers. MBED provides the independent, embedded oversight that protects the organisation — and tells you what the others are not saying.
            </p>
            <a
              href="#contact"
              className="mt-6 font-dm text-stone text-[12px] tracking-wide hover:text-charcoal transition-colors"
            >
              Start a conversation →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Philosophy ───────────────────────────────────────────────────────────────

function PhilosophySection() {
  return (
    <section className="bg-charcoal py-20 lg:py-28">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center">
        <div className="w-12 h-px bg-stone mx-auto mb-10" />
        <blockquote
          className="heading-display text-white text-2xl lg:text-3xl leading-relaxed mb-8"
          style={{ fontStyle: "italic" }}
        >
          &ldquo;The spaces where people heal deserve more than a builder&apos;s opinion on how they should be built. They deserve independent advice, honest counsel, and an adviser who is still standing beside you when the doors open.&rdquo;
        </blockquote>
        <p className="font-dm text-white/50 text-[12px] tracking-[0.1em] uppercase">
          Bernie Fernandez — Founder, MBED
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Do I need a planning permit to convert a residential property to a medical centre in Melbourne?",
    a: "Almost always yes — but the pathway depends on the zone. In a General Residential Zone a planning permit is required for a change of use to a Medical Centre. In a Residential Growth Zone a permit-free pathway exists if the gross floor area is under 250 square metres, no car parking permit is required, and the site adjoins a Road Zone. In a Mixed Use Zone the requirements vary by council schedule. MBED confirms the planning pathway as part of every site assessment — before you commit to the property, not after.",
  },
  {
    q: "What is the single biggest cost surprise in a residential conversion?",
    a: "DDA-compliant accessible amenities. Most residential properties have bathrooms that are too small to comply with AS 1428.1 — the standard for accessible toilet design. A compliant accessible toilet requires approximately 2.4 by 2.0 metres minimum. Retrofitting this into an existing residential floor plan often means relocating walls, moving plumbing, and in some cases structural work. MBED assesses this on site inspection — it is the first internal measurement we take on any candidate property, because if it cannot be resolved without major structural intervention the project economics change fundamentally.",
  },
  {
    q: "How long does a residential conversion take from first conversation to opening day?",
    a: "Six to twelve months is the realistic range. A straightforward conversion in a permissive zone with no heritage overlay and adequate on-site parking can be delivered in six months — site selection, planning, design, permit, construction, and handover. A heritage building, a complex planning permit, or a multi-disciplinary practice with greater clinical complexity adds time. MBED delivered the Canterbury dental conversion — a heritage-listed building with seven surgeries — in six months. The timeline is a product of how thoroughly the risks are resolved before the project begins.",
  },
  {
    q: "What is open book construction management and why does it matter?",
    a: "Open book construction management means the client sees every cost — every trade quote, every invoice, every variation — without markup or bundled contingency. MBED manages the project on your behalf, but you own the financial transparency. You know what each trade costs, you can introduce your own suppliers where it creates value, and you are not paying a fixed-price builder's margin on work you could have procured yourself. On the Canterbury project this approach delivered a 15% saving against comparable fixed-price quotes for the same scope.",
  },
  {
    q: "Can I buy a medical property through my self-managed superannuation fund?",
    a: "Yes — and it is one of the most effective structures available to specialist practitioners. A commercial property occupied by your own practice is a permitted investment for an SMSF under certain conditions. The compliance obligations are significant: trustee responsibilities, borrowing restrictions under a limited recourse borrowing arrangement, and ATO compliance requirements that apply throughout the life of the investment. MBED coordinated exactly this structure for a North Preston specialist centre — four specialties, cold shell fitout, acquisition and delivery both achieved under market rate. The key is having the financial, legal, and advisory disciplines coordinated from the outset, not assembled mid-transaction.",
  },
  {
    q: "What is the difference between MBED and a medical fitout contractor?",
    a: "A fitout contractor arrives after the property decision is made, the lease is signed, and the brief is written. MBED arrives before any of that — when the options are still open, the risks are still manageable, and the decisions that will shape every subsequent cost are still being formed. MBED is independent, which means the advice is directed entirely at your outcome. A contractor's advice is directed at securing the work. That is not a criticism — it is a structural difference. If the site cannot support your clinical model, MBED will tell you before you commit. A contractor will price the remediation after you have.",
  },
  {
    q: "Does MBED work on commercial tenancy fitouts as well as residential conversions?",
    a: "Yes. The North Preston specialist centre was a cold shell commercial tenancy within a mixed-use development — not a residential conversion. The same principles apply: independent advisory from site selection through to handover, open book cost management where appropriate, and a single coordinated engagement that covers strategy, acquisition, financial structure, compliance, design, and delivery. The residential conversion pathway is one of several ways MBED works with specialist practices — it is the most overlooked, which is why it anchors the free guide.",
  },
  {
    q: "Do heritage overlays make a conversion impossible?",
    a: "Rarely impossible — but always more complex and potentially more expensive. A heritage overlay requires planning approval for works that affect the heritage fabric, and depending on the statement of significance this can constrain everything from the entrance design to plant and equipment placement. The risk is not that heritage kills the project — it is that heritage costs are discovered after commitment rather than assessed before. MBED conducted a full heritage compliance review on the Canterbury project before exchange, which meant every cost was known and budgeted. The project was delivered without a single heritage-related surprise.",
  },
  {
    q: "How does car parking work for a medical centre in a residential zone?",
    a: "Car parking is one of the most common triggers for a planning permit and one of the most common reasons a conversion becomes unworkable. Under Victoria's Amendment VC277 (December 2025), the parking requirement is now determined by a PTAL category system — the category assigned to your site on the Car Parking Requirement Maps determines the minimum spaces required. Sites in Category 4 areas have no minimum requirement. Sites within 400 metres of the Principal Public Transport Network attract reduced rates. Where the required number of spaces cannot be met on title, a planning permit and a Car Parking Demand Assessment are required. MBED assesses this as part of every site review.",
  },
  {
    q: "What does MBED cost and how does the engagement work?",
    a: "The engagement begins with a fifteen-minute practice growth consultation — no cost, no obligation. MBED then proposes a scope and fee structure calibrated to the specific project. For full advisory engagements covering strategy, acquisition, compliance, and delivery, fees are structured as a fixed engagement fee rather than a percentage of project cost — which means MBED's incentive is the quality of your outcome, not the size of your budget. The first conversation costs nothing. Book one at the link below.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(i: number) {
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <section id="faq" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="section-tag text-stone mb-5">COMMON QUESTIONS</p>
        <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-12">
          What specialists ask before they call.
        </h2>
        <div className="divide-y divide-charcoal/10 max-w-3xl">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between gap-6 py-5 text-left group"
                aria-expanded={openIndex === i}
              >
                <span className="font-dm text-charcoal text-[14px] leading-snug font-medium group-hover:text-stone transition-colors">
                  {item.q}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-4 h-4 shrink-0 text-[#00897B] transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {openIndex === i && (
                <div className="pb-6">
                  <p className="font-dm text-charcoal/70 text-[14px] leading-relaxed">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

const PRACTICE_TYPES = [
  "Specialist — private practice",
  "GP super clinic",
  "Allied health",
  "Private hospital",
  "Medical collective or development",
  "Other",
];

function ContactSection() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    practice_type: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  function validate() {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setServerError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (field: string) =>
    `w-full font-dm text-[13px] bg-white border px-4 py-3 placeholder:text-charcoal/40 ${
      errors[field] ? "border-red-400" : "border-charcoal/20"
    } focus:border-charcoal`;

  return (
    <section id="contact" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* Two-column intro row above the form */}
        <div className="grid lg:grid-cols-2 gap-10 mb-14">
          {/* Left — process steps */}
          <div className="space-y-3 font-dm text-sm text-gray-700 leading-relaxed">
            <p>
              <span className="text-[#00897B] font-medium">01 —</span> You send a message or book directly.
            </p>
            <p>
              <span className="text-[#00897B] font-medium">02 —</span> MBED responds within one business day.
            </p>
            <p>
              <span className="text-[#00897B] font-medium">03 —</span> A fifteen-minute call. No pitch. Just clarity.
            </p>
          </div>

          {/* Right — direct booking */}
          <div className="bg-[#F5F5F0] p-6 rounded-sm flex flex-col items-center text-center">
            <h3 className="font-dm text-charcoal text-[15px] font-medium mb-2">Prefer to book directly?</h3>
            <p className="font-dm text-charcoal/60 text-[13px] mb-5">Skip the form. Choose a time that suits you.</p>
            <a
              href={HUBSPOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-dm text-[13px] tracking-wide border border-[#111111] px-5 py-2.5 hover:bg-[#111111] hover:text-white transition-colors duration-200"
            >
              Book a 15-minute call →
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left */}
          <div>
            <p className="section-tag text-stone mb-5">Get in touch</p>
            <h2 className="heading-display text-charcoal text-3xl lg:text-4xl leading-snug mb-6">
              Fifteen minutes. That is all it takes to know if we are the right fit.
            </h2>
            <p className="font-dm text-charcoal/70 text-[15px] leading-relaxed mb-8">
              Tell us where your practice is heading. We will tell you what stands between you and there — and what it will actually take to get there. No obligation. No pitch.
            </p>
            <div className="space-y-3 font-dm text-charcoal/70 text-[14px]">
              <p>
                <a href="mailto:hello@mbed.com.au" className="hover:text-charcoal transition-colors">
                  hello@mbed.com.au
                </a>
              </p>
              <p>Melbourne, Victoria, Australia</p>
            </div>
          </div>

          {/* Right — form */}
          <div>
            {submitted ? (
              <div className="bg-linen border border-charcoal/15 p-6">
                <p className="font-dm text-charcoal text-[14px] leading-relaxed">
                  Thank you. We will be in touch within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="First name"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className={inputCls("first_name")}
                    />
                    {errors.first_name && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Last name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className={inputCls("last_name")}
                    />
                    {errors.last_name && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.last_name}</p>}
                  </div>
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls("email")}
                  />
                  {errors.email && <p className="font-dm text-red-500 text-[11px] mt-1">{errors.email}</p>}
                </div>
                <input
                  type="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full font-dm text-[13px] bg-white border border-charcoal/20 px-4 py-3 placeholder:text-charcoal/40 focus:border-charcoal"
                />
                <select
                  value={form.practice_type}
                  onChange={(e) => setForm({ ...form, practice_type: e.target.value })}
                  className="w-full font-dm text-[13px] bg-white border border-charcoal/20 px-4 py-3 text-charcoal/70 focus:border-charcoal appearance-none"
                >
                  <option value="">Practice type</option>
                  {PRACTICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <textarea
                  placeholder="How can we help?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  className="w-full font-dm text-[13px] bg-white border border-charcoal/20 px-4 py-3 placeholder:text-charcoal/40 focus:border-charcoal resize-none"
                />
                {serverError && (
                  <p className="font-dm text-red-500 text-[12px]">{serverError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full font-dm text-[13px] tracking-wide bg-charcoal text-white py-3.5 hover:bg-stone transition-colors duration-200 disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-charcoal py-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Left */}
          <div>
            <p className="font-dm text-white text-[17px] font-medium tracking-[0.2em] mb-3">
              MBED
            </p>
            <p
              className="heading-display text-white/60 text-[15px] leading-relaxed"
              style={{ fontStyle: "italic" }}
            >
              Embedded. Independent. So the only thing on your mind is your practice.
            </p>
          </div>

          {/* Centre */}
          <div>
            <p className="section-tag text-white/40 mb-4">Navigation</p>
            <ul className="space-y-2.5 font-dm text-white/60 text-[13px]">
              <li><a href="#difference" className="hover:text-white transition-colors">The Difference</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
              <li><a href="#guide" className="hover:text-white transition-colors">Free Guide</a></li>
              <li><a href="#portfolio" className="hover:text-white transition-colors">Projects</a></li>
              <li><a href="#serve" className="hover:text-white transition-colors">Who We Serve</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Right */}
          <div>
            <p className="section-tag text-white/40 mb-4">Contact</p>
            <ul className="space-y-2.5 font-dm text-white/60 text-[13px]">
              <li>
                <a href="mailto:hello@mbed.com.au" className="hover:text-white transition-colors">
                  hello@mbed.com.au
                </a>
              </li>
              <li>
                <a href="tel:+61425764854" className="hover:text-white transition-colors">
                  +61 425 764 854
                </a>
              </li>
              <li>Unit 1, 323 Ingles Street, Port Melbourne VIC 3207</li>
              <li>
                <a href="https://mbed.com.au" className="hover:text-white transition-colors">
                  mbed.com.au
                </a>
              </li>
              <li>ABN 89 154 317 736</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="font-dm text-white/30 text-[11px]">
            &copy; 2026 MBED. All rights reserved.
          </p>
          <a
            href="/privacy"
            className="font-dm text-white/30 text-[11px] hover:text-white/60 transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <CredentialStrip />
        <DifferenceSection />
        <EliminatesSection />
        <ServicesSection />
        <GuideSection />
        <HowItWorksSection />
        <PortfolioSection />
        <ServeSection />
        <PhilosophySection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
