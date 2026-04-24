/**
 * BlackholeGL — Self-contained WebGL2 Kerr Black Hole Renderer
 * Design: Deep-Space Instrument aesthetic
 * Embeds GLSL shaders inline — no external fetch required.
 * Physics: Kerr geodesics (RK2), Doppler beaming, accretion disk, ACES tone map
 * Based on: James et al. (2015), arXiv:1502.03808
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ── Shader sources (inlined) ─────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_spin;
uniform float u_camera_r;
uniform float u_camera_theta;
uniform float u_camera_phi;
uniform float u_disk_inner;
uniform float u_disk_outer;
uniform float u_disk_temp;
uniform float u_doppler_strength;
uniform float u_lensing_steps;
uniform float u_step_size;
uniform float u_star_density;
uniform float u_star_brightness;
uniform float u_exposure;
uniform float u_disk_brightness;
uniform float u_turbulence;

// ── Hash & Noise ──────────────────────────────────────────────────────────────
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 hash22(vec2 p) {
  return vec2(
    fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453)
  );
}
float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise3d(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i),             hash31(i+vec3(1,0,0)), u.x),
        mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), u.x), u.y),
    mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), u.x),
        mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), u.x), u.y),
    u.z);
}
float fbm4(vec3 p) {
  return noise3d(p)*0.5 + noise3d(p*2.0)*0.25 + noise3d(p*4.0)*0.125 + noise3d(p*8.0)*0.0625;
}

// ── Blackbody ─────────────────────────────────────────────────────────────────
vec3 blackbody(float tempK) {
  float t = clamp(tempK, 800.0, 40000.0);
  float r, g, b;
  if (t <= 6600.0) r = 1.0;
  else r = clamp(pow((t/6600.0)-1.0,-0.1332)*1.292, 0.0, 1.0);
  if (t <= 6600.0) g = clamp(0.39*log(t/6600.0)-0.63+1.0, 0.0, 1.0);
  else g = clamp(pow((t/6600.0)-1.0,-0.0755)*1.1299, 0.0, 1.0);
  if (t >= 6600.0) b = 1.0;
  else if (t <= 1900.0) b = 0.0;
  else b = clamp(0.543*log(t/1000.0-10.0)-1.196, 0.0, 1.0);
  return vec3(r, g, b);
}

// ── Star field ────────────────────────────────────────────────────────────────
vec3 starField(vec3 dir) {
  float theta = atan(dir.z, dir.x);
  float phi   = asin(clamp(dir.y, -1.0, 1.0));
  float density   = clamp(u_star_density, 0.05, 1.0);
  float gridScale = 55.0 / density;
  vec2  sc   = vec2(theta, phi) * gridScale;
  vec2  cell = floor(sc);
  vec2  cellUV = fract(sc);
  float cellHash = hash21(cell);
  float hasstar  = step(1.0 - density, cellHash);
  vec2  starPos  = hash22(cell + 42.0) * 0.8 + 0.1;
  float dist = length(cellUV - starPos);
  float sz   = hash21(cell + 100.0) * 0.025 + 0.007;
  float core = smoothstep(sz, 0.0, dist);
  float glow = smoothstep(sz*5.0, 0.0, dist) * 0.2;
  float intensity = (core + glow) * hasstar * u_star_brightness;
  float ct  = hash21(cell + 200.0);
  vec3  col = mix(vec3(0.65, 0.82, 1.0), vec3(1.0, 0.90, 0.72), ct);
  return col * intensity;
}

// ── Accretion disk ────────────────────────────────────────────────────────────
vec4 accretionDisk(vec3 hitPos, vec3 rayDir) {
  float hitR   = length(hitPos.xz);
  float innerR = u_disk_inner;
  float outerR = u_disk_outer;
  if (hitR < innerR || hitR > outerR) return vec4(0.0);

  float peakT = u_disk_temp * 1000.0;
  float tempK = peakT * pow(innerR / hitR, 0.75);
  vec3  col   = blackbody(tempK) * u_disk_brightness;

  float normR = clamp((hitR - innerR) / (outerR - innerR), 0.0, 1.0);
  float edge  = smoothstep(0.0, 0.07, normR) * smoothstep(1.0, 0.88, normR);
  col *= edge;

  float hitAngle = atan(hitPos.z, hitPos.x);
  float cycleLen = 14.0;
  float ct       = mod(u_time, cycleLen);
  float blend    = ct / cycleLen;
  float rotSpd   = 0.35 * u_turbulence;

  float ph1 = ct * rotSpd / pow(hitR, 1.5);
  float ph2 = (ct + cycleLen) * rotSpd / pow(hitR, 1.5);
  float a1  = hitAngle + ph1;
  float a2  = hitAngle + ph2;
  float sc  = hitR * 0.35;
  float str = 0.12;

  vec3  nc1 = vec3(sc, cos(a1)/str, sin(a1)/str);
  vec3  nc2 = vec3(sc, cos(a2)/str, sin(a2)/str);
  float t1  = fbm4(nc1);
  float t2  = fbm4(nc2);
  float tb  = mix(t2, t1, blend);
  float ro  = pow(clamp(tb, 0.0, 1.0), 1.4);
  col *= (0.35 + 0.65 * ro);

  vec3  velDir = normalize(vec3(-hitPos.z, 0.0, hitPos.x));
  float beta   = clamp(1.0 / sqrt(hitR / innerR) * 0.42, 0.0, 0.92);
  float cosT   = dot(velDir, rayDir);
  float D      = 1.0 / max(1.0 - beta * cosT, 0.04);
  float boost  = pow(clamp(D, 0.05, 10.0), 3.0 * u_doppler_strength);
  col *= boost;

  float opacity = clamp(ro * edge * 1.6, 0.0, 1.0);
  return vec4(col, opacity);
}

// ── Kerr geodesic acceleration ────────────────────────────────────────────────
vec3 kerrAcc(vec3 pos, vec3 vel, float a) {
  float M  = 1.0;
  float z  = pos.z;
  float r2 = dot(pos, pos);
  float r  = sqrt(r2);
  if (r < 0.01) return vec3(0.0);

  float a2     = a * a;
  float rho2   = r2 - a2;
  float disc   = rho2 * rho2 + 4.0 * a2 * z * z;
  float bl_r2  = 0.5 * (rho2 + sqrt(max(disc, 0.0)));
  float bl_r   = sqrt(max(bl_r2, 0.001));

  float cosT   = z / bl_r;
  float Sigma  = bl_r2 + a2 * cosT * cosT;
  float rFac   = 2.0 * M * bl_r / max(Sigma * Sigma, 1e-6);

  float denom  = max(bl_r * (2.0 * bl_r2 - rho2 + a2 * z * z / bl_r2), 1e-6);
  float drdx   = (pos.x * bl_r2 + a2 * pos.x) / denom;
  float drdy   = (pos.y * bl_r2 + a2 * pos.y) / denom;
  float drdz   = (z + a2 * z / bl_r2) / max(bl_r, 1e-6);
  vec3  gradR  = vec3(drdx, drdy, drdz);

  vec3  gravAcc = -rFac * gradR;
  vec3  phi_hat = normalize(vec3(-pos.y, pos.x, 0.0) + vec3(0.0, 0.0, 1e-9));
  float dragMag = 2.0 * M * a * bl_r / max(Sigma * Sigma, 1e-6);
  vec3  dragAcc = dragMag * cross(phi_hat, vel);

  return gravAcc + dragAcc;
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
  vec2  uv     = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  float aspect = u_resolution.x / u_resolution.y;

  float cR = u_camera_r;
  float cT = u_camera_theta;
  float cP = u_camera_phi;

  vec3 camPos = vec3(cR*sin(cT)*cos(cP), cR*cos(cT), cR*sin(cT)*sin(cP));
  vec3 forward = normalize(-camPos);
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  vec3 right   = normalize(cross(worldUp, forward));
  vec3 up      = cross(forward, right);

  float fov    = 0.85;
  vec3  rayDir = normalize(forward*fov + right*(uv.x*aspect) + up*uv.y);
  vec3  rayPos = camPos;

  float M        = 1.0;
  float a        = u_spin;
  float rHorizon = M + sqrt(max(M*M - a*a, 0.0));
  float rCapture = rHorizon * 1.05;

  int   steps = int(clamp(u_lensing_steps, 64.0, 512.0));
  float dt    = u_step_size;

  vec3  color = vec3(0.0);
  float alpha = 0.0;
  bool  hit   = false;

  vec3  prevPos = rayPos;
  float prevY   = rayPos.y;

  for (int i = 0; i < 512; i++) {
    if (i >= steps) break;
    float r = length(rayPos);
    if (r < rCapture) { hit = true; break; }

    float curY = rayPos.y;
    if (prevY * curY < 0.0 && alpha < 0.99) {
      float t    = prevY / (prevY - curY);
      vec3  hPos = mix(prevPos, rayPos, t);
      vec4  disk = accretionDisk(hPos, rayDir);
      if (disk.w > 0.005) {
        float rem = 1.0 - alpha;
        color    += disk.xyz * disk.w * rem;
        alpha    += rem * disk.w;
        if (alpha > 0.99) break;
      }
    }

    vec3 k1v = kerrAcc(rayPos, rayDir, a);
    vec3 mp  = rayPos + rayDir * (dt * 0.5);
    vec3 mv  = normalize(rayDir + k1v * (dt * 0.5));
    vec3 k2v = kerrAcc(mp, mv, a);

    prevPos = rayPos;
    prevY   = curY;
    rayPos += rayDir * dt;
    rayDir  = normalize(rayDir + k2v * dt);
  }

  if (!hit) {
    vec3 bg = starField(normalize(rayDir));
    color  += bg * (1.0 - alpha);
  }

  vec3 ex = color * u_exposure;
  vec3 tm = clamp(
    (ex * (2.51*ex + 0.03)) / (ex * (2.43*ex + 0.59) + 0.14),
    vec3(0.0), vec3(1.0)
  );
  vec3 final = pow(tm, vec3(1.0/2.2));
  fragColor = vec4(final, 1.0);
}`;

// ── Params ────────────────────────────────────────────────────────────────────
export interface BHParams {
  spin: number;
  cameraR: number;
  cameraTheta: number;
  cameraPhi: number;
  diskInner: number;
  diskOuter: number;
  diskTemp: number;
  dopplerStrength: number;
  lensingSteps: number;
  stepSize: number;
  starDensity: number;
  starBrightness: number;
  exposure: number;
  diskBrightness: number;
  turbulence: number;
}

export const DEFAULT_BH_PARAMS: BHParams = {
  spin: 0.9,
  cameraR: 25.0,
  cameraTheta: 1.3,
  cameraPhi: 0.0,
  diskInner: 3.0,
  diskOuter: 14.0,
  diskTemp: 12.0,
  dopplerStrength: 1.0,
  lensingSteps: 256,
  stepSize: 0.15,
  starDensity: 0.6,
  starBrightness: 1.2,
  exposure: 1.5,
  diskBrightness: 2.0,
  turbulence: 1.0,
};

// ── WebGL hook ────────────────────────────────────────────────────────────────
function useWebGL(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paramsRef: React.MutableRefObject<BHParams>,
  isRunningRef: React.MutableRefObject<boolean>,
  onFps?: (fps: number) => void
) {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const uRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const startRef = useRef(performance.now());
  const fpsRef = useRef({ frames: 0, last: performance.now() });
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false });
    if (!gl) return;
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vert = compile(gl.VERTEX_SHADER, VERT_SRC);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vert || !frag) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    progRef.current = prog;

    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(prog);
    const uNames = [
      "u_resolution","u_time","u_spin","u_camera_r","u_camera_theta",
      "u_camera_phi","u_disk_inner","u_disk_outer","u_disk_temp",
      "u_doppler_strength","u_lensing_steps","u_step_size",
      "u_star_density","u_star_brightness","u_exposure",
      "u_disk_brightness","u_turbulence",
    ];
    uNames.forEach(n => { uRef.current[n] = gl.getUniformLocation(prog, n); });

    let stopped = false;
    const loop = () => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(loop);

      const gl2 = glRef.current;
      const p2 = progRef.current;
      if (!gl2 || !p2) return;

      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl2.viewport(0, 0, w, h);
      }

      if (!isRunningRef.current) return;

      const now = performance.now();
      const elapsed = (now - startRef.current) / 1000;
      const p = paramsRef.current;
      const u = uRef.current;

      gl2.useProgram(p2);
      gl2.uniform2f(u["u_resolution"], w, h);
      gl2.uniform1f(u["u_time"], elapsed);
      gl2.uniform1f(u["u_spin"], p.spin);
      gl2.uniform1f(u["u_camera_r"], p.cameraR);
      gl2.uniform1f(u["u_camera_theta"], p.cameraTheta);
      gl2.uniform1f(u["u_camera_phi"], p.cameraPhi);
      gl2.uniform1f(u["u_disk_inner"], p.diskInner);
      gl2.uniform1f(u["u_disk_outer"], p.diskOuter);
      gl2.uniform1f(u["u_disk_temp"], p.diskTemp);
      gl2.uniform1f(u["u_doppler_strength"], p.dopplerStrength);
      gl2.uniform1f(u["u_lensing_steps"], Math.min(p.lensingSteps, 512));
      gl2.uniform1f(u["u_step_size"], p.stepSize);
      gl2.uniform1f(u["u_star_density"], p.starDensity);
      gl2.uniform1f(u["u_star_brightness"], p.starBrightness);
      gl2.uniform1f(u["u_exposure"], p.exposure);
      gl2.uniform1f(u["u_disk_brightness"], p.diskBrightness);
      gl2.uniform1f(u["u_turbulence"], p.turbulence);
      gl2.drawArrays(gl2.TRIANGLE_STRIP, 0, 4);

      fpsRef.current.frames++;
      if (now - fpsRef.current.last >= 1000) {
        onFps?.(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Slider component ──────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, accent = "cyan",
  onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  accent?: "cyan" | "amber" | "white";
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackColor = accent === "amber" ? "rgba(255,179,71,0.35)" : accent === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,229,255,0.35)";
  const thumbColor = accent === "amber" ? "#FFB347" : accent === "white" ? "rgba(255,255,255,0.7)" : "#00E5FF";
  const labelColor = accent === "amber" ? "text-amber-400/70" : accent === "white" ? "text-white/50" : "text-cyan-400/70";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className={`font-mono text-[9px] tracking-widest uppercase ${labelColor}`}>{label}</span>
        <span className="font-mono text-[10px] text-white/50 tabular-nums">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-3 flex items-center">
        <div className="absolute inset-y-0 flex items-center w-full">
          <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div
            className="absolute left-0 h-px"
            style={{ width: `${pct}%`, background: trackColor }}
          />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-3"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
          style={{ left: `calc(${pct}% - 5px)`, background: thumbColor, boxShadow: `0 0 6px ${thumbColor}` }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BlackholeGL() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<BHParams>({ ...DEFAULT_BH_PARAMS });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const [isRunning, setIsRunning] = useState(true);
  const isRunningRef = useRef(true);
  isRunningRef.current = isRunning;
  const [fps, setFps] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  // Check WebGL2 support — attempt to get context and compile a trivial shader
  useEffect(() => {
    try {
      const test = document.createElement("canvas");
      test.width = 1; test.height = 1;
      const gl = test.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
      if (!gl) { setWebglSupported(false); return; }
      // Try to compile a minimal shader to confirm driver works
      const s = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(s, "#version 300 es\nvoid main(){}" );
      gl.compileShader(s);
      setWebglSupported(gl.getShaderParameter(s, gl.COMPILE_STATUS) === true);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  useWebGL(canvasRef, paramsRef, isRunningRef, setFps);

  // Camera orbit via mouse drag
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setParams(p => ({
      ...p,
      cameraPhi: p.cameraPhi - dx * 0.005,
      cameraTheta: Math.max(0.05, Math.min(Math.PI - 0.05, p.cameraTheta + dy * 0.005)),
    }));
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  // Touch orbit
  const touchRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchRef.current = { lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    }
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchRef.current.lastX;
    const dy = e.touches[0].clientY - touchRef.current.lastY;
    touchRef.current = { lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    setParams(p => ({
      ...p,
      cameraPhi: p.cameraPhi - dx * 0.005,
      cameraTheta: Math.max(0.05, Math.min(Math.PI - 0.05, p.cameraTheta + dy * 0.005)),
    }));
  }, []);
  const onTouchEnd = useCallback(() => { touchRef.current = null; }, []);

  // Scroll to zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setParams(p => ({
      ...p,
      cameraR: Math.max(5, Math.min(50, p.cameraR + e.deltaY * 0.04)),
    }));
  }, []);

  // Escape to exit fullscreen
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const set = (key: keyof BHParams) => (v: number) => setParams(p => ({ ...p, [key]: v }));

  // Derived values
  const a = params.spin;
  const rPlus = (1 + Math.sqrt(Math.max(1 - a * a, 0))).toFixed(4);
  const rMinus = (1 - Math.sqrt(Math.max(1 - a * a, 0))).toFixed(4);
  const rErgo = 2.0;
  const Z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3 * a * a + Z1 * Z1);
  const rISCO = Math.max(1, 3 + Z2 - Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));

  if (webglSupported === false) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 border border-red-500/20 bg-red-950/10 p-8">
        <div className="font-mono text-xs tracking-widest uppercase text-red-400/70">WebGL2 Not Available</div>
        <p className="text-white/40 text-sm text-center max-w-sm">
          Your browser does not support WebGL2. Please try Chrome, Firefox, or Edge with hardware acceleration enabled.
        </p>
      </div>
    );
  }

  const canvas = (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ cursor: dragRef.current.active ? "grabbing" : "grab", touchAction: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    />
  );

  const controlPanel = (
    <div
      className={`absolute top-0 left-0 bottom-0 w-56 overflow-y-auto z-20 transition-transform duration-300 ${showControls ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "rgba(0,0,5,0.82)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(0,229,255,0.1)" }}
    >
      <div className="p-4 space-y-5">
        {/* Spacetime */}
        <div>
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-cyan-500/50 mb-3 border-l border-cyan-500/30 pl-2">── Spacetime</div>
          <div className="space-y-4">
            <Slider label="Spin a/M" value={params.spin} min={0} max={0.999} step={0.001} accent="cyan" onChange={set("spin")} format={v => `${v.toFixed(3)} M`} />
            <Slider label="Camera r" value={params.cameraR} min={5} max={50} step={0.5} accent="cyan" onChange={set("cameraR")} format={v => `${v.toFixed(1)} M`} />
            <Slider label="Inclination θ" value={params.cameraTheta} min={0.05} max={Math.PI - 0.05} step={0.01} accent="cyan" onChange={set("cameraTheta")} format={v => `${(v * 180 / Math.PI).toFixed(1)}°`} />
          </div>
        </div>

        {/* Derived values */}
        <div className="border border-cyan-500/10 p-3 bg-cyan-950/10">
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-cyan-500/40 mb-2">Derived</div>
          <div className="space-y-1.5 font-mono text-[9px]">
            {[["r₊", rPlus, "M"], ["r₋", rMinus, "M"], ["r_ergo", rErgo.toFixed(4), "M"], ["r_ISCO", rISCO.toFixed(4), "M"]].map(([k, v, u]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-cyan-500/50">{k}</span>
                <span className="text-cyan-300/70 tabular-nums">{v} {u}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Accretion disk */}
        <div>
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-amber-500/50 mb-3 border-l border-amber-500/30 pl-2">── Accretion Disk</div>
          <div className="space-y-4">
            <Slider label="Inner edge" value={params.diskInner} min={1} max={6} step={0.1} accent="amber" onChange={set("diskInner")} format={v => `${v.toFixed(2)} M`} />
            <Slider label="Outer edge" value={params.diskOuter} min={6} max={20} step={0.5} accent="amber" onChange={set("diskOuter")} format={v => `${v.toFixed(1)} M`} />
            <Slider label="Peak temp" value={params.diskTemp} min={3} max={30} step={0.5} accent="amber" onChange={set("diskTemp")} format={v => `${v.toFixed(1)} kK`} />
            <Slider label="Doppler" value={params.dopplerStrength} min={0} max={2} step={0.05} accent="amber" onChange={set("dopplerStrength")} />
            <Slider label="Brightness" value={params.diskBrightness} min={0.1} max={4} step={0.1} accent="amber" onChange={set("diskBrightness")} />
            <Slider label="Turbulence" value={params.turbulence} min={0} max={2} step={0.05} accent="amber" onChange={set("turbulence")} />
          </div>
        </div>

        {/* Rendering */}
        <div>
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-white/30 mb-3 border-l border-white/15 pl-2">── Rendering</div>
          <div className="space-y-4">
            <Slider label="Ray steps" value={params.lensingSteps} min={64} max={512} step={32} accent="white" onChange={set("lensingSteps")} format={v => `${v}`} />
            <Slider label="Step size" value={params.stepSize} min={0.05} max={0.5} step={0.01} accent="white" onChange={set("stepSize")} format={v => `${v.toFixed(2)} M`} />
            <Slider label="Star density" value={params.starDensity} min={0} max={1} step={0.05} accent="white" onChange={set("starDensity")} />
            <Slider label="Star bright" value={params.starBrightness} min={0} max={3} step={0.1} accent="white" onChange={set("starBrightness")} />
            <Slider label="Exposure" value={params.exposure} min={0.1} max={5} step={0.1} accent="white" onChange={set("exposure")} />
          </div>
        </div>
      </div>
    </div>
  );

  const hud = (
    <div className="absolute top-0 right-0 left-0 z-10 pointer-events-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(to bottom, rgba(0,0,5,0.7), transparent)" }}>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowControls(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            {showControls ? "Hide" : "Show"} Controls
          </button>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="font-mono text-[9px] text-white/20 tabular-nums">{fps} fps</div>
          <button
            onClick={() => setIsRunning(v => !v)}
            className="px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase"
          >
            {isRunning ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => setParams({ ...DEFAULT_BH_PARAMS })}
            className="px-2.5 py-1 border border-white/10 text-white/30 hover:text-white/50 hover:border-white/20 transition-all font-mono text-[9px] tracking-widest uppercase"
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setFullscreen(true)}
            className="px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase"
          >
            ⤢ Full
          </button>
        </div>
      </div>
    </div>
  );

  // Bottom status bar
  const statusBar = (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,5,0.75), transparent)" }}>
      <div className="flex items-center gap-5 px-4 py-2.5 font-mono text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-500/40">a</span>
          <span className="text-cyan-300/60 tabular-nums">= {params.spin.toFixed(3)} M</span>
        </div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-500/40">r₊</span>
          <span className="text-cyan-300/60 tabular-nums">= {rPlus} M</span>
        </div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500/40">r_ISCO</span>
          <span className="text-amber-300/60 tabular-nums">= {rISCO.toFixed(4)} M</span>
        </div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/25">renderer</span>
          <span className="text-white/40">WebGL2</span>
        </div>
        <div className="ml-auto text-white/15 hidden sm:block">drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );

  const inner = (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#000005" }}>
      {canvas}
      {controlPanel}
      {hud}
      {statusBar}
    </div>
  );

  return (
    <>
      {/* Inline embed */}
      <div className="relative w-full" style={{ height: "80vh", minHeight: "520px" }}>
        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-cyan-500/30 z-30 pointer-events-none" />
        {inner}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/15 bg-black/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400/70">GARGANTUA · WebGL2 Live</span>
            </div>
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all font-mono text-[10px] tracking-widest uppercase"
            >
              ✕ Exit · Esc
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {inner}
          </div>
        </div>
      )}
    </>
  );
}
