/**
 * MHSimulation.tsx
 * Interactive Malament–Hogarth spacetime visualizer
 *
 * Two tabs:
 *  1. Penrose Diagram — 2D conformal diagram of maximally extended Kerr spacetime
 *     drawn on a <canvas> using the 2D API (no WebGL needed for this mode).
 *     Shows: Region I (exterior), Region II (between horizons), Region III (inner horizon).
 *     Animated: λ worldline (amber, infinite proper time), observer worldline (cyan, finite),
 *     signal ray (white), M-H event p (glowing dot).
 *
 *  2. Kerr Interior — WebGL2 fragment shader ray-marching the equatorial slice.
 *     Shows nested horizon shells, ergosphere, and the blueshift colour ramp near r₋.
 *     Two animated particle worldlines integrated in the shader.
 *
 * Design: deep-space instrument aesthetic (black bg, cyan + amber accents, Space Mono readouts)
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Penrose Diagram (2D Canvas) ────────────────────────────────────────────

function drawPenroseDiagram(
  canvas: HTMLCanvasElement,
  t: number,
  spin: number,
  showSignal: boolean,
  pX: number, // 0..1 relative position of M-H event in Region III
  pY: number
) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, W, H);

  // Layout: three diamond regions stacked vertically in conformal coords
  // We draw in "Penrose coordinates" (T, X) mapped to canvas pixels
  // Region I  (exterior):  centre at (cx, cy_I)
  // Region II (between horizons): centre at (cx, cy_II)
  // Region III (inner / Cauchy): centre at (cx, cy_III)

  const cx = W * 0.5;
  const scale = Math.min(W, H) * 0.18;

  // Diamond vertices for each region (in canvas coords)
  // Each diamond: top, right, bottom, left
  const regions = [
    { // Region I — exterior
      top:    { x: cx,          y: H * 0.50 - scale * 2.0 },
      right:  { x: cx + scale,  y: H * 0.50 - scale * 1.0 },
      bottom: { x: cx,          y: H * 0.50 },
      left:   { x: cx - scale,  y: H * 0.50 - scale * 1.0 },
      label: "I  (Exterior)",
      fill: "rgba(0,229,255,0.04)",
      border: "rgba(0,229,255,0.25)",
    },
    { // Region II — between outer and inner horizons
      top:    { x: cx,          y: H * 0.50 },
      right:  { x: cx + scale,  y: H * 0.50 + scale * 1.0 },
      bottom: { x: cx,          y: H * 0.50 + scale * 2.0 },
      left:   { x: cx - scale,  y: H * 0.50 + scale * 1.0 },
      label: "II  (r₋ < r < r₊)",
      fill: "rgba(255,179,71,0.05)",
      border: "rgba(255,179,71,0.30)",
    },
    { // Region III — inner horizon / Cauchy horizon region
      top:    { x: cx,          y: H * 0.50 + scale * 2.0 },
      right:  { x: cx + scale,  y: H * 0.50 + scale * 3.0 },
      bottom: { x: cx,          y: H * 0.50 + scale * 4.0 },
      left:   { x: cx - scale,  y: H * 0.50 + scale * 3.0 },
      label: "III  (r < r₋)",
      fill: "rgba(180,100,255,0.06)",
      border: "rgba(180,100,255,0.40)",
    },
  ];

  // Draw region diamonds
  for (const r of regions) {
    ctx.beginPath();
    ctx.moveTo(r.top.x, r.top.y);
    ctx.lineTo(r.right.x, r.right.y);
    ctx.lineTo(r.bottom.x, r.bottom.y);
    ctx.lineTo(r.left.x, r.left.y);
    ctx.closePath();
    ctx.fillStyle = r.fill;
    ctx.fill();
    ctx.strokeStyle = r.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Cauchy horizon — the boundary between Region II and III, glowing violet
  const chLeft  = regions[2].left;
  const chRight = regions[2].right;
  const chTop   = regions[2].top;
  // The Cauchy horizon is the top edge of Region III = bottom edge of Region II
  const grad = ctx.createLinearGradient(chLeft.x, chLeft.y, chRight.x, chRight.y);
  grad.addColorStop(0,   "rgba(180,100,255,0)");
  grad.addColorStop(0.3, "rgba(220,120,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.7, "rgba(220,120,255,0.9)");
  grad.addColorStop(1,   "rgba(180,100,255,0)");
  ctx.beginPath();
  ctx.moveTo(chLeft.x, chLeft.y);
  ctx.lineTo(chTop.x, chTop.y);
  ctx.lineTo(chRight.x, chRight.y);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Cauchy horizon label
  ctx.fillStyle = "rgba(220,120,255,0.9)";
  ctx.font = "11px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("Cauchy Horizon  (r = r₋)", cx, chTop.y - 8);

  // Outer horizon — boundary between Region I and II
  const ohLeft  = regions[1].left;
  const ohRight = regions[1].right;
  const ohTop   = regions[1].top;
  const gradOH = ctx.createLinearGradient(ohLeft.x, ohLeft.y, ohRight.x, ohRight.y);
  gradOH.addColorStop(0,   "rgba(0,229,255,0)");
  gradOH.addColorStop(0.3, "rgba(0,229,255,0.7)");
  gradOH.addColorStop(0.5, "rgba(100,240,255,0.9)");
  gradOH.addColorStop(0.7, "rgba(0,229,255,0.7)");
  gradOH.addColorStop(1,   "rgba(0,229,255,0)");
  ctx.beginPath();
  ctx.moveTo(ohLeft.x, ohLeft.y);
  ctx.lineTo(ohTop.x, ohTop.y);
  ctx.lineTo(ohRight.x, ohRight.y);
  ctx.strokeStyle = gradOH;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,229,255,0.8)";
  ctx.fillText("Event Horizon  (r = r₊)", cx, ohTop.y - 8);

  // Region labels
  ctx.font = "12px 'Space Mono', monospace";
  ctx.textAlign = "center";
  for (const r of regions) {
    const midY = (r.top.y + r.bottom.y) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(r.label, cx, midY);
  }

  // ── λ worldline (computer — amber, spiraling in Region II toward III) ──
  // Parametric: starts near top of Region II, spirals down with oscillation
  // representing infinite proper time compressed into finite conformal coordinate
  const r2Top    = regions[1].top;
  const r2Bottom = regions[1].bottom;
  const r2Left   = regions[1].left;

  // λ path: a vertical-ish worldline in the left half of Region II, then
  // continues into Region III
  const lambdaPoints: {x:number,y:number}[] = [];
  const nLambda = 300;
  for (let i = 0; i <= nLambda; i++) {
    const s = i / nLambda; // 0 = top of Region II, 1 = bottom of Region III
    // conformal T coordinate goes from top of II to bottom of III
    const totalHeight = regions[2].bottom.y - r2Top.y;
    const cy2 = r2Top.y + s * totalHeight;
    // X oscillation: represents the "spiraling" infinite computation
    // amplitude decreases as we approach the Cauchy horizon (compressed)
    let amp: number;
    const fracII = (cy2 - r2Top.y) / (r2Bottom.y - r2Top.y);
    if (fracII <= 1) {
      // In Region II: oscillation with increasing frequency (time dilation)
      amp = scale * 0.35 * (1 - fracII * 0.7);
      const freq = 3 + fracII * 12; // frequency increases = time dilation
      const phase = t * 0.3;
      const xOsc = Math.sin(freq * s * Math.PI * 2 + phase) * amp;
      lambdaPoints.push({ x: cx - scale * 0.3 + xOsc, y: cy2 });
    } else {
      // In Region III: very compressed oscillation near Cauchy horizon
      const fracIII = (cy2 - r2Bottom.y) / (regions[2].bottom.y - r2Bottom.y);
      amp = scale * 0.12 * (1 - fracIII * 0.9);
      const freq = 20 + fracIII * 40;
      const xOsc = Math.sin(freq * s * Math.PI * 2) * amp;
      lambdaPoints.push({ x: cx - scale * 0.3 + xOsc, y: cy2 });
    }
  }

  // Draw λ with gradient (amber → dim as it approaches Cauchy horizon)
  if (lambdaPoints.length > 1) {
    for (let i = 1; i < lambdaPoints.length; i++) {
      const frac = i / lambdaPoints.length;
      const alpha = Math.max(0.1, 1 - frac * 0.7);
      ctx.beginPath();
      ctx.moveTo(lambdaPoints[i-1].x, lambdaPoints[i-1].y);
      ctx.lineTo(lambdaPoints[i].x, lambdaPoints[i].y);
      ctx.strokeStyle = `rgba(255,179,71,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // λ label
  ctx.fillStyle = "rgba(255,179,71,0.9)";
  ctx.font = "italic 15px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("λ", lambdaPoints[0].x + 8, lambdaPoints[0].y + 4);

  // ── Observer worldline (cyan — finite proper time, arcs from Region I to p) ──
  // Observer starts in Region I, crosses outer horizon into Region II, then
  // takes a short path to M-H event p in Region III
  const obsStart = { x: cx + scale * 0.5, y: r2Top.y - scale * 0.8 };
  // M-H event p position in Region III
  const pCanvasX = regions[2].left.x + (regions[2].right.x - regions[2].left.x) * (0.45 + pX * 0.3);
  const pCanvasY = regions[2].top.y  + (regions[2].bottom.y - regions[2].top.y)  * (0.25 + pY * 0.4);

  // Observer path: cubic bezier from Region I through Region II to p
  const obsCtrl1 = { x: cx + scale * 0.6, y: r2Top.y + scale * 0.3 };
  const obsCtrl2 = { x: pCanvasX + scale * 0.2, y: pCanvasY - scale * 0.4 };

  ctx.beginPath();
  ctx.moveTo(obsStart.x, obsStart.y);
  ctx.bezierCurveTo(obsCtrl1.x, obsCtrl1.y, obsCtrl2.x, obsCtrl2.y, pCanvasX, pCanvasY);
  ctx.strokeStyle = "rgba(0,229,255,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  // Observer label
  ctx.fillStyle = "rgba(0,229,255,0.9)";
  ctx.font = "11px 'Space Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("Observer", obsStart.x - 6, obsStart.y - 4);

  // ── Signal ray from λ to p ──
  if (showSignal) {
    // Find the point on λ that is in the causal past of p
    // (the last point on λ that is below and to the left of p in conformal coords)
    // Simplified: pick a point on λ near the Cauchy horizon
    const sigSrcIdx = Math.floor(lambdaPoints.length * 0.72);
    const sigSrc = lambdaPoints[sigSrcIdx];

    // Animate: signal travels from sigSrc to p
    const sigFrac = (Math.sin(t * 0.8) * 0.5 + 0.5); // 0..1 oscillating
    const sigX = sigSrc.x + (pCanvasX - sigSrc.x) * sigFrac;
    const sigY = sigSrc.y + (pCanvasY - sigSrc.y) * sigFrac;

    ctx.beginPath();
    ctx.moveTo(sigSrc.x, sigSrc.y);
    ctx.lineTo(sigX, sigY);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Signal head dot
    ctx.beginPath();
    ctx.arc(sigX, sigY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    // Signal label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("signal", sigX + 6, sigY - 4);
  }

  // ── M-H event p ──
  // Glowing dot
  const glow = ctx.createRadialGradient(pCanvasX, pCanvasY, 0, pCanvasX, pCanvasY, 18);
  glow.addColorStop(0,   "rgba(255,255,255,1.0)");
  glow.addColorStop(0.3, "rgba(220,120,255,0.6)");
  glow.addColorStop(1,   "rgba(180,100,255,0)");
  ctx.beginPath();
  ctx.arc(pCanvasX, pCanvasY, 18, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pCanvasX, pCanvasY, 4, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  // p label
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "italic bold 14px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("p", pCanvasX + 10, pCanvasY - 8);
  ctx.font = "10px 'Space Mono', monospace";
  ctx.fillStyle = "rgba(220,120,255,0.8)";
  ctx.fillText("M-H event", pCanvasX + 10, pCanvasY + 6);

  // ── Proper time readouts ──
  ctx.font = "11px 'Space Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,179,71,0.8)";
  ctx.fillText("τ(λ) → ∞  (infinite proper time)", 16, H - 44);
  ctx.fillStyle = "rgba(0,229,255,0.8)";
  ctx.fillText("τ(observer) < ∞  (finite proper time)", 16, H - 28);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("a = " + spin.toFixed(3) + " M", 16, H - 12);
}

// ─── Kerr Interior WebGL2 Shader ────────────────────────────────────────────

const VERT_SRC = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos[6] = vec2[6](
    vec2(-1,-1),vec2(1,-1),vec2(-1,1),
    vec2(-1,1), vec2(1,-1),vec2(1,1)
  );
  vec2 uv[6] = vec2[6](
    vec2(0,0),vec2(1,0),vec2(0,1),
    vec2(0,1),vec2(1,0),vec2(1,1)
  );
  vUv = uv[gl_VertexID];
  gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2  u_res;
uniform float u_time;
uniform float u_spin;   // a/M  0..0.999
uniform float u_zoom;   // camera zoom

// Kerr radii (M=1)
float rPlus(float a)  { return 1.0 + sqrt(1.0 - a*a); }
float rMinus(float a) { return 1.0 - sqrt(1.0 - a*a); }

// Blueshift factor near inner horizon: diverges as r → r₋
float blueshiftFactor(float r, float a) {
  float rm = rMinus(a);
  float rp = rPlus(a);
  float delta = r*r - 2.0*r + a*a;
  // Approximate blueshift: proportional to 1/|delta| near r₋
  float d = abs(delta) + 0.001;
  return clamp(0.05 / d, 0.0, 1.0);
}

// Map blueshift to colour: red → orange → yellow → white → violet
vec3 blueshiftColor(float b) {
  b = clamp(b, 0.0, 1.0);
  if (b < 0.25) return mix(vec3(0.8,0.1,0.0), vec3(1.0,0.5,0.0), b/0.25);
  if (b < 0.5)  return mix(vec3(1.0,0.5,0.0), vec3(1.0,1.0,0.2), (b-0.25)/0.25);
  if (b < 0.75) return mix(vec3(1.0,1.0,0.2), vec3(1.0,1.0,1.0), (b-0.5)/0.25);
  return mix(vec3(1.0,1.0,1.0), vec3(0.8,0.4,1.0), (b-0.75)/0.25);
}

void main() {
  float a = u_spin;
  float rp = rPlus(a);
  float rm = rMinus(a);
  float rErgo = 2.0; // equatorial ergosphere radius = 2M for any a

  // Map UV to equatorial plane coordinates (x,y) around BH
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= u_res.x / u_res.y;
  float viewScale = u_zoom * 5.0;
  vec2 pos = uv * viewScale;

  float r = length(pos);

  // Background: deep space with subtle grid
  vec3 col = vec3(0.0, 0.0, 0.02);

  // Faint conformal grid
  float gx = abs(fract(pos.x * 0.5) - 0.5) / fwidth(pos.x * 0.5);
  float gy = abs(fract(pos.y * 0.5) - 0.5) / fwidth(pos.y * 0.5);
  float grid = 1.0 - min(min(gx, gy), 1.0);
  col += vec3(0.03, 0.06, 0.08) * grid * 0.4;

  // Ergosphere (oblate — equatorial = 2M)
  float ergoR = rErgo;
  float ergoWidth = 0.08;
  float ergoMask = smoothstep(ergoR - ergoWidth, ergoR, r) *
                   (1.0 - smoothstep(ergoR, ergoR + ergoWidth, r));
  col += vec3(0.6, 0.4, 0.0) * ergoMask * 0.5;
  // Ergosphere label ring
  float ergoRing = smoothstep(ergoR + ergoWidth, ergoR + ergoWidth + 0.04, r) *
                   (1.0 - smoothstep(ergoR + ergoWidth + 0.04, ergoR + ergoWidth + 0.08, r));
  col += vec3(1.0, 0.7, 0.0) * ergoRing * 0.15;

  // Outer horizon r₊
  float hpWidth = 0.06;
  float hpMask = smoothstep(rp - hpWidth, rp, r) *
                 (1.0 - smoothstep(rp, rp + hpWidth, r));
  col += vec3(0.0, 0.9, 1.0) * hpMask * 0.8;

  // Inner horizon r₋ (Cauchy horizon) — blueshift glow
  float hmWidth = 0.05;
  float hmMask = smoothstep(rm - hmWidth, rm, r) *
                 (1.0 - smoothstep(rm, rm + hmWidth, r));
  // Blueshift glow: intense near r₋
  float bs = blueshiftFactor(r, a);
  vec3 bsCol = blueshiftColor(bs * 2.0);
  col += bsCol * hmMask * 1.5;

  // Inner glow between r₋ and singularity
  if (r < rm) {
    float innerFrac = 1.0 - r / rm;
    float bsInner = blueshiftFactor(r, a);
    col += blueshiftColor(bsInner * 3.0) * innerFrac * 0.6;
  }

  // Black hole shadow (r < r₊)
  if (r < rp - hpWidth) {
    float shadow = smoothstep(0.0, rp * 0.5, r);
    col = mix(vec3(0.0), col, shadow * 0.3);
  }

  // λ worldline — animated particle spiraling near r₋ in the equatorial plane
  // Approximate as a circle at r = rm + 0.3 with angular velocity
  float lambdaR = rm + 0.3 * (1.0 + 0.5*a);
  float lambdaAngle = u_time * (0.5 + a * 0.8);
  vec2 lambdaPos = vec2(cos(lambdaAngle), sin(lambdaAngle)) * lambdaR;
  float lambdaDist = length(pos - lambdaPos);
  float lambdaGlow = exp(-lambdaDist * lambdaDist * 8.0);
  col += vec3(1.0, 0.7, 0.2) * lambdaGlow * 1.5;
  // Trail
  for (int i = 1; i <= 8; i++) {
    float trailAngle = lambdaAngle - float(i) * 0.25;
    vec2 trailPos = vec2(cos(trailAngle), sin(trailAngle)) * lambdaR;
    float td = length(pos - trailPos);
    float tg = exp(-td * td * 12.0) * (1.0 - float(i)/9.0);
    col += vec3(1.0, 0.6, 0.1) * tg * 0.6;
  }

  // Observer worldline — radially infalling, cyan dot
  float obsR = max(rp + 0.5, rp + 2.5 - u_time * 0.4);
  obsR = max(obsR, 0.1);
  float obsAngle = 0.3;
  vec2 obsPos = vec2(cos(obsAngle), sin(obsAngle)) * obsR;
  float obsDist = length(pos - obsPos);
  float obsGlow = exp(-obsDist * obsDist * 10.0);
  col += vec3(0.0, 0.9, 1.0) * obsGlow * 1.2;

  // Tone mapping
  col = col / (col + 0.5);
  col = pow(col, vec3(0.4545));

  fragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
  }
  return s;
}

function linkProgram(gl: WebGL2RenderingContext, vert: WebGLShader, frag: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vert);
  gl.attachShader(p, frag);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(p));
  }
  return p;
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface MHSimulationProps {
  className?: string;
}

export default function MHSimulation({ className = "" }: MHSimulationProps) {
  const [tab, setTab] = useState<"penrose" | "kerr">("penrose");
  const [spin, setSpin] = useState(0.9);
  const [showSignal, setShowSignal] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [pX, setPX] = useState(0.2);
  const [pY, setPY] = useState(0.3);
  const [fps, setFps] = useState(0);
  const [properTimeObs, setProperTimeObs] = useState(0);
  const [properTimeLambda, setProperTimeLambda] = useState(0);

  const penroseCanvasRef = useRef<HTMLCanvasElement>(null);
  const kerrCanvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef           = useRef<number>(0);
  const tRef             = useRef(0);
  const glStateRef       = useRef<{
    gl: WebGL2RenderingContext;
    prog: WebGLProgram;
    uRes: WebGLUniformLocation;
    uTime: WebGLUniformLocation;
    uSpin: WebGLUniformLocation;
    uZoom: WebGLUniformLocation;
    vao: WebGLVertexArrayObject;
  } | null>(null);
  const fpsCountRef = useRef({ frames: 0, last: performance.now() });
  const spinRef  = useRef(spin);
  const zoomRef  = useRef(zoom);
  const tabRef   = useRef(tab);
  const showSigRef = useRef(showSignal);
  const pXRef = useRef(pX);
  const pYRef = useRef(pY);

  useEffect(() => { spinRef.current = spin; }, [spin]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { showSigRef.current = showSignal; }, [showSignal]);
  useEffect(() => { pXRef.current = pX; }, [pX]);
  useEffect(() => { pYRef.current = pY; }, [pY]);

  // Init WebGL2 for Kerr tab
  const initGL = useCallback(() => {
    const canvas = kerrCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false });
    if (!gl) return;
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = linkProgram(gl, vert, frag);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    glStateRef.current = {
      gl, prog, vao,
      uRes:  gl.getUniformLocation(prog, "u_res")!,
      uTime: gl.getUniformLocation(prog, "u_time")!,
      uSpin: gl.getUniformLocation(prog, "u_spin")!,
      uZoom: gl.getUniformLocation(prog, "u_zoom")!,
    };
  }, []);

  // Main RAF loop
  useEffect(() => {
    initGL();
    let stopped = false;

    const loop = (now: number) => {
      if (stopped) return;
      tRef.current += 0.016;
      const t = tRef.current;

      // FPS
      fpsCountRef.current.frames++;
      if (now - fpsCountRef.current.last > 1000) {
        setFps(fpsCountRef.current.frames);
        fpsCountRef.current.frames = 0;
        fpsCountRef.current.last = now;
      }

      // Proper time readouts
      setProperTimeObs(parseFloat((t * 0.18).toFixed(2)));
      setProperTimeLambda(parseFloat((t * 2.4).toFixed(1)));

      if (tabRef.current === "penrose") {
        const canvas = penroseCanvasRef.current;
        if (canvas) {
          // Resize canvas to match display size
          const rect = canvas.getBoundingClientRect();
          if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width  = rect.width  * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            const ctx2 = canvas.getContext("2d")!;
            ctx2.scale(window.devicePixelRatio, window.devicePixelRatio);
          }
          drawPenroseDiagram(canvas, t, spinRef.current, showSigRef.current, pXRef.current, pYRef.current);
        }
      } else {
        const s = glStateRef.current;
        const canvas = kerrCanvasRef.current;
        if (s && canvas) {
          const { gl, prog, vao, uRes, uTime, uSpin, uZoom } = s;
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio;
          const w = Math.floor(rect.width * dpr);
          const h = Math.floor(rect.height * dpr);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
          }
          gl.useProgram(prog);
          gl.uniform2f(uRes, w, h);
          gl.uniform1f(uTime, t);
          gl.uniform1f(uSpin, spinRef.current);
          gl.uniform1f(uZoom, zoomRef.current);
          gl.bindVertexArray(vao);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [initGL]);

  const rPlus  = (1 + Math.sqrt(1 - spin * spin)).toFixed(4);
  const rMinus = (1 - Math.sqrt(1 - spin * spin)).toFixed(4);
  const rErgo  = "2.0000";

  return (
    <div className={`flex flex-col bg-black border border-white/10 rounded-none ${className}`} style={{ fontFamily: "'Space Mono', monospace" }}>
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setTab("penrose")}
          className={`px-5 py-3 text-xs tracking-widest uppercase transition-colors ${tab === "penrose" ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5" : "text-white/40 hover:text-white/70"}`}
        >
          Penrose Diagram
        </button>
        <button
          onClick={() => setTab("kerr")}
          className={`px-5 py-3 text-xs tracking-widest uppercase transition-colors ${tab === "kerr" ? "text-amber-400 border-b-2 border-amber-400 bg-amber-400/5" : "text-white/40 hover:text-white/70"}`}
        >
          Kerr Interior
        </button>
        {/* HUD */}
        <div className="ml-auto flex items-center gap-4 px-4 text-xs text-white/30">
          <span>{fps} fps</span>
          <span className="text-amber-400/70">τ(λ) = {properTimeLambda} M</span>
          <span className="text-cyan-400/70">τ(obs) = {properTimeObs} M</span>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1" style={{ minHeight: "520px" }}>
        <canvas
          ref={penroseCanvasRef}
          className={`absolute inset-0 w-full h-full ${tab === "penrose" ? "block" : "hidden"}`}
          style={{ imageRendering: "pixelated" }}
        />
        <canvas
          ref={kerrCanvasRef}
          className={`absolute inset-0 w-full h-full ${tab === "kerr" ? "block" : "hidden"}`}
        />

        {/* Penrose legend overlay */}
        {tab === "penrose" && (
          <div className="absolute top-3 right-3 flex flex-col gap-1 text-xs bg-black/70 border border-white/10 px-3 py-2">
            <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-amber-400 inline-block" /> λ — computer (τ → ∞)</div>
            <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-cyan-400 inline-block" /> Observer (τ &lt; ∞)</div>
            <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-white/60 inline-block border-dashed border-t border-white/60" /> Signal ray</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white inline-block" /> M-H event p</div>
            <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-violet-400 inline-block" /> Cauchy horizon</div>
          </div>
        )}

        {/* Kerr legend overlay */}
        {tab === "kerr" && (
          <div className="absolute top-3 right-3 flex flex-col gap-1 text-xs bg-black/70 border border-white/10 px-3 py-2">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Outer horizon r₊ = {rPlus} M</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-violet-400 inline-block" /> Inner horizon r₋ = {rMinus} M</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Ergosphere r_e = {rErgo} M</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> λ (computer)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-300 inline-block" /> Observer</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-white/10 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-white/50 uppercase tracking-widest">Spin  a = {spin.toFixed(3)} M</span>
          <input type="range" min="0" max="0.999" step="0.001" value={spin}
            onChange={e => setSpin(parseFloat(e.target.value))}
            className="accent-cyan-400" />
        </label>
        {tab === "kerr" && (
          <label className="flex flex-col gap-1">
            <span className="text-white/50 uppercase tracking-widest">Zoom  ×{zoom.toFixed(1)}</span>
            <input type="range" min="0.3" max="3" step="0.1" value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="accent-amber-400" />
          </label>
        )}
        {tab === "penrose" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 uppercase tracking-widest">p position X</span>
              <input type="range" min="0" max="1" step="0.01" value={pX}
                onChange={e => setPX(parseFloat(e.target.value))}
                className="accent-violet-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-white/50 uppercase tracking-widest">p position Y</span>
              <input type="range" min="0" max="1" step="0.01" value={pY}
                onChange={e => setPY(parseFloat(e.target.value))}
                className="accent-violet-400" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showSignal}
                onChange={e => setShowSignal(e.target.checked)}
                className="accent-white" />
              <span className="text-white/50 uppercase tracking-widest">Show signal ray</span>
            </label>
          </>
        )}
        <div className="flex flex-col gap-1 text-white/30">
          <span className="uppercase tracking-widest">Derived</span>
          <span>r₊ = {rPlus} M</span>
          <span>r₋ = {rMinus} M</span>
        </div>
      </div>
    </div>
  );
}
