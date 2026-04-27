/**
 * Gargantua — Kerr Black Hole WebGPU Showcase Page
 * Design: Deep-Space Instrument aesthetic
 * Colors: #000005 bg, electric cyan #00E5FF accents, amber #FFB347 disk accents
 * Typography: Space Grotesk (display/body) + Space Mono (labels/equations)
 * Layout: Asymmetric, left-anchored, instrument-panel density
 */

import { useEffect, useRef } from "react";
import BlackholeGL from "@/components/BlackholeGL";

// ── Scroll-reveal hook ──────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Reticle canvas (subtle animated grid) ──────────────────────────────────
function ReticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    let t = 0;
    const draw = () => {
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      ctx.clearRect(0, 0, w, h);
      const spacing = 80;
      ctx.strokeStyle = `rgba(0,229,255,${0.04 + 0.015 * Math.sin(t * 0.4)})`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      const cx = w / 2, cy = h / 2;
      ctx.strokeStyle = `rgba(0,229,255,${0.12 + 0.04 * Math.sin(t * 0.5)})`;
      ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40); ctx.stroke();
      const bSize = 20, bOff = 32;
      ctx.strokeStyle = `rgba(0,229,255,0.18)`;
      ctx.lineWidth = 1;
      ([[bOff, bOff, 1, 1], [w - bOff, bOff, -1, 1], [bOff, h - bOff, 1, -1], [w - bOff, h - bOff, -1, -1]] as [number, number, number, number][]).forEach(
        ([bx, by, sx, sy]) => {
          ctx.beginPath();
          ctx.moveTo(bx, by + sy * bSize);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + sx * bSize, by);
          ctx.stroke();
        }
      );
      t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({
  label, title, desc, accent = "cyan", delay = 0,
}: {
  label: string; title: string; desc: string; accent?: "cyan" | "amber"; delay?: number;
}) {
  const borderColor = accent === "cyan" ? "border-cyan-500/30 hover:border-cyan-400/60" : "border-amber-500/30 hover:border-amber-400/60";
  const labelColor = accent === "cyan" ? "text-cyan-400/60" : "text-amber-400/60";
  const titleColor = accent === "cyan" ? "text-cyan-100" : "text-amber-100";
  const glowColor = accent === "cyan" ? "hover:bg-cyan-500/[0.04]" : "hover:bg-amber-500/[0.04]";
  const leftBorder = accent === "cyan" ? "border-l-cyan-500/50 hover:border-l-cyan-400" : "border-l-amber-500/50 hover:border-l-amber-400";
  return (
    <div className={`reveal reveal-delay-${delay} group p-5 border border-l-2 ${borderColor} ${leftBorder} ${glowColor} transition-all duration-300 bg-white/[0.02]`}>
      <div className={`font-mono text-[9px] tracking-[0.3em] uppercase mb-2 ${labelColor}`}>{label}</div>
      <div className={`font-semibold text-sm mb-2 ${titleColor}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</div>
      <div className="text-white/45 text-xs leading-relaxed">{desc}</div>
    </div>
  );
}

// ── Physics equation row ─────────────────────────────────────────────────────
function PhysicsRow({ label, eq, note }: { label: string; eq: string; note: string }) {
  return (
    <div className="reveal group border-b border-cyan-500/[0.07] py-4 last:border-b-0">
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
        <div className="font-mono text-[9px] tracking-widest uppercase text-cyan-500/50 w-32 shrink-0">{label}</div>
        <div className="eq-block flex-1">{eq}</div>
      </div>
      <div className="text-white/35 text-xs mt-2 pl-0 sm:pl-36 leading-relaxed">{note}</div>
    </div>
  );
}

// ── Stat badge ───────────────────────────────────────────────────────────────
function StatBadge({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="reveal border border-cyan-500/15 p-4 bg-cyan-950/10">
      <div className="font-mono text-2xl font-bold text-cyan-300 tabular-nums">
        {value}<span className="text-sm text-cyan-500/60 ml-1">{unit}</span>
      </div>
      <div className="text-white/35 text-[10px] tracking-widest uppercase mt-1 font-mono">{label}</div>
    </div>
  );
}

// ── Live Demo Section ────────────────────────────────────────────────────────
function LiveDemo() {
  return (
    <section id="demo" className="py-0">
      {/* Section header */}
      <div className="container py-16">
        <div className="section-label mb-4 reveal">Interactive Demo</div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h2
              className="text-3xl font-bold text-white mb-3 reveal reveal-delay-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
            >
              Run the Simulation
            </h2>
            <p className="text-white/45 text-sm leading-relaxed max-w-xl reveal reveal-delay-2">
              The full WebGL2 ray tracer runs live below — drag to orbit the camera, scroll to zoom,
              and adjust every physics parameter in real time via the left panel.
            </p>
          </div>
          <div className="flex items-center gap-2 reveal reveal-delay-3 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <div className="font-mono text-[9px] tracking-widest uppercase text-white/25">
              Live · WebGL2
            </div>
          </div>
        </div>
      </div>

      {/* Native WebGL2 simulation */}
      <div className="border-y border-cyan-500/15">
        <BlackholeGL />
      </div>

      {/* Controls hint strip */}
      <div className="border-b border-cyan-500/10 bg-black/60">
        <div className="container py-3 flex flex-wrap items-center gap-6">
          {[
            ["Drag", "Orbit camera"],
            ["Scroll", "Zoom in / out"],
            ["Controls panel", "Toggle left panel"],
            ["⏸ Pause", "Pause / resume"],
            ["↺ Reset", "Reset defaults"],
            ["⤢ Full", "Fullscreen mode"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-cyan-400/50 border border-cyan-500/20 px-1.5 py-0.5">{key}</span>
              <span className="text-white/30">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  useReveal();

  return (
    <div className="min-h-screen" style={{ background: "#000005", fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Top navigation bar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-cyan-500/10 bg-black/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400/70">GARGANTUA</span>
        </div>
        <div className="hidden md:flex items-center gap-6 font-mono text-[10px] tracking-widest uppercase text-white/30">
          <a href="#demo" className="hover:text-cyan-400/70 transition-colors">Demo</a>
          <a href="#physics" className="hover:text-cyan-400/70 transition-colors">Physics</a>
          <a href="#features" className="hover:text-cyan-400/70 transition-colors">Features</a>
          <a href="#rendering" className="hover:text-cyan-400/70 transition-colors">Rendering</a>
          <a href="#source" className="hover:text-cyan-400/70 transition-colors">Source</a>
          <a href="/mh" className="hover:text-violet-400/70 transition-colors" style={{color:"rgba(180,100,255,0.6)"}}>M-H Spacetime</a>
        </div>
        <a
          href="https://github.com/randommysticalperson/kerr-blackhole-webgpu"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/60 transition-all duration-200 font-mono text-[10px] tracking-widest uppercase"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </nav>

      {/* ── Hero section ── */}
      <section className="relative min-h-screen flex items-end overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img
            src="/manus-storage/showcase_hero_43645c3d.png"
            alt="Kerr black hole with accretion disk"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(105deg, rgba(0,0,5,0.92) 0%, rgba(0,0,5,0.75) 40%, rgba(0,0,5,0.2) 70%, rgba(0,0,5,0.05) 100%)"
          }} />
          <div className="absolute bottom-0 left-0 right-0 h-48" style={{
            background: "linear-gradient(to top, #000005 0%, transparent 100%)"
          }} />
        </div>
        <ReticleCanvas />
        <div className="grain-overlay" />
        <div className="relative z-10 container pb-24 pt-32">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="section-label">Real-time WebGPU Simulation</div>
              <div className="font-mono text-[9px] text-white/20 tracking-widest">arXiv:1502.03808</div>
            </div>
            <h1
              className="font-bold leading-none mb-2 text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(3rem, 8vw, 6rem)", letterSpacing: "-0.02em" }}
            >
              GARGANTUA
            </h1>
            <div className="font-mono text-xs tracking-[0.3em] text-cyan-400/60 uppercase mb-6">
              Kerr Black Hole Ray Tracer
            </div>
            <p className="text-white/55 text-base leading-relaxed mb-8 max-w-lg">
              A physically-based simulation of a rotating Kerr black hole running entirely in the browser.
              Null geodesic integration, relativistic Doppler beaming, and gravitational lensing —
              rendered in real time via WebGPU compute shaders.
            </p>
            <div className="flex flex-wrap gap-4 mb-10 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-white/30">
                <span className="text-cyan-500/50">a</span>
                <span className="text-cyan-300/70 tabular-nums">= 0.998 M</span>
              </div>
              <div className="text-white/15">·</div>
              <div className="flex items-center gap-2 text-white/30">
                <span className="text-cyan-500/50">r₊</span>
                <span className="text-cyan-300/70 tabular-nums">= 1.063 M</span>
              </div>
              <div className="text-white/15">·</div>
              <div className="flex items-center gap-2 text-white/30">
                <span className="text-amber-500/50">r_ISCO</span>
                <span className="text-amber-300/70 tabular-nums">= 1.237 M</span>
              </div>
              <div className="text-white/15">·</div>
              <div className="flex items-center gap-2 text-white/30">
                <span className="text-white/30">renderer</span>
                <span className="text-cyan-300/70">WebGPU / WebGL2</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#demo"
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/70 transition-all duration-200 font-mono text-xs tracking-widest uppercase"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Try the Demo
              </a>
              <a
                href="https://github.com/randommysticalperson/kerr-blackhole-webgpu"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 border border-white/15 text-white/50 hover:border-white/30 hover:text-white/70 transition-all duration-200 font-mono text-xs tracking-widest uppercase"
              >
                View Source
              </a>
              <a
                href="https://arxiv.org/abs/1502.03808"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white/35 hover:border-white/20 hover:text-white/55 transition-all duration-200 font-mono text-xs tracking-widest uppercase"
              >
                arXiv Paper
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 flex flex-col items-center gap-2 text-white/20">
          <div className="font-mono text-[9px] tracking-widest uppercase">Scroll</div>
          <div className="w-px h-12 bg-gradient-to-b from-cyan-500/30 to-transparent" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-cyan-500/10 bg-black/40">
        <div className="container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-cyan-500/10">
            {[
              { value: "RK2", unit: "", label: "Geodesic Integrator" },
              { value: "1024", unit: "steps", label: "Max Lensing Steps" },
              { value: "8×8", unit: "wg", label: "WebGPU Workgroup" },
              { value: "ACES", unit: "TM", label: "Tone Mapping" },
            ].map((s, i) => (
              <div key={i} className="bg-[#000005] p-5">
                <StatBadge {...s} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Demo ── */}
      <LiveDemo />

      <hr className="hairline" />

      {/* ── Physics section ── */}
      <section id="physics" className="py-24">
        <div className="container">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-start">
            <div>
              <div className="section-label mb-4 reveal">Spacetime Physics</div>
              <h2
                className="text-3xl font-bold text-white mb-3 reveal reveal-delay-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
              >
                Kerr Metric Geodesics
              </h2>
              <p className="text-white/45 text-sm leading-relaxed mb-10 max-w-lg reveal reveal-delay-2">
                Photon trajectories are computed by integrating null geodesics through the Kerr spacetime geometry.
                The Boyer-Lindquist radial coordinate is solved from Cartesian coordinates via a quartic equation,
                enabling the full Christoffel-symbol acceleration to be evaluated per step.
              </p>
              <div className="space-y-0 border-t border-cyan-500/[0.07]">
                <PhysicsRow label="Kerr Metric" eq="Σ = r² + a²cos²θ    Δ = r² − 2Mr + a²" note="Σ and Δ are the fundamental Kerr metric functions. M is mass, a is specific angular momentum (spin)." />
                <PhysicsRow label="Null Geodesic" eq="H = ½ g^μν p_μ p_ν = 0" note="Photons follow null geodesics where the Hamiltonian vanishes. Integrated via 2nd-order Runge-Kutta." />
                <PhysicsRow label="Frame Drag" eq="dragAcc = (2Ma·r / Σ²) × (φ̂ × v)" note="Lense-Thirring frame dragging couples the photon velocity to the azimuthal direction, bending paths around the spin axis." />
                <PhysicsRow label="Event Horizon" eq="r₊ = M + √(M² − a²)" note="Outer event horizon radius. For a = 0 (Schwarzschild): r₊ = 2M. For a → M (extremal Kerr): r₊ → M." />
                <PhysicsRow label="ISCO (prograde)" eq="r_ISCO = M(3 + Z₂ − √((3−Z₁)(3+Z₁+2Z₂)))" note="Innermost stable circular orbit for prograde orbits (Bardeen 1972). Sets the inner edge of the accretion disk." />
                <PhysicsRow label="Doppler Factor" eq="D = 1 / (1 − β cosθ)    I_obs = I_emit · D³" note="Relativistic Doppler beaming. The approaching disk side (D > 1) brightens dramatically; the receding side dims." />
              </div>
            </div>
            <div className="lg:sticky lg:top-24 reveal reveal-delay-2">
              <div className="relative">
                <img
                  src="/manus-storage/showcase_lensing_0aeba009.png"
                  alt="Gravitational lensing detail"
                  className="w-full aspect-square object-cover"
                  style={{ filter: "brightness(0.9) contrast(1.05)" }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="font-mono text-[9px] tracking-widest uppercase text-cyan-500/60 mb-1">Gravitational Lensing</div>
                  <div className="text-white/40 text-[10px] leading-relaxed">
                    The photon ring (thin cyan arc) marks the boundary of the black hole shadow.
                    Doppler asymmetry: blue-white left (approaching), amber right (receding).
                  </div>
                </div>
                <div className="absolute top-3 left-3 w-5 h-5 border-t border-l border-cyan-500/40" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t border-r border-cyan-500/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="hairline" />

      {/* ── Features section ── */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="section-label mb-4 reveal">Simulation Features</div>
          <h2
            className="text-3xl font-bold text-white mb-3 reveal reveal-delay-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            What the Renderer Computes
          </h2>
          <p className="text-white/45 text-sm leading-relaxed mb-12 max-w-xl reveal reveal-delay-2">
            Every frame is computed from first principles. No pre-baked textures, no approximations —
            each pixel traces a photon path through curved spacetime.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <FeatureCard label="Spacetime · Geodesics" title="Null Geodesic Integration" desc="Photon paths are integrated using RK2 through the Kerr metric. Boyer-Lindquist r is solved from Cartesian coordinates via a quartic at each step." accent="cyan" delay={1} />
            <FeatureCard label="Spacetime · Rotation" title="Frame Dragging" desc="Lense-Thirring coupling bends photon trajectories around the spin axis. Controlled by the dimensionless spin parameter a/M ∈ [0, 1)." accent="cyan" delay={2} />
            <FeatureCard label="Spacetime · Lensing" title="Gravitational Lensing" desc="Photons near the photon sphere (r ≈ 3M) orbit the black hole multiple times, producing Einstein rings, multiple images, and the black hole shadow." accent="cyan" delay={3} />
            <FeatureCard label="Disk · Structure" title="Thin Accretion Disk" desc="A Shakura-Sunyaev thin disk between configurable inner/outer radii. The inner edge is set at the prograde ISCO. FBM noise creates turbulent ring patterns." accent="amber" delay={1} />
            <FeatureCard label="Disk · Temperature" title="Blackbody Radiation" desc="Temperature follows T(r) ∝ r^(−3/4). Inner disk (~10,000 K) glows blue-white; outer disk (~3,000 K) glows orange-red, following Wien's displacement law." accent="amber" delay={2} />
            <FeatureCard label="Disk · Relativity" title="Doppler Beaming" desc="Relativistic Doppler factor D = 1/(1 − β cosθ) modulates intensity as I_obs = I_emit · D³. The approaching side blazes; the receding side dims." accent="amber" delay={3} />
            <FeatureCard label="Rendering · Background" title="Procedural Star Field" desc="Hash-based noise generates a dense background star field. Star density and brightness are independently controllable parameters." accent="cyan" delay={1} />
            <FeatureCard label="Rendering · Tone" title="ACES Filmic Tone Mapping" desc="ACES filmic operator followed by sRGB gamma correction (γ = 2.2). Preserves highlight detail while mapping the wide HDR range to display output." accent="cyan" delay={2} />
            <FeatureCard label="Rendering · Fallback" title="WebGL2 Fallback" desc="Identical Kerr physics ported to a GLSL 300 es fragment shader for browsers without WebGPU. Auto-detected at runtime with a renderer badge." accent="cyan" delay={3} />
          </div>
        </div>
      </section>

      <hr className="hairline" />

      {/* ── Rendering pipeline section ── */}
      <section id="rendering" className="py-24">
        <div className="container">
          <div className="grid lg:grid-cols-[420px_1fr] gap-16 items-start">
            <div className="reveal">
              <div className="relative">
                <img
                  src="/manus-storage/showcase_wide_cc8b13b3.png"
                  alt="Wide view of Kerr black hole with accretion disk"
                  className="w-full object-cover"
                  style={{ aspectRatio: "4/3", filter: "brightness(0.85) contrast(1.1)" }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="font-mono text-[9px] tracking-widest uppercase text-amber-500/60 mb-1">Accretion Disk</div>
                  <div className="text-white/40 text-[10px] leading-relaxed">
                    Amber outer disk transitions to blue-white near the event horizon.
                    The asymmetric brightness is a direct signature of Doppler beaming.
                  </div>
                </div>
                <div className="absolute top-3 left-3 w-5 h-5 border-t border-l border-amber-500/40" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t border-r border-amber-500/40" />
              </div>
            </div>
            <div>
              <div className="section-label mb-4 reveal">Architecture</div>
              <h2
                className="text-3xl font-bold text-white mb-3 reveal reveal-delay-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
              >
                Rendering Pipeline
              </h2>
              <p className="text-white/45 text-sm leading-relaxed mb-8 reveal reveal-delay-2">
                The WebGPU path dispatches a compute shader over the full canvas resolution.
                Each invocation traces one pixel's photon path independently, making the workload
                embarrassingly parallel across the GPU.
              </p>
              <div className="space-y-0 reveal reveal-delay-2">
                {[
                  { step: "01", title: "Screen → Ray", desc: "Each pixel maps to a ray direction via the camera's spherical coordinate system (r, θ, φ). FOV ≈ 55°.", color: "cyan" },
                  { step: "02", title: "RK2 Integration", desc: "The ray is stepped through Kerr spacetime using a 2nd-order Runge-Kutta integrator. Each step evaluates the full gravitational + frame-drag acceleration.", color: "cyan" },
                  { step: "03", title: "Disk Crossing", desc: "Sign changes in the y-coordinate detect equatorial plane crossings. Accretion disk color, opacity, and Doppler factor are accumulated per crossing.", color: "amber" },
                  { step: "04", title: "Horizon Capture", desc: "Rays reaching r < 1.05 r₊ are absorbed. The resulting black region forms the characteristic shadow of the black hole.", color: "cyan" },
                  { step: "05", title: "Star Field + Tone Map", desc: "Escaped rays sample the procedural star field. The final HDR color is tone-mapped with ACES filmic and gamma-corrected to sRGB.", color: "cyan" },
                ].map(({ step, title, desc, color }) => (
                  <div key={step} className="flex gap-5 py-5 border-b border-cyan-500/[0.07] last:border-b-0">
                    <div className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color: color === "amber" ? "rgba(255,179,71,0.5)" : "rgba(0,229,255,0.4)" }}>{step}</div>
                    <div>
                      <div className="font-semibold text-sm mb-1" style={{ color: color === "amber" ? "rgba(255,179,71,0.9)" : "rgba(0,229,255,0.9)" }}>{title}</div>
                      <div className="text-white/40 text-xs leading-relaxed">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 border border-cyan-500/15 bg-cyan-950/10 reveal reveal-delay-3">
                <div className="font-mono text-[9px] tracking-widest uppercase text-cyan-500/50 mb-3">WebGPU Compute Shader</div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  {[
                    ["Workgroup size", "8 × 8 threads"],
                    ["Dispatch", "ceil(W/8) × ceil(H/8)"],
                    ["Output", "storageTexture (RGBA8)"],
                    ["Uniforms", "BlackholeUniforms buffer"],
                    ["Fallback", "WebGL2 GLSL 300 es"],
                    ["Detection", "navigator.gpu runtime"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-white/25">{k}</span>
                      <span className="text-cyan-300/65">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="hairline" />

      {/* ── Interactive controls section ── */}
      <section className="py-24">
        <div className="container">
          <div className="section-label mb-4 reveal">User Interface</div>
          <h2
            className="text-3xl font-bold text-white mb-3 reveal reveal-delay-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            Interactive Controls
          </h2>
          <p className="text-white/45 text-sm leading-relaxed mb-12 max-w-xl reveal reveal-delay-2">
            All physics parameters are exposed as live sliders in a collapsible instrument panel.
            Changes propagate to the GPU uniforms in real time — no recompilation required.
          </p>
          <div className="grid md:grid-cols-3 gap-px bg-cyan-500/10">
            <div className="bg-[#000005] p-6 reveal">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-cyan-500/60 mb-4 border-l-2 border-cyan-500/40 pl-2">── Spacetime</div>
              <div className="space-y-4">
                {[
                  { key: "a / M", range: "[0, 0.999]", desc: "Dimensionless spin parameter" },
                  { key: "r (camera)", range: "[5, 50] M", desc: "Observer radial distance" },
                  { key: "θ (camera)", range: "[0°, 90°]", desc: "Observer polar angle" },
                ].map(({ key, range, desc }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono text-[10px] text-cyan-400/70">{key}</span>
                      <span className="font-mono text-[9px] text-white/25">{range}</span>
                    </div>
                    <div className="h-px bg-cyan-500/10 relative">
                      <div className="absolute left-0 top-0 h-full bg-cyan-500/40" style={{ width: "72%" }} />
                    </div>
                    <div className="text-[9px] text-white/30">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#000005] p-6 reveal reveal-delay-1">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-amber-500/60 mb-4 border-l-2 border-amber-500/40 pl-2">── Accretion Disk</div>
              <div className="space-y-4">
                {[
                  { key: "r_inner", range: "[1, 6] M", desc: "Inner disk radius (ISCO)" },
                  { key: "r_outer", range: "[6, 20] M", desc: "Outer disk radius" },
                  { key: "T_peak", range: "[3000, 30000] K", desc: "Peak disk temperature" },
                  { key: "Doppler", range: "[0, 2]", desc: "Beaming strength exponent" },
                  { key: "Turbulence", range: "[0, 1]", desc: "FBM noise amplitude" },
                ].map(({ key, range, desc }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono text-[10px] text-amber-400/70">{key}</span>
                      <span className="font-mono text-[9px] text-white/25">{range}</span>
                    </div>
                    <div className="h-px bg-amber-500/10 relative">
                      <div className="absolute left-0 top-0 h-full bg-amber-500/40" style={{ width: "55%" }} />
                    </div>
                    <div className="text-[9px] text-white/30">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#000005] p-6 reveal reveal-delay-2">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-white/30 mb-4 border-l-2 border-white/20 pl-2">── Rendering</div>
              <div className="space-y-4">
                {[
                  { key: "Lensing steps", range: "[64, 1024]", desc: "Integration step count" },
                  { key: "Step size dt", range: "[0.01, 0.5]", desc: "RK2 step size in M" },
                  { key: "Star density", range: "[0, 1]", desc: "Background star density" },
                  { key: "Exposure", range: "[0.1, 5]", desc: "HDR exposure multiplier" },
                  { key: "Disk brightness", range: "[0, 3]", desc: "Disk luminosity scale" },
                ].map(({ key, range, desc }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono text-[10px] text-white/50">{key}</span>
                      <span className="font-mono text-[9px] text-white/25">{range}</span>
                    </div>
                    <div className="h-px bg-white/10 relative">
                      <div className="absolute left-0 top-0 h-full bg-white/30" style={{ width: "40%" }} />
                    </div>
                    <div className="text-[9px] text-white/30">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="hairline" />

      {/* ── Source / CTA section ── */}
      <section id="source" className="py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-label mb-4 reveal">Open Source</div>
              <h2
                className="text-3xl font-bold text-white mb-4 reveal reveal-delay-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
              >
                Built in the Open
              </h2>
              <p className="text-white/45 text-sm leading-relaxed mb-6 reveal reveal-delay-2">
                The full source — WGSL compute shader, WebGL2 fallback, React UI, and physics notes —
                is available on GitHub. The simulation is grounded in the peer-reviewed paper by
                James, von Tunzelmann, Franklin &amp; Thorne (2015), the same science behind the
                black hole in <em>Interstellar</em>.
              </p>
              <div className="space-y-2 mb-8 reveal reveal-delay-3">
                {[
                  ["WGSL compute shader", "client/src/shaders/blackhole.wgsl"],
                  ["WebGL2 fallback (GLSL)", "client/public/blackhole.frag"],
                  ["React UI + controls", "client/src/pages/Home.tsx"],
                  ["Physics notes", "client/src/components/PhysicsNotes.tsx"],
                ].map(([label, path]) => (
                  <div key={path} className="flex items-center gap-3 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40 shrink-0" />
                    <span className="text-white/35">{label}</span>
                    <span className="font-mono text-cyan-500/40 ml-auto text-[9px] hidden sm:block">{path}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 reveal reveal-delay-4">
                <a
                  href="https://github.com/randommysticalperson/kerr-blackhole-webgpu"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/70 transition-all duration-200 font-mono text-xs tracking-widest uppercase"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
                <a
                  href="https://arxiv.org/abs/1502.03808"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 border border-white/15 text-white/50 hover:border-white/30 hover:text-white/70 transition-all duration-200 font-mono text-xs tracking-widest uppercase"
                >
                  arXiv:1502.03808
                </a>
              </div>
            </div>
            <div className="reveal reveal-delay-2">
              <div className="border border-cyan-500/15 p-6 bg-cyan-950/10">
                <div className="font-mono text-[9px] tracking-widest uppercase text-cyan-500/50 mb-4">Scientific Reference</div>
                <blockquote className="border-l-2 border-cyan-500/40 pl-4 mb-4">
                  <p className="text-white/60 text-sm leading-relaxed italic">
                    "Visualizing Interstellar's Wormhole"
                  </p>
                </blockquote>
                <div className="text-white/55 text-sm font-semibold mb-1">James, von Tunzelmann, Franklin &amp; Thorne</div>
                <div className="text-white/30 text-xs mb-4">Classical and Quantum Gravity 32, 065001 (2015)</div>
                <div className="space-y-2 text-[10px] font-mono">
                  {[
                    ["DOI", "10.1088/0264-9381/32/6/065001"],
                    ["arXiv", "1502.03808 [gr-qc]"],
                    ["Journal", "Class. Quantum Grav. 32 (2015)"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <span className="text-white/25 w-12 shrink-0">{k}</span>
                      <span className="text-cyan-300/60">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 border border-cyan-500/10 p-5 bg-black/30">
                <div className="font-mono text-[9px] tracking-widest uppercase text-white/25 mb-3">Tech Stack</div>
                <div className="flex flex-wrap gap-2">
                  {["WebGPU", "WebGL2", "WGSL", "GLSL 300 es", "React 19", "TypeScript", "Vite 7", "TailwindCSS v4", "Framer Motion", "Space Grotesk"].map((tag) => (
                    <span key={tag} className="font-mono text-[9px] px-2 py-1 border border-cyan-500/15 text-cyan-400/50 tracking-wider">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-cyan-500/10 py-8">
        <div className="container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
            <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-white/20">
              GARGANTUA · Kerr Black Hole WebGPU
            </span>
          </div>
          <div className="font-mono text-[9px] text-white/15 tracking-wider">
            James, von Tunzelmann, Franklin &amp; Thorne · CQG 32 (2015) 065001
          </div>
          <a
            href="https://github.com/randommysticalperson/kerr-blackhole-webgpu"
            target="_blank" rel="noopener noreferrer"
            className="font-mono text-[9px] tracking-widest uppercase text-cyan-500/30 hover:text-cyan-400/60 transition-colors"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}
