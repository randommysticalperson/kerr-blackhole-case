/**
 * MHShowcase.tsx — Malament–Hogarth Spacetime Showcase Page
 *
 * Design: Deep-space instrument aesthetic
 * - Background: #000005 (true black)
 * - Accent cyan: #00E5FF  — observer worldline, outer horizon
 * - Accent amber: #FFB347 — λ worldline, computation
 * - Accent violet: #B464FF — Cauchy horizon, M-H event
 * - Typography: Space Grotesk (display) + Space Mono (data)
 */

import MHSimulation from "@/components/MHSimulation";
import { useState } from "react";

const HERO_IMG       = "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/LWsaMHsQL9wPYEf63JaYY7/mh-hero-Ez8GXDSMe284ot6ro43BKB.png";
const BLUESHIFT_IMG  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/LWsaMHsQL9wPYEf63JaYY7/mh-blueshift-gDU5wosVgfGv9Rs3H3H9yR.png";
const HYPERCOMP_IMG  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/LWsaMHsQL9wPYEf63JaYY7/mh-hypercompute-H2BZGH7HjNnYPazPuUS3Qs.png";

// ─── Halting Problem Explainer ───────────────────────────────────────────────

function HaltingExplainer() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: "01  Setup", color: "cyan", text: "Observer O and Turing machine TM are co-located at event q in Region I. O programs TM to signal p if and only if it halts." },
    { label: "02  Separation", color: "amber", text: "TM embarks on worldline λ — a timelike geodesic that spirals near r₋, accumulating infinite proper time. TM computes for all eternity." },
    { label: "03  Observer travels", color: "cyan", text: "O takes a short path through Region II — finite proper time τ(obs) < ∞ — toward the M-H event p inside the Cauchy horizon." },
    { label: "04  Signal received?", color: "violet", text: "At event p, O checks: did a signal from TM arrive? If yes → TM halted. If no → TM runs forever. The Halting Problem is decided." },
  ];
  return (
    <div className="border border-white/10 bg-white/[0.02]">
      <div className="flex border-b border-white/10">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)}
            className={`flex-1 py-3 text-xs tracking-widest uppercase transition-colors border-r border-white/10 last:border-r-0
              ${step === i
                ? s.color === "cyan"   ? "text-cyan-400 bg-cyan-400/8 border-b-2 border-b-cyan-400"
                : s.color === "amber"  ? "text-amber-400 bg-amber-400/8 border-b-2 border-b-amber-400"
                : "text-violet-400 bg-violet-400/8 border-b-2 border-b-violet-400"
                : "text-white/30 hover:text-white/60"}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="p-6 min-h-[80px]">
        <p className="text-white/75 leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {steps[step].text}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MHShowcase() {
  return (
    <div className="min-h-screen" style={{ background: "#000005", color: "white", fontFamily: "'Space Mono', monospace" }}>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Malament–Hogarth spacetime Penrose diagram"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.65 }}
        />
        {/* Gradient overlay — dark at bottom for text legibility */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, #000005 95%)" }} />

        <div className="relative z-10 px-8 md:px-16 pb-16 max-w-5xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 border border-violet-400/40 px-3 py-1 text-xs text-violet-300 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Relativistic Causal Structure
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
            Malament–Hogarth<br />
            <span style={{ color: "#B464FF" }}>Spacetime</span>
          </h1>

          <p className="text-white/60 text-base md:text-lg max-w-2xl mb-8 leading-relaxed"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            A relativistic spacetime where a worldline of <span style={{ color: "#FFB347" }}>infinite proper time</span> lies
            entirely within the causal past of a single event — enabling
            <span style={{ color: "#00E5FF" }}> hypercomputation</span> and the resolution of undecidable problems.
          </p>

          {/* Live readouts */}
          <div className="flex flex-wrap gap-6 mb-8 text-xs">
            {[
              { label: "r₊ (outer horizon)", val: "1 + √(1−a²) M", color: "#00E5FF" },
              { label: "r₋ (Cauchy horizon)", val: "1 − √(1−a²) M", color: "#B464FF" },
              { label: "τ(λ)", val: "→ ∞", color: "#FFB347" },
              { label: "τ(observer)", val: "< ∞", color: "#00E5FF" },
            ].map(r => (
              <div key={r.label} className="flex flex-col gap-0.5">
                <span className="text-white/35 uppercase tracking-widest text-[10px]">{r.label}</span>
                <span style={{ color: r.color }} className="text-sm">{r.val}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="#simulation"
              className="px-6 py-2.5 text-xs tracking-widest uppercase transition-colors"
              style={{ border: "1px solid #B464FF", color: "#B464FF" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,100,255,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Open Simulation
            </a>
            <a href="#physics"
              className="px-6 py-2.5 text-xs tracking-widest uppercase text-white/50 transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
              Physics Notes
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-white/10 px-8 md:px-16 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { label: "Spacetime type",     val: "Kerr (rotating BH)" },
            { label: "Key feature",        val: "Inner horizon = Cauchy horizon" },
            { label: "Computation model",  val: "Relativistic Turing machine" },
            { label: "Solves",             val: "Halting Problem" },
            { label: "Obstruction",        val: "Mass inflation instability" },
          ].map(s => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-white/30 text-[10px] uppercase tracking-widest">{s.label}</span>
              <span className="text-white/85 text-xs">{s.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Simulation ── */}
      <section id="simulation" className="px-4 md:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-violet-400 text-xs tracking-widest uppercase mb-1">Interactive Simulation</p>
              <h2 className="text-3xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Causal Structure Visualizer
              </h2>
            </div>
            <p className="text-white/30 text-xs hidden md:block">
              Penrose diagram · Kerr interior · drag sliders to explore
            </p>
          </div>
          <MHSimulation className="w-full" />
          <p className="mt-3 text-white/25 text-xs text-center">
            Penrose tab: adjust spin a and M-H event position p. Kerr Interior tab: WebGL2 equatorial slice with blueshift ramp near r₋.
          </p>
        </div>
      </section>

      {/* ── Physics ── */}
      <section id="physics" className="px-8 md:px-16 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-cyan-400 text-xs tracking-widest uppercase mb-2">Formal Definition</p>
          <h2 className="text-3xl font-black mb-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            The M-H Property
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Definition card */}
            <div className="border border-violet-400/30 p-6 bg-violet-400/[0.03]">
              <h3 className="text-violet-300 text-xs tracking-widest uppercase mb-4">Definition</h3>
              <p className="text-white/70 leading-relaxed mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                A spacetime <em>(M, g)</em> is a <strong className="text-white">Malament–Hogarth spacetime</strong> if
                there exists a future-directed timelike worldline λ and an event <em>p</em> such that:
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-violet-400 mt-0.5">①</span>
                  <span className="text-white/70">All events along λ lie in the causal past <em>J⁻(p)</em> — i.e., λ ⊂ J⁻(p)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-400 mt-0.5">②</span>
                  <span className="text-white/70">The proper time along λ is infinite: <span style={{ color: "#FFB347" }}>∫<sub>λ</sub> dτ = ∞</span></span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-400 mt-0.5">③</span>
                  <span className="text-white/70">The proper time from any event q ∈ λ to p along the observer's worldline is finite</span>
                </div>
              </div>
              <p className="text-violet-300/70 text-xs mt-4">
                The event p is called an <strong>M-H event</strong>. Its boundary is a Cauchy horizon.
              </p>
            </div>

            {/* Kerr radii card */}
            <div className="border border-cyan-400/20 p-6 bg-cyan-400/[0.02]">
              <h3 className="text-cyan-300 text-xs tracking-widest uppercase mb-4">Kerr Geometry (M = 1)</h3>
              <div className="space-y-4 text-sm">
                {[
                  { name: "Outer horizon r₊", formula: "1 + √(1 − a²)", color: "#00E5FF", note: "Event horizon — no escape" },
                  { name: "Inner horizon r₋", formula: "1 − √(1 − a²)", color: "#B464FF", note: "Cauchy horizon — M-H boundary" },
                  { name: "Ergosphere (eq.)", formula: "r_e = 2M",       color: "#FFB347", note: "Frame-dragging region" },
                  { name: "ISCO",             formula: "3 + Z₂ − √(…)",  color: "#888",    note: "Innermost stable circular orbit" },
                ].map(r => (
                  <div key={r.name} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-white/80">{r.name}</div>
                      <div className="text-white/35 text-xs">{r.note}</div>
                    </div>
                    <code style={{ color: r.color }} className="text-xs whitespace-nowrap">{r.formula}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hypercomputation explainer */}
          <div className="mb-12">
            <p className="text-amber-400 text-xs tracking-widest uppercase mb-2">Hypercomputation Protocol</p>
            <h3 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Deciding the Halting Problem
            </h3>
            <HaltingExplainer />
          </div>

          {/* Two-column: blueshift + hypercomp images */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <img src={BLUESHIFT_IMG} alt="Gravitational blueshift near inner horizon"
                className="w-full object-cover" style={{ aspectRatio: "3/2" }} />
              <div>
                <p className="text-amber-400 text-xs tracking-widest uppercase mb-1">Mass Inflation</p>
                <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Infalling radiation is blueshifted to infinite energy near r₋ due to extreme spacetime curvature.
                  This backreaction destabilises the inner horizon — the classical M-H setup requires an idealised,
                  eternal black hole unperturbed by quantum effects.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <img src={HYPERCOMP_IMG} alt="Relativistic hypercomputation concept"
                className="w-full object-cover" style={{ aspectRatio: "3/2" }} />
              <div>
                <p className="text-violet-400 text-xs tracking-widest uppercase mb-1">Relativistic Hypercomputation</p>
                <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  The Turing machine travels on λ, computing for infinite subjective time while the observer
                  takes a finite-proper-time path to p. The signal from TM — if it halts — arrives at p
                  before the observer does, resolving the undecidable problem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Causal structure table ── */}
      <section className="px-8 md:px-16 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">Causal Regions</p>
          <h2 className="text-3xl font-black mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Penrose Diagram Regions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs tracking-widest uppercase">
                  <th className="text-left py-3 pr-6">Region</th>
                  <th className="text-left py-3 pr-6">Radial range</th>
                  <th className="text-left py-3 pr-6">Character</th>
                  <th className="text-left py-3 pr-6">Worldlines</th>
                  <th className="text-left py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { region: "I — Exterior",         range: "r > r₊",       char: "Static",      wl: "Observer origin, signals sent",  note: "Asymptotically flat; no M-H events", color: "#00E5FF" },
                  { region: "II — Between horizons", range: "r₋ < r < r₊",  char: "Dynamic",     wl: "λ spirals here (infinite τ)",     note: "r is timelike; all future-directed paths reach r₋", color: "#FFB347" },
                  { region: "III — Inner horizon",   range: "r < r₋",       char: "Cauchy",      wl: "M-H event p lives here",         note: "Beyond Cauchy horizon; predictability breaks down", color: "#B464FF" },
                ].map(row => (
                  <tr key={row.region}>
                    <td className="py-3 pr-6 font-mono text-xs" style={{ color: row.color }}>{row.region}</td>
                    <td className="py-3 pr-6 text-white/70 font-mono text-xs">{row.range}</td>
                    <td className="py-3 pr-6 text-white/60 text-xs">{row.char}</td>
                    <td className="py-3 pr-6 text-white/60 text-xs">{row.wl}</td>
                    <td className="py-3 text-white/40 text-xs">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="px-8 md:px-16 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">Key Concepts</p>
          <h2 className="text-3xl font-black mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            What Makes M-H Spacetimes Special
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { cat: "Causal Structure",  color: "#00E5FF", title: "Infinite past in finite time",   body: "The entire infinite worldline λ lies in the causal past J⁻(p) of a single event, compressing infinite history into a finite observer journey." },
              { cat: "Causal Structure",  color: "#00E5FF", title: "Cauchy horizon",                 body: "The boundary of the M-H region is a Cauchy horizon — a surface beyond which classical predictability of general relativity fails." },
              { cat: "Causal Structure",  color: "#00E5FF", title: "Kerr inner horizon",             body: "In Kerr spacetime the inner horizon r₋ = M − √(M²−a²) is the Cauchy horizon. It exists for any spin a > 0." },
              { cat: "Computation",       color: "#FFB347", title: "Hypercomputation",               body: "Tasks undecidable by ordinary Turing machines — including the Halting Problem — become decidable using an M-H spacetime as a physical oracle." },
              { cat: "Computation",       color: "#FFB347", title: "Relativistic Turing machine",    body: "The computer travels on λ, computing for infinite proper time. Its signal — if it halts — reaches p before the observer arrives." },
              { cat: "Computation",       color: "#FFB347", title: "Signal propagation",             body: "Any signal sent from λ at any point in its infinite history can reach p, since all of λ lies in J⁻(p) by the M-H definition." },
              { cat: "Physics",           color: "#B464FF", title: "Mass inflation",                 body: "Infalling radiation is blueshifted to infinite energy near r₋, creating a null singularity that destabilises the inner horizon in realistic black holes." },
              { cat: "Physics",           color: "#B464FF", title: "Strong cosmic censorship",       body: "Penrose's conjecture that physically reasonable spacetimes are globally hyperbolic would rule out M-H spacetimes — an open problem in GR." },
              { cat: "Physics",           color: "#B464FF", title: "Quantum gravity",                body: "Quantum effects near the Cauchy horizon are expected to resolve the mass inflation singularity, potentially restoring or destroying the M-H property." },
            ].map(c => (
              <div key={c.title} className="border p-5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                style={{ borderColor: c.color + "33" }}>
                <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: c.color }}>{c.cat}</p>
                <h4 className="text-white text-sm font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{c.title}</h4>
                <p className="text-white/50 text-xs leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Undecidable Problems in Physics ── */}
      <section className="px-8 md:px-16 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">Broader Context</p>
          <h2 className="text-3xl font-black mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Undecidable Problems in Physics
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10 max-w-3xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            M-H spacetimes are one entry in a growing catalogue of physical systems whose behaviour is provably undecidable —
            meaning no algorithm can determine the answer in general, regardless of computational resources.
            Each result below reduces a known undecidable mathematical problem (Halting Problem, tiling, etc.) to a question about a physical system.
          </p>
          <div className="space-y-6">

            {/* Problem 1 — Spectral Gap */}
            <div className="border border-white/10 bg-white/[0.02] p-6 grid md:grid-cols-[1fr_2fr] gap-6">
              <div>
                <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "#00E5FF" }}>Quantum Many-Body Physics</p>
                <h3 className="text-white text-lg font-black mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Spectral Gap Problem
                </h3>
                <p className="text-white/40 text-xs font-mono">Cubitt, Perez-Garcia & Wolf (2015)</p>
                <a href="https://doi.org/10.1038/nature16059" target="_blank" rel="noopener noreferrer"
                  className="text-cyan-400/60 hover:text-cyan-300 transition-colors text-xs font-mono block mt-1">doi:10.1038/nature16059</a>
                <p className="text-white/30 text-xs mt-2 font-mono">Nature 528, 207–211</p>
                <p className="text-white/30 text-xs font-mono">arXiv:1502.04135</p>
              </div>
              <div className="space-y-3">
                <p className="text-white/70 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Given the Hamiltonian of a quantum many-body system on a 2D lattice with translationally invariant nearest-neighbour interactions,
                  it is <strong className="text-white">undecidable</strong> whether the system has a <em>spectral gap</em> — the energy difference between
                  the ground state and first excited state.
                </p>
                <p className="text-white/50 text-xs leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  The proof encodes a quantum phase-estimation algorithm followed by a universal Turing machine into the ground state of a Hamiltonian,
                  so the spectral gap depends on whether the Turing machine halts. This implies there exist models for which the presence or absence
                  of a spectral gap is <em>independent of the axioms of mathematics</em> — a result with direct implications for the Yang–Mills gap
                  conjecture and the Haldane conjecture.
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="text-center">
                    <p className="text-cyan-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>220</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Citations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-cyan-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>2015</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Nature</p>
                  </div>
                  <div className="text-center">
                    <p className="text-cyan-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>2D</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Lattice</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem 2 — Ray Tracing */}
            <div className="border border-white/10 bg-white/[0.02] p-6 grid md:grid-cols-[1fr_2fr] gap-6">
              <div>
                <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "#FFB347" }}>Optics / Computational Geometry</p>
                <h3 className="text-white text-lg font-black mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Ray Tracing Problem
                </h3>
                <p className="text-white/40 text-xs font-mono">Reif, Tygar & Yoshida (1994)</p>
                <a href="https://doi.org/10.1007/BF01200497" target="_blank" rel="noopener noreferrer"
                  className="text-amber-400/60 hover:text-amber-300 transition-colors text-xs font-mono block mt-1">doi:10.1007/BF01200497</a>
                <p className="text-white/30 text-xs mt-2 font-mono">Comput. Geom. 1(1), 1–14</p>
                <a href="https://users.cs.duke.edu/~reif/paper/tygar/raytracing.pdf" target="_blank" rel="noopener noreferrer"
                  className="text-amber-400/40 hover:text-amber-300 transition-colors text-xs font-mono block mt-1">PDF (Duke CS)</a>
              </div>
              <div className="space-y-3">
                <p className="text-white/70 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  In a 3-dimensional system of reflective or refractive objects, it is <strong className="text-white">undecidable</strong> whether
                  a light ray beginning at a given position and direction eventually reaches a specified target point.
                </p>
                <p className="text-white/50 text-xs leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  The proof constructs a system of mirrors that simulates a Turing machine: each reflection corresponds to a computational step,
                  and the ray reaches the target if and only if the machine halts. This is directly relevant to the Kerr black hole ray tracer
                  in this project — in principle, a sufficiently complex optical system could encode undecidable computations into photon paths.
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="text-center">
                    <p className="text-amber-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>3D</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">System</p>
                  </div>
                  <div className="text-center">
                    <p className="text-amber-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>1994</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Comput. Geom.</p>
                  </div>
                  <div className="text-center">
                    <p className="text-amber-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>PSPACE</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Hard (finite)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem 3 — Fluid Particle Paths */}
            <div className="border border-white/10 bg-white/[0.02] p-6 grid md:grid-cols-[1fr_2fr] gap-6">
              <div>
                <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "#B464FF" }}>Fluid Dynamics / Topology</p>
                <h3 className="text-white text-lg font-black mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Euler Flow Reachability
                </h3>
                <p className="text-white/40 text-xs font-mono">Cardona, Miranda, Peralta-Salas & Presas (2021)</p>
                <a href="https://doi.org/10.1073/pnas.2026818118" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400/60 hover:text-violet-300 transition-colors text-xs font-mono block mt-1">doi:10.1073/pnas.2026818118</a>
                <p className="text-white/30 text-xs mt-2 font-mono">PNAS 118(19), e2026818118</p>
                <a href="https://arxiv.org/abs/2012.12828" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400/40 hover:text-violet-300 transition-colors text-xs font-mono block mt-1">arXiv:2012.12828</a>
              </div>
              <div className="space-y-3">
                <p className="text-white/70 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  It is <strong className="text-white">undecidable</strong> whether a particle path of an ideal (Euler) fluid on a 3D domain
                  eventually reaches a specified region in space.
                </p>
                <p className="text-white/50 text-xs leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  The authors construct a stationary Euler flow on a Riemannian S³ that is Turing complete: its particle trajectories simulate
                  any Turing machine via a Poincaré map on a cross-section. The reachability question for a particle is therefore equivalent
                  to the Halting Problem. The proof fuses symbolic dynamics, contact topology (Reeb fields), and the Reeb–Beltrami correspondence.
                  A companion paper (Cardona et al., <em>J. Math. Pures Appl.</em> 169, 2023) extends the result to Euclidean space.
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="text-center">
                    <p className="text-violet-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>2021</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">PNAS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-violet-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>S³</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Domain</p>
                  </div>
                  <div className="text-center">
                    <p className="text-violet-400 text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Euler</p>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase">Equations</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Connection to M-H */}
          <div className="mt-8 border-l-4 pl-6" style={{ borderColor: "#B464FF" }}>
            <p className="text-violet-400 text-xs tracking-widest uppercase mb-2">Connection to M-H Hypercomputation</p>
            <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Each of these results demonstrates that a physical system can encode the Halting Problem — but none of them <em>solves</em> it.
              The Malament–Hogarth spacetime goes further: it provides a physical mechanism by which an observer could <em>receive the answer</em>
              to an undecidable computation in finite proper time. Whether mass inflation at the Cauchy horizon physically prevents this
              remains the central open question connecting general relativity, quantum gravity, and the theory of computation.
            </p>
          </div>
        </div>
      </section>

      {/* ── References / CTA ── */}
      <section className="px-8 md:px-16 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <p className="text-white/40 text-xs tracking-widest uppercase mb-4">Peer-Reviewed References</p>
            <div className="space-y-5 text-xs leading-relaxed">

              {/* [1] Hogarth 1992 — foundational paper coining M-H spacetimes */}
              <div className="border-l-2 border-violet-400/40 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-violet-400 mr-1">[1]</span>
                  Hogarth, M. L. (1992). Does general relativity allow an observer to view an eternity in a finite time?
                  <em className="text-white/50"> Foundations of Physics Letters</em>, <strong className="text-white/60">5</strong>(2), 173–181.
                </p>
                <a href="https://doi.org/10.1007/BF00682813" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400/60 hover:text-violet-300 transition-colors">doi:10.1007/BF00682813</a>
                <p className="text-white/30 mt-0.5">Introduces the M-H spacetime concept; shows anti-de Sitter spacetime is an example.</p>
              </div>

              {/* [2] Earman & Norton 1993 — supertasks analysis */}
              <div className="border-l-2 border-cyan-400/40 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-cyan-400 mr-1">[2]</span>
                  Earman, J. &amp; Norton, J. D. (1993). Forever is a day: Supertasks in Pitowsky and Malament–Hogarth spacetimes.
                  <em className="text-white/50"> Philosophy of Science</em>, <strong className="text-white/60">60</strong>(1), 22–42.
                </p>
                <a href="https://doi.org/10.1086/289716" target="_blank" rel="noopener noreferrer"
                  className="text-cyan-400/60 hover:text-cyan-300 transition-colors">doi:10.1086/289716</a>
                <p className="text-white/30 mt-0.5">Analyses physical feasibility of supertasks in M-H spacetimes; 226 citations.</p>
              </div>

              {/* [3] Hogarth 1994 — hypercomputation protocol */}
              <div className="border-l-2 border-amber-400/40 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-amber-400 mr-1">[3]</span>
                  Hogarth, M. (1994). Non-Turing computers and non-Turing computability.
                  <em className="text-white/50"> PSA: Proceedings of the Biennial Meeting of the Philosophy of Science Association</em>, <strong className="text-white/60">1</strong>, 126–138.
                </p>
                <a href="https://doi.org/10.1086/psaprocbienmeetp.1994.1.193018" target="_blank" rel="noopener noreferrer"
                  className="text-amber-400/60 hover:text-amber-300 transition-colors">doi:10.1086/psaprocbienmeetp.1994.1.193018</a>
                <p className="text-white/30 mt-0.5">Shows any arithmetic statement is decidable in a suitable M-H spacetime.</p>
              </div>

              {/* [4] Etesi & Németi 2002 — Kerr black holes and hypercomputation */}
              <div className="border-l-2 border-violet-400/40 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-violet-400 mr-1">[4]</span>
                  Etesi, G. &amp; Németi, I. (2002). Non-Turing computations via Malament–Hogarth space-times.
                  <em className="text-white/50"> International Journal of Theoretical Physics</em>, <strong className="text-white/60">41</strong>(2), 341–370.
                </p>
                <a href="https://doi.org/10.1023/A:1014019225365" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400/60 hover:text-violet-300 transition-colors">doi:10.1023/A:1014019225365</a>
                <p className="text-white/30 mt-0.5">Proves rotating Kerr black holes are M-H spacetimes; 297 citations.</p>
              </div>

              {/* [5] Poisson & Israel 1990 — mass inflation */}
              <div className="border-l-2 border-white/20 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-white/40 mr-1">[5]</span>
                  Poisson, E. &amp; Israel, W. (1990). Internal structure of black holes.
                  <em className="text-white/50"> Physical Review D</em>, <strong className="text-white/60">41</strong>(6), 1796–1809.
                </p>
                <a href="https://doi.org/10.1103/PhysRevD.41.1796" target="_blank" rel="noopener noreferrer"
                  className="text-white/30 hover:text-white/60 transition-colors">doi:10.1103/PhysRevD.41.1796</a>
                <p className="text-white/30 mt-0.5">Discovers mass inflation: infalling radiation is blueshifted to infinite energy near r₋.</p>
              </div>

              {/* [6] Dafermos 2003 — Cauchy horizon stability */}
              <div className="border-l-2 border-white/20 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-white/40 mr-1">[6]</span>
                  Dafermos, M. (2003). Stability and instability of the Cauchy horizon for the spherically symmetric Einstein–Maxwell–scalar field equations.
                  <em className="text-white/50"> Annals of Mathematics</em>, <strong className="text-white/60">158</strong>(3), 875–928.
                </p>
                <a href="https://doi.org/10.4007/annals.2003.158.875" target="_blank" rel="noopener noreferrer"
                  className="text-white/30 hover:text-white/60 transition-colors">doi:10.4007/annals.2003.158.875</a>
                <p className="text-white/30 mt-0.5">Rigorous analysis of Cauchy horizon stability; 215 citations.</p>
              </div>

              {/* [7] Welch 2008 — extent of computation */}
              <div className="border-l-2 border-cyan-400/40 pl-3">
                <p className="text-white/70 mb-0.5">
                  <span className="text-cyan-400 mr-1">[7]</span>
                  Welch, P. D. (2008). Turing unbound: On the extent of computation in Malament–Hogarth spacetimes.
                  <em className="text-white/50"> The British Journal for the Philosophy of Science</em>, <strong className="text-white/60">59</strong>(4), 659–674.
                </p>
                <a href="https://doi.org/10.1093/bjps/axn031" target="_blank" rel="noopener noreferrer"
                  className="text-cyan-400/60 hover:text-cyan-300 transition-colors">doi:10.1093/bjps/axn031</a>
                <p className="text-white/30 mt-0.5">Shows M-H spacetimes can resolve all hyperarithmetic (Borel) statements — far beyond arithmetic.</p>
              </div>

            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs tracking-widest uppercase mb-4">Related Simulation</p>
            <p className="text-white/60 text-sm leading-relaxed mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              The Kerr black hole ray tracer in this project simulates null geodesics in the same Kerr spacetime
              that hosts M-H events — using a WebGPU compute pipeline with WGSL shader and WebGL2 fallback.
            </p>
            <a href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs tracking-widest uppercase transition-colors"
              style={{ border: "1px solid #00E5FF", color: "#00E5FF" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,229,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              ← Back to Kerr Ray Tracer
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 md:px-16 py-6 flex items-center justify-between text-xs text-white/20">
        <span>Malament–Hogarth Spacetime — Interactive Showcase</span>
        <span>WebGL2 · React · Space Grotesk</span>
      </footer>
    </div>
  );
}
