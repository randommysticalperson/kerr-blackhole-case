/**
 * BlackholeGL — Kerr Black Hole Renderer
 * Design: Deep-Space Instrument aesthetic
 *
 * Primary:  WebGPU compute pipeline (WGSL shader, workgroup 8×8)
 * Fallback: WebGL2 fragment shader (GLSL 300 es, fullscreen quad)
 *
 * Physics: Kerr geodesics (RK2), Doppler beaming, accretion disk,
 *          FBM turbulence, procedural star field, ACES tone map
 * Based on: James et al. (2015), arXiv:1502.03808
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ── WGSL Compute Shader (inlined) ────────────────────────────────────────────
const WGSL_SRC = `
struct Uniforms {
  resolution:       vec2f,
  time:             f32,
  spin:             f32,
  camera_r:         f32,
  camera_theta:     f32,
  camera_phi:       f32,
  disk_inner:       f32,
  disk_outer:       f32,
  disk_temp:        f32,
  doppler_strength: f32,
  lensing_steps:    f32,
  step_size:        f32,
  star_density:     f32,
  star_brightness:  f32,
  exposure:         f32,
  disk_brightness:  f32,
  turbulence:       f32,
  pad0:             f32,
  pad1:             f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn hash22(p: vec2f) -> vec2f {
  return vec2f(
    fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(p, vec2f(269.5, 183.3))) * 43758.5453)
  );
}
fn hash31(p: vec3f) -> f32 {
  return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}
fn noise3d(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u2 = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i+vec3f(1,0,0)), u2.x),
        mix(hash31(i+vec3f(0,1,0)), hash31(i+vec3f(1,1,0)), u2.x), u2.y),
    mix(mix(hash31(i+vec3f(0,0,1)), hash31(i+vec3f(1,0,1)), u2.x),
        mix(hash31(i+vec3f(0,1,1)), hash31(i+vec3f(1,1,1)), u2.x), u2.y),
    u2.z);
}
fn fbm4(p: vec3f) -> f32 {
  return noise3d(p)*0.5 + noise3d(p*2.0)*0.25 + noise3d(p*4.0)*0.125 + noise3d(p*8.0)*0.0625;
}

fn blackbody(tempK: f32) -> vec3f {
  let t = clamp(tempK, 800.0, 40000.0);
  var r: f32; var g: f32; var b: f32;
  if (t <= 6600.0) { r = 1.0; } else { r = clamp(pow((t/6600.0)-1.0,-0.1332)*1.292,0.0,1.0); }
  if (t <= 6600.0) { g = clamp(0.39*log(t/6600.0)-0.63+1.0,0.0,1.0); } else { g = clamp(pow((t/6600.0)-1.0,-0.0755)*1.1299,0.0,1.0); }
  if (t >= 6600.0) { b = 1.0; } else if (t <= 1900.0) { b = 0.0; } else { b = clamp(0.543*log(t/1000.0-10.0)-1.196,0.0,1.0); }
  return vec3f(r, g, b);
}

fn starField(dir: vec3f) -> vec3f {
  let theta = atan2(dir.z, dir.x);
  let phi   = asin(clamp(dir.y, -1.0, 1.0));
  let density   = clamp(u.star_density, 0.05, 1.0);
  let gridScale = 55.0 / density;
  let sc   = vec2f(theta, phi) * gridScale;
  let cell = floor(sc); let cellUV = fract(sc);
  let cellHash = hash21(cell);
  let hasstar  = step(1.0 - density, cellHash);
  let starPos  = hash22(cell + 42.0) * 0.8 + 0.1;
  let dist = length(cellUV - starPos);
  let sz   = hash21(cell + 100.0) * 0.025 + 0.007;
  let core = smoothstep(sz, 0.0, dist);
  let glow = smoothstep(sz*5.0, 0.0, dist) * 0.2;
  let intensity = (core + glow) * hasstar * u.star_brightness;
  let ct  = hash21(cell + 200.0);
  let col = mix(vec3f(0.65, 0.82, 1.0), vec3f(1.0, 0.90, 0.72), ct);
  return col * intensity;
}

fn accretionDisk(hitPos: vec3f, rayDir: vec3f) -> vec4f {
  let hitR   = length(hitPos.xz);
  let innerR = u.disk_inner; let outerR = u.disk_outer;
  if (hitR < innerR || hitR > outerR) { return vec4f(0.0); }
  let peakT  = u.disk_temp * 1000.0;
  let tempK  = peakT * pow(innerR / hitR, 0.75);
  var col    = blackbody(tempK) * u.disk_brightness;
  let normR  = clamp((hitR - innerR) / (outerR - innerR), 0.0, 1.0);
  let edge   = smoothstep(0.0, 0.07, normR) * smoothstep(1.0, 0.88, normR);
  col       *= edge;
  let hitAngle = atan2(hitPos.z, hitPos.x);
  let cycleLen = 14.0;
  let ct       = u.time % cycleLen;
  let blend    = ct / cycleLen;
  let rotSpd   = 0.35 * u.turbulence;
  let ph1 = ct * rotSpd / pow(hitR, 1.5);
  let ph2 = (ct + cycleLen) * rotSpd / pow(hitR, 1.5);
  let a1  = hitAngle + ph1; let a2 = hitAngle + ph2;
  let sc  = hitR * 0.35; let str = 0.12;
  let nc1 = vec3f(sc, cos(a1)/str, sin(a1)/str);
  let nc2 = vec3f(sc, cos(a2)/str, sin(a2)/str);
  let t1  = fbm4(nc1); let t2 = fbm4(nc2);
  let tb  = mix(t2, t1, blend);
  let ro  = pow(clamp(tb, 0.0, 1.0), 1.4);
  col    *= (0.35 + 0.65 * ro);
  let velDir = normalize(vec3f(-hitPos.z, 0.0, hitPos.x));
  let beta   = clamp(1.0 / sqrt(hitR / innerR) * 0.42, 0.0, 0.92);
  let cosT   = dot(velDir, rayDir);
  let D      = 1.0 / max(1.0 - beta * cosT, 0.04);
  let boost  = pow(clamp(D, 0.05, 10.0), 3.0 * u.doppler_strength);
  col       *= boost;
  let opacity = clamp(ro * edge * 1.6, 0.0, 1.0);
  return vec4f(col, opacity);
}

fn kerrAcc(pos: vec3f, vel: vec3f, a: f32) -> vec3f {
  let M  = 1.0; let z = pos.z;
  let r2 = dot(pos, pos); let r = sqrt(r2);
  if (r < 0.01) { return vec3f(0.0); }
  let a2   = a * a; let rho2 = r2 - a2;
  let disc = rho2 * rho2 + 4.0 * a2 * z * z;
  let bl_r2 = 0.5 * (rho2 + sqrt(max(disc, 0.0)));
  let bl_r  = sqrt(max(bl_r2, 0.001));
  let cosTheta = z / bl_r;
  let Sigma    = bl_r2 + a2 * cosTheta * cosTheta;
  let rFactor  = 2.0 * M * bl_r / max(Sigma * Sigma, 1e-6);
  let denom    = max(bl_r * (2.0 * bl_r2 - rho2 + a2 * z * z / bl_r2), 1e-6);
  let drdx = (pos.x * bl_r2 + a2 * pos.x) / denom;
  let drdy = (pos.y * bl_r2 + a2 * pos.y) / denom;
  let drdz = (z + a2 * z / bl_r2) / max(bl_r, 1e-6);
  let gradR    = vec3f(drdx, drdy, drdz);
  let gravAcc  = -rFactor * gradR;
  let phi_hat  = normalize(vec3f(-pos.y, pos.x, 0.0) + vec3f(0.0, 0.0, 1e-9));
  let dragMag  = 2.0 * M * a * bl_r / max(Sigma * Sigma, 1e-6);
  let dragAcc  = dragMag * cross(phi_hat, vel);
  return gravAcc + dragAcc;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px  = vec2i(gid.xy);
  let res = vec2i(i32(u.resolution.x), i32(u.resolution.y));
  if (px.x >= res.x || px.y >= res.y) { return; }

  let uv     = (vec2f(px) + 0.5) / u.resolution * 2.0 - 1.0;
  let aspect = u.resolution.x / u.resolution.y;
  let cR = u.camera_r; let cT = u.camera_theta; let cP = u.camera_phi;
  let camPos = vec3f(cR*sin(cT)*cos(cP), cR*cos(cT), cR*sin(cT)*sin(cP));
  let forward = normalize(-camPos);
  let worldUp = vec3f(0.0, 1.0, 0.0);
  let right   = normalize(cross(worldUp, forward));
  let up      = cross(forward, right);
  let fov    = 0.85;
  var rayDir = normalize(forward*fov + right*(uv.x*aspect) + up*uv.y);
  var rayPos = camPos;

  let M        = 1.0; let a = u.spin;
  let rHorizon = M + sqrt(max(M*M - a*a, 0.0));
  let rCapture = rHorizon * 1.05;
  let steps    = i32(clamp(u.lensing_steps, 64.0, 1024.0));
  let dt       = u.step_size;

  var color  = vec3f(0.0); var alpha = 0.0; var hit = false;
  var prevPos = rayPos; var prevY = rayPos.y;

  for (var i = 0; i < steps; i++) {
    let r = length(rayPos);
    if (r < rCapture) { hit = true; break; }
    let curY = rayPos.y;
    if (prevY * curY < 0.0 && alpha < 0.99) {
      let t    = prevY / (prevY - curY);
      let hPos = mix(prevPos, rayPos, t);
      let disk = accretionDisk(hPos, rayDir);
      if (disk.w > 0.005) {
        let rem = 1.0 - alpha;
        color  += disk.xyz * disk.w * rem;
        alpha  += rem * disk.w;
        if (alpha > 0.99) { break; }
      }
    }
    let k1v = kerrAcc(rayPos, rayDir, a);
    let mp  = rayPos + rayDir * (dt * 0.5);
    let mv  = normalize(rayDir + k1v * (dt * 0.5));
    let k2v = kerrAcc(mp, mv, a);
    prevPos = rayPos; prevY = curY;
    rayPos += rayDir * dt;
    rayDir  = normalize(rayDir + k2v * dt);
  }

  if (!hit) {
    let bg = starField(normalize(rayDir));
    color += bg * (1.0 - alpha);
  }

  let ex  = color * u.exposure;
  let tm  = clamp((ex*(2.51*ex+0.03))/(ex*(2.43*ex+0.59)+0.14), vec3f(0.0), vec3f(1.0));
  let fin = pow(tm, vec3f(1.0/2.2));
  textureStore(output, px, vec4f(fin, 1.0));
}
`;

// ── WebGL2 fallback shaders ───────────────────────────────────────────────────
const VERT_SRC = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

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
uniform float u_use_texture;
uniform sampler2D u_sky_tex;

float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2  hash22(vec2 p){return vec2(fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453),fract(sin(dot(p,vec2(269.5,183.3)))*43758.5453));}
float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3d(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),u.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),u.x),u.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),u.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),u.x),u.y),u.z);}
float fbm4(vec3 p){return noise3d(p)*0.5+noise3d(p*2.0)*0.25+noise3d(p*4.0)*0.125+noise3d(p*8.0)*0.0625;}

vec3 blackbody(float t){t=clamp(t,800.0,40000.0);float r=t<=6600.0?1.0:clamp(pow((t/6600.0)-1.0,-0.1332)*1.292,0.0,1.0);float g=t<=6600.0?clamp(0.39*log(t/6600.0)-0.63+1.0,0.0,1.0):clamp(pow((t/6600.0)-1.0,-0.0755)*1.1299,0.0,1.0);float b=t>=6600.0?1.0:(t<=1900.0?0.0:clamp(0.543*log(t/1000.0-10.0)-1.196,0.0,1.0));return vec3(r,g,b);}

vec3 starField(vec3 dir){float theta=atan(dir.z,dir.x);float phi=asin(clamp(dir.y,-1.0,1.0));float density=clamp(u_star_density,0.05,1.0);float gs=55.0/density;vec2 sc=vec2(theta,phi)*gs;vec2 cell=floor(sc);vec2 cuv=fract(sc);float ch=hash21(cell);float hs=step(1.0-density,ch);vec2 sp=hash22(cell+42.0)*0.8+0.1;float d=length(cuv-sp);float sz=hash21(cell+100.0)*0.025+0.007;float core=smoothstep(sz,0.0,d);float glow=smoothstep(sz*5.0,0.0,d)*0.2;float intensity=(core+glow)*hs*u_star_brightness;float ct=hash21(cell+200.0);return mix(vec3(0.65,0.82,1.0),vec3(1.0,0.90,0.72),ct)*intensity;}

vec4 accretionDisk(vec3 hitPos,vec3 rayDir){float hitR=length(hitPos.xz);if(hitR<u_disk_inner||hitR>u_disk_outer)return vec4(0.0);float tempK=u_disk_temp*1000.0*pow(u_disk_inner/hitR,0.75);vec3 col=blackbody(tempK)*u_disk_brightness;float normR=clamp((hitR-u_disk_inner)/(u_disk_outer-u_disk_inner),0.0,1.0);float edge=smoothstep(0.0,0.07,normR)*smoothstep(1.0,0.88,normR);col*=edge;float hitAngle=atan(hitPos.z,hitPos.x);float cycleLen=14.0;float ct=mod(u_time,cycleLen);float blend=ct/cycleLen;float rotSpd=0.35*u_turbulence;float ph1=ct*rotSpd/pow(hitR,1.5);float ph2=(ct+cycleLen)*rotSpd/pow(hitR,1.5);float a1=hitAngle+ph1;float a2=hitAngle+ph2;float sc=hitR*0.35;float str=0.12;float t1=fbm4(vec3(sc,cos(a1)/str,sin(a1)/str));float t2=fbm4(vec3(sc,cos(a2)/str,sin(a2)/str));float ro=pow(clamp(mix(t2,t1,blend),0.0,1.0),1.4);col*=(0.35+0.65*ro);vec3 velDir=normalize(vec3(-hitPos.z,0.0,hitPos.x));float beta=clamp(1.0/sqrt(hitR/u_disk_inner)*0.42,0.0,0.92);float D=1.0/max(1.0-beta*dot(velDir,rayDir),0.04);col*=pow(clamp(D,0.05,10.0),3.0*u_doppler_strength);return vec4(col,clamp(ro*edge*1.6,0.0,1.0));}

vec3 kerrAcc(vec3 pos,vec3 vel,float a){float r2=dot(pos,pos);float r=sqrt(r2);if(r<0.01)return vec3(0.0);float a2=a*a;float rho2=r2-a2;float disc=rho2*rho2+4.0*a2*pos.z*pos.z;float bl_r2=0.5*(rho2+sqrt(max(disc,0.0)));float bl_r=sqrt(max(bl_r2,0.001));float cosT=pos.z/bl_r;float Sigma=bl_r2+a2*cosT*cosT;float rFac=2.0*bl_r/max(Sigma*Sigma,1e-6);float denom=max(bl_r*(2.0*bl_r2-rho2+a2*pos.z*pos.z/bl_r2),1e-6);vec3 gradR=vec3((pos.x*bl_r2+a2*pos.x)/denom,(pos.y*bl_r2+a2*pos.y)/denom,(pos.z+a2*pos.z/bl_r2)/max(bl_r,1e-6));vec3 phi_hat=normalize(vec3(-pos.y,pos.x,0.0)+vec3(0.0,0.0,1e-9));float dragMag=2.0*a*bl_r/max(Sigma*Sigma,1e-6);return -rFac*gradR+dragMag*cross(phi_hat,vel);}

void main(){vec2 uv=(gl_FragCoord.xy/u_resolution)*2.0-1.0;float aspect=u_resolution.x/u_resolution.y;float cR=u_camera_r;float cT=u_camera_theta;float cP=u_camera_phi;vec3 camPos=vec3(cR*sin(cT)*cos(cP),cR*cos(cT),cR*sin(cT)*sin(cP));vec3 forward=normalize(-camPos);vec3 right=normalize(cross(vec3(0,1,0),forward));vec3 up=cross(forward,right);vec3 rayDir=normalize(forward*0.85+right*(uv.x*aspect)+up*uv.y);vec3 rayPos=camPos;float a=u_spin;float rH=1.0+sqrt(max(1.0-a*a,0.0));float rC=rH*1.05;int steps=int(clamp(u_lensing_steps,64.0,512.0));float dt=u_step_size;vec3 color=vec3(0.0);float alpha=0.0;bool hit=false;vec3 prevPos=rayPos;float prevY=rayPos.y;for(int i=0;i<512;i++){if(i>=steps)break;float r=length(rayPos);if(r<rC){hit=true;break;}float curY=rayPos.y;if(prevY*curY<0.0&&alpha<0.99){float t=prevY/(prevY-curY);vec3 hPos=mix(prevPos,rayPos,t);vec4 disk=accretionDisk(hPos,rayDir);if(disk.w>0.005){float rem=1.0-alpha;color+=disk.xyz*disk.w*rem;alpha+=rem*disk.w;if(alpha>0.99)break;}}vec3 k1v=kerrAcc(rayPos,rayDir,a);vec3 mp=rayPos+rayDir*(dt*0.5);vec3 mv=normalize(rayDir+k1v*(dt*0.5));vec3 k2v=kerrAcc(mp,mv,a);prevPos=rayPos;prevY=curY;rayPos+=rayDir*dt;rayDir=normalize(rayDir+k2v*dt);}if(!hit){color+=starField(normalize(rayDir))*(1.0-alpha);}vec3 ex=color*u_exposure;vec3 tm=clamp((ex*(2.51*ex+0.03))/(ex*(2.43*ex+0.59)+0.14),vec3(0.0),vec3(1.0));fragColor=vec4(pow(tm,vec3(1.0/2.2)),1.0);}`;

// ── Params ────────────────────────────────────────────────────────────────────
export interface BHParams {
  spin: number; cameraR: number; cameraTheta: number; cameraPhi: number;
  diskInner: number; diskOuter: number; diskTemp: number;
  dopplerStrength: number; lensingSteps: number; stepSize: number;
  starDensity: number; starBrightness: number; exposure: number;
  diskBrightness: number; turbulence: number;
}
export const DEFAULT_BH_PARAMS: BHParams = {
  spin: 0.9, cameraR: 25.0, cameraTheta: 1.3, cameraPhi: 0.0,
  diskInner: 3.0, diskOuter: 14.0, diskTemp: 12.0,
  dopplerStrength: 1.0, lensingSteps: 256, stepSize: 0.15,
  starDensity: 0.6, starBrightness: 1.2, exposure: 1.5,
  diskBrightness: 2.0, turbulence: 1.0,
};

const UNIFORM_FLOATS = 20;
function buildUniforms(w: number, h: number, t: number, p: BHParams): Float32Array {
  const d = new Float32Array(UNIFORM_FLOATS);
  d[0]=w; d[1]=h; d[2]=t; d[3]=p.spin;
  d[4]=p.cameraR; d[5]=p.cameraTheta; d[6]=p.cameraPhi;
  d[7]=p.diskInner; d[8]=p.diskOuter; d[9]=p.diskTemp;
  d[10]=p.dopplerStrength; d[11]=p.lensingSteps; d[12]=p.stepSize;
  d[13]=p.starDensity; d[14]=p.starBrightness; d[15]=p.exposure;
  d[16]=p.diskBrightness; d[17]=p.turbulence; d[18]=0; d[19]=0;
  return d;
}

// ── Blit WGSL (fullscreen quad sampler — format-agnostic) ────────────────────
const BLIT_WGSL = `
@group(0) @binding(0) var blitSampler: sampler;
@group(0) @binding(1) var blitTex: texture_2d<f32>;
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var pos = array<vec2f,4>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(1,1));
  var uv  = array<vec2f,4>(vec2f(0,1), vec2f(1,1), vec2f(0,0), vec2f(1,0));
  var o: VSOut; o.pos = vec4f(pos[vi],0,1); o.uv = uv[vi]; return o;
}
@fragment fn fs(i: VSOut) -> @location(0) vec4f {
  return textureSample(blitTex, blitSampler, i.uv);
}
`;

// ── WebGPU renderer hook ──────────────────────────────────────────────────────
interface GPUState {
  device: GPUDevice;
  pipeline: GPUComputePipeline;
  blitPipeline: GPURenderPipeline;
  blitBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  outputTexture: GPUTexture;
  bindGroup: GPUBindGroup;
  skyBindGroup: GPUBindGroup;  // binding 2+3: sampler + sky texture
  ctx: GPUCanvasContext;
  preferredFormat: GPUTextureFormat;
  w: number; h: number;
  hasSkyTex: boolean;
  skyTexture?: GPUTexture;
  skyBGL: GPUBindGroupLayout;
}

function useWebGPURenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paramsRef: React.MutableRefObject<BHParams>,
  isRunningRef: React.MutableRefObject<boolean>,
  skyBitmapRef: React.MutableRefObject<ImageBitmap | null>,
  onFps?: (fps: number) => void,
  onRendererName?: (name: string) => void
) {
  const stateRef = useRef<GPUState | null>(null);
  const startRef = useRef(performance.now());
  const rafRef = useRef(0);
  const fpsRef = useRef({ frames: 0, last: performance.now() });
  const lastBitmapRef = useRef<ImageBitmap | null>(null);

  const createOutputTexture = useCallback((device: GPUDevice, w: number, h: number) => {
    return device.createTexture({
      size: [w, h],
      format: "rgba8unorm",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
  }, []);

  const createBlitBindGroup = useCallback((device: GPUDevice, blitBGL: GPUBindGroupLayout, tex: GPUTexture) => {
    const sampler = device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
    return device.createBindGroup({
      layout: blitBGL,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: tex.createView() },
      ],
    });
  }, []);

  // Create a 1x1 dummy sky texture so the bind group is always valid
  const createDummySkyTexture = useCallback((device: GPUDevice) => {
    const tex = device.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture({ texture: tex }, new Uint8Array([0, 0, 0, 255]), { bytesPerRow: 4 }, [1, 1]);
    return tex;
  }, []);

  const createSkyBindGroup = useCallback((device: GPUDevice, skyBGL: GPUBindGroupLayout, skyTex: GPUTexture) => {
    const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "repeat", addressModeV: "clamp-to-edge" });
    return device.createBindGroup({
      layout: skyBGL,
      entries: [
        { binding: 2, resource: sampler },
        { binding: 3, resource: skyTex.createView() },
      ],
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stopped = false;

    (async () => {
      if (!navigator.gpu) { onRendererName?.("WebGL2"); return; }
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) { onRendererName?.("WebGL2"); return; }
      const device = await adapter.requestDevice();
      if (stopped) { device.destroy(); return; }

      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = w; canvas.height = h;

      const ctx = canvas.getContext("webgpu") as GPUCanvasContext;
      const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format: preferredFormat, alphaMode: "opaque" });

      const shaderModule = device.createShaderModule({ code: WGSL_SRC });
      const uniformBuffer = device.createBuffer({
        size: UNIFORM_FLOATS * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const outputTexture = createOutputTexture(device, w, h);

      // Compute BGL: binding 0 = uniforms, binding 1 = output storage texture
      const bgl = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" as GPUBufferBindingType } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE,
            storageTexture: { access: "write-only" as GPUStorageTextureAccess, format: "rgba8unorm" as GPUTextureFormat, viewDimension: "2d" as GPUTextureViewDimension } },
        ],
      });
      // Sky BGL: binding 2 = sampler, binding 3 = sky texture
      const skyBGL = device.createBindGroupLayout({
        entries: [
          { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" as GPUSamplerBindingType } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float" as GPUTextureSampleType, viewDimension: "2d" as GPUTextureViewDimension } },
        ],
      });

      const bindGroup = device.createBindGroup({
        layout: bgl,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: outputTexture.createView() },
        ],
      });
      const dummySkyTex = createDummySkyTexture(device);
      const skyBindGroup = createSkyBindGroup(device, skyBGL, dummySkyTex);

      const pipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bgl, skyBGL] }),
        compute: { module: shaderModule, entryPoint: "main" },
      });

      // Blit render pipeline
      const blitModule = device.createShaderModule({ code: BLIT_WGSL });
      const blitBGL = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" as GPUSamplerBindingType } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" as GPUTextureSampleType, viewDimension: "2d" as GPUTextureViewDimension } },
        ],
      });
      const blitPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [blitBGL] }),
        vertex:   { module: blitModule, entryPoint: "vs" },
        fragment: { module: blitModule, entryPoint: "fs", targets: [{ format: preferredFormat }] },
        primitive: { topology: "triangle-strip" as GPUPrimitiveTopology },
      });
      const blitBindGroup = createBlitBindGroup(device, blitBGL, outputTexture);

      stateRef.current = { device, pipeline, blitPipeline, blitBindGroup, uniformBuffer, outputTexture,
        bindGroup, skyBindGroup, skyBGL, ctx, preferredFormat, w, h, hasSkyTex: false, skyTexture: dummySkyTex };
      onRendererName?.("WebGPU");

      const loop = () => {
        if (stopped) return;
        rafRef.current = requestAnimationFrame(loop);
        if (!isRunningRef.current) return;

        const s = stateRef.current;
        if (!s) return;

        // Upload new sky bitmap if changed
        const bitmap = skyBitmapRef.current;
        if (bitmap !== lastBitmapRef.current) {
          lastBitmapRef.current = bitmap;
          if (bitmap) {
            const newSkyTex = device.createTexture({
              size: [bitmap.width, bitmap.height],
              format: "rgba8unorm",
              usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: newSkyTex }, [bitmap.width, bitmap.height]);
            s.skyTexture?.destroy();
            const newSkyBG = createSkyBindGroup(device, s.skyBGL, newSkyTex);
            stateRef.current = { ...s, skyTexture: newSkyTex, skyBindGroup: newSkyBG, hasSkyTex: true };
          } else {
            const dummy = createDummySkyTexture(device);
            s.skyTexture?.destroy();
            const newSkyBG = createSkyBindGroup(device, s.skyBGL, dummy);
            stateRef.current = { ...s, skyTexture: dummy, skyBindGroup: newSkyBG, hasSkyTex: false };
          }
        }

        // Resize check
        const newW = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const newH = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (newW !== s.w || newH !== s.h) {
          canvas.width = newW; canvas.height = newH;
          s.outputTexture.destroy();
          const newTex = createOutputTexture(s.device, newW, newH);
          const newBG = s.device.createBindGroup({
            layout: bgl,
            entries: [
              { binding: 0, resource: { buffer: s.uniformBuffer } },
              { binding: 1, resource: newTex.createView() },
            ],
          });
          const newBlitBG = createBlitBindGroup(s.device, s.blitPipeline.getBindGroupLayout(0), newTex);
          s.ctx.configure({ device: s.device, format: s.preferredFormat, alphaMode: "opaque" });
          stateRef.current = { ...stateRef.current!, outputTexture: newTex, bindGroup: newBG, blitBindGroup: newBlitBG, w: newW, h: newH };
        }

        const cur = stateRef.current!;
        const time = (performance.now() - startRef.current) / 1000;
        // Pass hasSkyTex flag via pad0 uniform
        const uniforms = buildUniforms(cur.w, cur.h, time, paramsRef.current);
        uniforms[18] = cur.hasSkyTex ? 1.0 : 0.0;
        cur.device.queue.writeBuffer(cur.uniformBuffer, 0, uniforms);

        const enc = cur.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(cur.pipeline);
        pass.setBindGroup(0, cur.bindGroup);
        pass.setBindGroup(1, cur.skyBindGroup);
        pass.dispatchWorkgroups(Math.ceil(cur.w / 8), Math.ceil(cur.h / 8));
        pass.end();

        // Blit compute output → canvas
        const canvasTex = cur.ctx.getCurrentTexture();
        const blitPass = enc.beginRenderPass({
          colorAttachments: [{
            view: canvasTex.createView(),
            loadOp: "clear" as GPULoadOp,
            storeOp: "store" as GPUStoreOp,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });
        blitPass.setPipeline(cur.blitPipeline);
        blitPass.setBindGroup(0, cur.blitBindGroup);
        blitPass.draw(4);
        blitPass.end();
        cur.device.queue.submit([enc.finish()]);

        fpsRef.current.frames++;
        const now = performance.now();
        if (now - fpsRef.current.last >= 1000) {
          onFps?.(fpsRef.current.frames);
          fpsRef.current.frames = 0;
          fpsRef.current.last = now;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      stateRef.current?.device.destroy();
      stateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── WebGL2 fallback renderer hook ─────────────────────────────────────────────
function useWebGL2Renderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paramsRef: React.MutableRefObject<BHParams>,
  isRunningRef: React.MutableRefObject<boolean>,
  skyBitmapRef: React.MutableRefObject<ImageBitmap | null>,
  enabled: boolean,
  onFps?: (fps: number) => void
) {
  const startRef = useRef(performance.now());
  const rafRef = useRef(0);
  const fpsRef = useRef({ frames: 0, last: performance.now() });
  const lastBitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vert = compile(gl.VERTEX_SHADER, VERT_SRC);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vert || !frag) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert); gl.attachShader(prog, frag); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);

    const uNames = ["u_resolution","u_time","u_spin","u_camera_r","u_camera_theta","u_camera_phi",
      "u_disk_inner","u_disk_outer","u_disk_temp","u_doppler_strength","u_lensing_steps","u_step_size",
      "u_star_density","u_star_brightness","u_exposure","u_disk_brightness","u_turbulence",
      "u_use_texture","u_sky_tex"];
    const u: Record<string, WebGLUniformLocation | null> = {};
    uNames.forEach(n => { u[n] = gl.getUniformLocation(prog, n); });

    // Create sky texture slot (starts as 1x1 black)
    const skyTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, skyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    let stopped = false;
    const loop = () => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(loop);
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h); }
      if (!isRunningRef.current) return;

      // Upload new bitmap if changed
      const bitmap = skyBitmapRef.current;
      if (bitmap !== lastBitmapRef.current) {
        lastBitmapRef.current = bitmap;
        gl.bindTexture(gl.TEXTURE_2D, skyTex);
        if (bitmap) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      const now = performance.now();
      const t = (now - startRef.current) / 1000;
      const p = paramsRef.current;
      gl.useProgram(prog);
      gl.uniform2f(u["u_resolution"], w, h);
      gl.uniform1f(u["u_time"], t);
      gl.uniform1f(u["u_spin"], p.spin);
      gl.uniform1f(u["u_camera_r"], p.cameraR);
      gl.uniform1f(u["u_camera_theta"], p.cameraTheta);
      gl.uniform1f(u["u_camera_phi"], p.cameraPhi);
      gl.uniform1f(u["u_disk_inner"], p.diskInner);
      gl.uniform1f(u["u_disk_outer"], p.diskOuter);
      gl.uniform1f(u["u_disk_temp"], p.diskTemp);
      gl.uniform1f(u["u_doppler_strength"], p.dopplerStrength);
      gl.uniform1f(u["u_lensing_steps"], Math.min(p.lensingSteps, 512));
      gl.uniform1f(u["u_step_size"], p.stepSize);
      gl.uniform1f(u["u_star_density"], p.starDensity);
      gl.uniform1f(u["u_star_brightness"], p.starBrightness);
      gl.uniform1f(u["u_exposure"], p.exposure);
      gl.uniform1f(u["u_disk_brightness"], p.diskBrightness);
      gl.uniform1f(u["u_turbulence"], p.turbulence);
      // Sky texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, skyTex);
      gl.uniform1i(u["u_sky_tex"], 0);
      gl.uniform1f(u["u_use_texture"], bitmap ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      fpsRef.current.frames++;
      if (now - fpsRef.current.last >= 1000) {
        onFps?.(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); gl.deleteTexture(skyTex); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, accent = "cyan", onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  accent?: "cyan"|"amber"|"white"; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const thumbColor = accent === "amber" ? "#FFB347" : accent === "white" ? "rgba(255,255,255,0.7)" : "#00E5FF";
  const trackColor = accent === "amber" ? "rgba(255,179,71,0.35)" : accent === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,229,255,0.35)";
  const labelColor = accent === "amber" ? "text-amber-400/70" : accent === "white" ? "text-white/50" : "text-cyan-400/70";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className={`font-mono text-[9px] tracking-widest uppercase ${labelColor}`}>{label}</span>
        <span className="font-mono text-[10px] text-white/50 tabular-nums">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div className="relative h-3 flex items-center">
        <div className="absolute inset-y-0 flex items-center w-full">
          <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="absolute left-0 h-px" style={{ width: `${pct}%`, background: trackColor }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-3" style={{ zIndex: 2 }} />
        <div className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
          style={{ left: `calc(${pct}% - 5px)`, background: thumbColor, boxShadow: `0 0 6px ${thumbColor}` }} />
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
  const [rendererName, setRendererName] = useState<string>("Detecting…");
  const [useGL2, setUseGL2] = useState(false);

  // Sky texture upload state
  const skyBitmapRef = useRef<ImageBitmap | null>(null);
  const [skyThumb, setSkyThumb] = useState<string | null>(null); // object URL for thumbnail
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextureUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    // Revoke previous object URL
    if (skyThumb) URL.revokeObjectURL(skyThumb);
    const url = URL.createObjectURL(file);
    skyBitmapRef.current = bitmap;
    setSkyThumb(url);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [skyThumb]);

  const clearTexture = useCallback(() => {
    if (skyThumb) URL.revokeObjectURL(skyThumb);
    skyBitmapRef.current = null;
    setSkyThumb(null);
  }, [skyThumb]);

  // Try WebGPU first; if unavailable, fall back to WebGL2
  useWebGPURenderer(canvasRef, paramsRef, isRunningRef, skyBitmapRef, setFps, (name) => {
    setRendererName(name);
    if (name === "WebGL2") setUseGL2(true);
  });
  useWebGL2Renderer(canvasRef, paramsRef, isRunningRef, skyBitmapRef, useGL2, setFps); // Camera orbit via mouse drag
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });
  const onMouseDown = useCallback((e: React.MouseEvent) => { dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }; }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY;
    setParams(p => ({ ...p, cameraPhi: p.cameraPhi - dx * 0.005, cameraTheta: Math.max(0.05, Math.min(Math.PI - 0.05, p.cameraTheta + dy * 0.005)) }));
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  // Touch orbit
  const touchRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) touchRef.current = { lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchRef.current.lastX;
    const dy = e.touches[0].clientY - touchRef.current.lastY;
    touchRef.current = { lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    setParams(p => ({ ...p, cameraPhi: p.cameraPhi - dx * 0.005, cameraTheta: Math.max(0.05, Math.min(Math.PI - 0.05, p.cameraTheta + dy * 0.005)) }));
  }, []);
  const onTouchEnd = useCallback(() => { touchRef.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setParams(p => ({ ...p, cameraR: Math.max(5, Math.min(50, p.cameraR + e.deltaY * 0.04)) }));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const set = (key: keyof BHParams) => (v: number) => setParams(p => ({ ...p, [key]: v }));

  // Derived Kerr values
  const a = params.spin;
  const rPlus = (1 + Math.sqrt(Math.max(1 - a * a, 0))).toFixed(4);
  const rMinus = (1 - Math.sqrt(Math.max(1 - a * a, 0))).toFixed(4);
  const Z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3 * a * a + Z1 * Z1);
  const rISCO = Math.max(1, 3 + Z2 - Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));

  const controlPanel = (
    <div className={`absolute top-0 left-0 bottom-0 w-56 overflow-y-auto z-20 transition-transform duration-300 ${showControls ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "rgba(0,0,5,0.82)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(0,229,255,0.1)" }}>
      <div className="p-4 space-y-5">
        <div>
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-cyan-500/50 mb-3 border-l border-cyan-500/30 pl-2">── Spacetime</div>
          <div className="space-y-4">
            <Slider label="Spin a/M" value={params.spin} min={0} max={0.999} step={0.001} accent="cyan" onChange={set("spin")} format={v => `${v.toFixed(3)} M`} />
            <Slider label="Camera r" value={params.cameraR} min={5} max={50} step={0.5} accent="cyan" onChange={set("cameraR")} format={v => `${v.toFixed(1)} M`} />
            <Slider label="Inclination θ" value={params.cameraTheta} min={0.05} max={Math.PI - 0.05} step={0.01} accent="cyan" onChange={set("cameraTheta")} format={v => `${(v * 180 / Math.PI).toFixed(1)}°`} />
          </div>
        </div>
        <div className="border border-cyan-500/10 p-3 bg-cyan-950/10">
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-cyan-500/40 mb-2">Derived</div>
          <div className="space-y-1.5 font-mono text-[9px]">
            {([["r₊", rPlus, "M"], ["r₋", rMinus, "M"], ["r_ergo", "2.0000", "M"], ["r_ISCO", rISCO.toFixed(4), "M"]] as [string,string,string][]).map(([k,v,u]) => (
              <div key={k} className="flex justify-between">
                <span className="text-cyan-500/50">{k}</span>
                <span className="text-cyan-300/70 tabular-nums">{v} {u}</span>
              </div>
            ))}
          </div>
        </div>
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

        {/* Sky Texture Upload */}
        <div>
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-white/30 mb-3 border-l border-white/15 pl-2">── Sky Texture</div>
          <div className="space-y-2">
            {skyThumb ? (
              <div className="relative">
                <img src={skyThumb} alt="Sky texture" className="w-full h-16 object-cover" style={{ border: "1px solid rgba(0,229,255,0.2)" }} />
                <button onClick={clearTexture}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/70 border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all font-mono text-[9px]">
                  ✕
                </button>
                <div className="font-mono text-[8px] text-cyan-400/50 mt-1">Custom sky active</div>
              </div>
            ) : (
              <div className="font-mono text-[8px] text-white/25 mb-1">Upload an equirectangular panorama to replace the procedural starfield.</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTextureUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-2 py-1.5 border border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-all font-mono text-[8px] tracking-widest uppercase text-center">
              {skyThumb ? "↺ Replace" : "↑ Upload Image"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  const hud = (
    <div className="absolute top-0 right-0 left-0 z-10 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(to bottom, rgba(0,0,5,0.7), transparent)" }}>
        <div className="pointer-events-auto">
          <button onClick={() => setShowControls(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            {showControls ? "Hide" : "Show"}
          </button>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="font-mono text-[9px] text-white/20 tabular-nums">{fps} fps</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${rendererName === "WebGPU" ? "bg-cyan-400" : rendererName === "WebGL2" ? "bg-amber-400" : "bg-white/30"} animate-pulse`} />
            <span className="font-mono text-[9px] text-white/30 tracking-widest">{rendererName}</span>
          </div>
          <button onClick={() => setIsRunning(v => !v)}
            className="px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase">
            {isRunning ? "⏸ Pause" : "▶ Play"}
          </button>
          <button onClick={() => setParams({ ...DEFAULT_BH_PARAMS })}
            className="px-2.5 py-1 border border-white/10 text-white/30 hover:text-white/50 hover:border-white/20 transition-all font-mono text-[9px] tracking-widest uppercase">
            ↺ Reset
          </button>
          <button onClick={() => setFullscreen(true)}
            className="px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-mono text-[9px] tracking-widest uppercase">
            ⤢ Full
          </button>
        </div>
      </div>
    </div>
  );

  const statusBar = (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,5,0.75), transparent)" }}>
      <div className="flex items-center gap-5 px-4 py-2.5 font-mono text-[9px]">
        <div className="flex items-center gap-1.5"><span className="text-cyan-500/40">a</span><span className="text-cyan-300/60 tabular-nums">= {params.spin.toFixed(3)} M</span></div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5"><span className="text-cyan-500/40">r₊</span><span className="text-cyan-300/60 tabular-nums">= {rPlus} M</span></div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5"><span className="text-amber-500/40">r_ISCO</span><span className="text-amber-300/60 tabular-nums">= {rISCO.toFixed(4)} M</span></div>
        <div className="text-white/15">·</div>
        <div className="flex items-center gap-1.5"><span className="text-white/25">renderer</span><span className="text-white/40">{rendererName}</span></div>
        <div className="ml-auto text-white/15 hidden sm:block">drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );

  const canvasEl = (
    <canvas ref={canvasRef} className="w-full h-full block"
      style={{ cursor: "grab", touchAction: "none" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onWheel={onWheel} />
  );

  const inner = (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#000005" }}>
      {canvasEl}
      {controlPanel}
      {hud}
      {statusBar}
    </div>
  );

  return (
    <>
      <div className="relative w-full" style={{ height: "80vh", minHeight: "520px" }}>
        <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-cyan-500/30 z-30 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-cyan-500/30 z-30 pointer-events-none" />
        {inner}
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/15 bg-black/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-1.5 rounded-full ${rendererName === "WebGPU" ? "bg-cyan-400" : "bg-amber-400"} animate-pulse`} />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400/70">GARGANTUA · {rendererName} Live</span>
            </div>
            <button onClick={() => setFullscreen(false)}
              className="flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all font-mono text-[10px] tracking-widest uppercase">
              ✕ Exit · Esc
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">{inner}</div>
        </div>
      )}
    </>
  );
}
