// Ashima 3D simplex noise
export const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`

export const particlesVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uIntro;
uniform float uTurb;
uniform float uTheme;
uniform float uOpacity;
uniform float uMouseStrength;
uniform float uW[5];
uniform vec3 uMouse;
uniform vec3 uInk;
uniform vec3 uSteel;
uniform vec3 uT0;
uniform vec3 uT1;
uniform vec3 uT2;
uniform vec3 uT3;

attribute vec3 aP0;
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute vec3 aP4;
attribute vec4 aRand;

varying vec3 vColor;
varying float vAlpha;

${noise}

vec3 temper(float t){
  t = fract(t);
  if (t < 0.333) return mix(uT0, uT1, t * 3.0);
  if (t < 0.666) return mix(uT1, uT2, (t - 0.333) * 3.0);
  return mix(uT2, uT3, (t - 0.666) * 3.0);
}

void main(){
  vec3 p = aP0 * uW[0] + aP1 * uW[1] + aP2 * uW[2] + aP3 * uW[3] + aP4 * uW[4];
  float peak = max(max(max(uW[0], uW[1]), max(uW[2], uW[3])), uW[4]);
  float chaos = clamp((1.0 - peak) * 2.2, 0.0, 1.2);

  float t = uTime * 0.22;
  vec3 q = p * 0.55;
  vec3 n = vec3(
    snoise(q + vec3(t, 0.0, 0.0)),
    snoise(q + vec3(0.0, t + 17.1, 0.0)),
    snoise(q + vec3(0.0, 0.0, t + 31.7))
  );
  p += n * (0.016 + chaos * 0.85 + uTurb * 0.12) * (0.6 + aRand.z * 0.8);

  // intro: particles bloom out from the centre
  float k = clamp(uIntro * 1.7 - aRand.x * 0.7, 0.0, 1.0);
  k = 1.0 - pow(1.0 - k, 3.0);
  p = mix(n * 0.12, p, k);

  vec4 wp = modelMatrix * vec4(p, 1.0);

  // cursor repulsion (world space, on the z = 0 plane)
  vec3 d = wp.xyz - uMouse;
  float dist = length(d.xy);
  float f = (1.0 - smoothstep(0.0, 1.05, dist)) * uMouseStrength;
  wp.xyz += normalize(d + vec3(0.0, 0.0, 0.001)) * f * 0.5;

  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.45 + aRand.w * 0.9) * (1.0 + f * 0.8);
  gl_PointSize = size * uPixelRatio / -mv.z;

  vec3 base = mix(uInk, uSteel, uTheme);
  float tinted = step(0.7, aRand.z);
  vec3 tint = temper(aRand.y + p.x * 0.08);
  vColor = mix(base, tint, clamp(tinted + f * 1.5 + chaos * 0.5, 0.0, 1.0));
  float depth = smoothstep(-2.6, 2.2, wp.z);
  vAlpha = k * uOpacity * (0.25 + 0.55 * aRand.w) * (0.35 + 0.65 * depth);
}
`

export const particlesFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.18, d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`

export const quadVert = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Mouse trail: velocity (rg) + intensity (b), advected and decayed each frame.
export const trailFrag = /* glsl */ `
uniform sampler2D tPrev;
uniform vec2 uMouse;
uniform vec2 uVel;
uniform float uAspect;
uniform float uRadius;
uniform float uDecay;
uniform float uActive;
varying vec2 vUv;
void main(){
  vec4 cur = texture2D(tPrev, vUv);
  vec4 prev = texture2D(tPrev, vUv - cur.xy * 0.012);
  prev.xyz *= uDecay;
  vec2 d = vUv - uMouse;
  d.x *= uAspect;
  float s = exp(-dot(d, d) / uRadius) * uActive;
  float speed = clamp(length(uVel) * 3.0, 0.0, 1.0);
  prev.xy += uVel * s;
  prev.z += s * speed;
  prev.xy = clamp(prev.xy, vec2(-1.0), vec2(1.0));
  prev.z = clamp(prev.z, 0.0, 1.0);
  gl_FragColor = vec4(prev.xyz, 1.0);
}
`

// Composite: trail-driven displacement + chromatic split over the particle layer.
export const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tTrail;
uniform float uStrength;
varying vec2 vUv;
void main(){
  vec4 tr = texture2D(tTrail, vUv);
  vec2 off = tr.xy * 0.05 * uStrength;
  float m = tr.z;
  vec4 r = texture2D(tScene, vUv - off);
  vec4 g = texture2D(tScene, vUv - off * (1.0 + m * 0.8));
  vec4 b = texture2D(tScene, vUv - off * (1.0 + m * 1.6));
  gl_FragColor = vec4(r.r, g.g, b.b, max(r.a, max(g.a, b.a)));
}
`
