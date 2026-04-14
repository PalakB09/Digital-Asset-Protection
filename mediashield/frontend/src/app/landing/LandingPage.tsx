"use client";

import Link from "next/link";
import { Inter, Instrument_Serif } from "next/font/google";
import { useEffect, useState } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-landing-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-serif",
  display: "swap",
});

const features = [
  {
    title: "Fingerprint Engine",
    body: "Track altered image/video copies in seconds.",
  },
  {
    title: "CLIP Similarity",
    body: "Find semantically similar content beyond exact matches.",
  },
  {
    title: "Ownership Proof",
    body: "Watermark checks plus verifiable enforcement trails.",
  },
];

const steps = [
  { title: "Ingest", body: "Pull media events from monitored channels." },
  { title: "Detect", body: "Run fingerprint + embedding matching." },
  { title: "Verify", body: "Validate ownership and confidence signals." },
  { title: "Enforce", body: "Trigger alerts and legal workflows." },
];

const unGoals = [
  {
    goal: "SDG 9",
    detail: "Digital rights infrastructure",
  },
  {
    goal: "SDG 16",
    detail: "Trust, evidence, accountability",
  },
  {
    goal: "SDG 8",
    detail: "Creator and media economy protection",
  },
];

export function LandingPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mediashield-theme") : null;
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("mediashield-theme", next);
  }

  return (
    <main className={`${inter.variable} ${instrumentSerif.variable} landing-shell min-h-screen overflow-hidden`}>
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_-10%,rgba(31,114,255,0.22),transparent_45%),radial-gradient(circle_at_70%_30%,rgba(0,198,255,0.12),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]" />
      <div className="absolute inset-0 pointer-events-none opacity-20 [background-image:linear-gradient(rgba(121,152,210,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(121,152,210,0.25)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="orb orb-one" />
      <div className="orb orb-two" />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <header className="h-16 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-[28px] leading-none font-semibold tracking-tight" style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}>
              MediaShield
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-[14px]" style={{ color: "var(--landing-subtext)" }}>
              <a href="#why" className="hover:opacity-100 opacity-80 transition-opacity">Why</a>
              <a href="#need" className="hover:opacity-100 opacity-80 transition-opacity">Need of Hour</a>
              <a href="#capabilities" className="hover:opacity-100 opacity-80 transition-opacity">Capabilities</a>
              <a href="#un-goals" className="hover:opacity-100 opacity-80 transition-opacity">UN Goals</a>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-[14px]">
            <button
              type="button"
              aria-label="Toggle light and dark theme"
              onClick={toggleTheme}
              className="theme-toggle"
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <span className={`theme-toggle-knob ${theme === "light" ? "is-light" : ""}`} />
              <span className="theme-toggle-icon">☀</span>
              <span className="theme-toggle-icon">☾</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-[#1F68FF] hover:bg-[#2A72FF] px-4 h-9 font-medium text-white shadow-[0_8px_22px_rgba(23,105,255,0.45)] transition-all hover:scale-[1.03]"
            >
              Try now
            </Link>
          </div>
        </header>

        <section id="why" className="pt-20 pb-10 text-center max-w-[860px] mx-auto fade-up">
          <h1
            className="hero-heading-wave text-[50px] leading-[1.08] md:text-[66px] tracking-tight"
            style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}
          >
            Stop media misuse before it spreads
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed max-w-[760px] mx-auto" style={{ color: "var(--landing-subtext)" }}>
            MediaShield detects, verifies, and enforces ownership of sports images and videos with automated, production-grade workflows.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-[#1F68FF] hover:bg-[#2A72FF] h-11 px-5 text-[15px] font-medium text-white shadow-[0_10px_26px_rgba(23,105,255,0.48)] transition-all hover:-translate-y-0.5"
            >
              Try now
            </Link>
            <Link
              href="/dashboard"
              className="landing-btn-secondary inline-flex items-center justify-center rounded-md h-11 px-5 text-[15px] font-medium transition-all hover:-translate-y-0.5"
            >
              Dashboard
            </Link>
          </div>
          <div className="mt-8 overflow-hidden rounded-full border border-white/10 bg-white/3 py-2">
            <div className="marquee text-[12px] uppercase tracking-[0.14em]" style={{ color: "var(--landing-muted)" }}>
              <span>Fingerprinting</span><span>CLIP Matching</span><span>Watermark Verification</span><span>Async Processing</span><span>Real-time Alerts</span>
            </div>
          </div>
        </section>

        <section id="need" className="pb-14 fade-up" style={{ animationDelay: "120ms" }}>
          <div className="visual-panel">
            <div className="scan-grid" />
            <div className="scan-beam" />
            <div className="relative z-10 max-w-[560px] p-7">
              <h2 className="text-[34px] leading-tight" style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}>
                Need of the hour
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed" style={{ color: "var(--landing-subtext)" }}>
                High-value sports media now leaks and replicates in minutes. MediaShield gives teams an always-on detection and enforcement loop.
              </p>
            </div>
          </div>
        </section>

        <section id="capabilities" className="pb-14 fade-up" style={{ animationDelay: "220ms" }}>
          <h2 className="text-center text-[38px] leading-tight" style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}>
            What powers MediaShield
          </h2>
          <div className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, idx) => (
              <article
                key={feature.title}
                className="minimal-tile p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${idx * 110}ms` }}
              >
                <h3 className="text-[18px] font-semibold" style={{ color: "var(--landing-heading)" }}>{feature.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--landing-subtext)" }}>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-14 fade-up" style={{ animationDelay: "320ms" }}>
          <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}>
            How it works
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((step, idx) => (
              <article key={step.title} className="minimal-tile p-4">
                <p className="text-[12px]" style={{ color: "var(--landing-muted)" }}>0{idx + 1}</p>
                <h3 className="mt-1 text-[17px] font-semibold" style={{ color: "var(--landing-heading)" }}>{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--landing-subtext)" }}>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="un-goals" className="pb-20 fade-up" style={{ animationDelay: "420ms" }}>
          <div className="un-goals-panel rounded-2xl p-7 md:p-8">
            <div className="mb-6">
              <h2 className="text-[34px] leading-tight" style={{ fontFamily: "var(--font-landing-serif)", color: "var(--landing-heading)" }}>
                UN Goal Alignment
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {unGoals.map((item, idx) => (
                <article
                  key={item.goal}
                  className="un-goal-card rounded-xl p-5 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="mb-3 inline-flex w-8 h-8 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-primary)]">
                    {idx + 1}
                  </div>
                  <h3 className="text-[17px] font-semibold" style={{ color: "var(--landing-heading)" }}>{item.goal}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--landing-subtext)" }}>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
