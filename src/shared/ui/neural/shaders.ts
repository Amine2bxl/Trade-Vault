/**
 * LES SHADERS DU CŒUR NEURONAL — toutes les formes vivent sur la carte graphique.
 *
 * Le composant d'origine (nébuleuse three.js) recalculait 50 000 particules en
 * JavaScript à chaque image, en créant plusieurs objets par particule, puis
 * ajoutait un bloom en post-traitement : des millions d'allocations par
 * seconde, un fil principal saturé, un téléphone qui chauffe. Ici, le CPU ne
 * fait RIEN par particule : il pose une dizaine d'uniformes par image, et le
 * vertex shader calcule la position de chaque particule dans l'ancienne forme
 * et dans la nouvelle, puis les mélange. Pas de bloom : le halo vient du
 * mélange additif de points doux, gratuit.
 *
 * GLSL ES 1.00 : compatible WebGL 1, donc avec tous les navigateurs encore en
 * circulation.
 */

/** Le morceau commun : les huit formes et le morphing. */
const SHAPES = /* glsl */ `
precision highp float;
const float PI = 3.14159265;
const float TAU = 6.28318531;

uniform float uTime;
uniform float uFrom;
uniform float uTo;
uniform float uMix;
uniform float uLevel;

vec3 sphereDir(vec2 s) {
  float th = TAU * s.x;
  float z = s.y * 2.0 - 1.0;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(th), z, r * sin(th));
}
vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
vec3 rotX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
vec3 clusterCenter(float k) {
  return sphereDir(vec2(fract(k * 0.618034 + 0.13), fract(k * 0.381966 + 0.27) * 0.8 + 0.1)) * 0.9;
}

// xyz = position, w = éclat. m = mode (ordre de JARVIS_MODES).
vec4 shape(float m, vec4 s, float kind, float t) {
  vec3 dir = sphereDir(s.xy);
  vec3 p;
  float b = 1.0;

  // Le NOYAU : une petite masse dense au centre, qui rayonne quand Jarvis parle.
  if (kind > 0.5) {
    float cr = 0.2 * pow(s.z, 0.6);
    if (m > 6.5) {
      float ph = fract(s.w + t * 0.9);
      return vec4(dir * (0.06 + ph * 0.5), 1.7 * (1.0 - ph));
    }
    if (m > 3.5 && m < 4.5) {
      return vec4(vec3(dir.x, dir.y * 0.35, dir.z) * cr * 1.3, 1.3);
    }
    return vec4(dir * cr * (1.0 + 0.15 * sin(t * 2.0 + s.w * TAU)), 1.15);
  }

  if (m < 0.5) {
    // RESPIRE — une sphère qui inspire et expire.
    float br = 1.0 + 0.04 * sin(t * 0.9);
    float n = sin(dot(dir, vec3(3.1, 2.3, 1.7)) * 2.0 + t * 0.6);
    p = dir * (br + 0.05 * n * (s.z - 0.5) + (s.w - 0.5) * 0.06);
  } else if (m < 1.5) {
    // ÉCOUTE — des ondes courent sur la sphère, du haut vers le bas.
    float ring = sin(dir.y * 14.0 - t * 5.0);
    p = dir * (1.0 + 0.07 * ring + (s.w - 0.5) * 0.04);
    b = 0.75 + 0.45 * max(ring, 0.0);
  } else if (m < 2.5) {
    // COMPREND — un vortex qui aspire l'information vers le noyau.
    float ph = fract(s.w + t * 0.22);
    float r = mix(1.15, 0.22, ph);
    float a = TAU * s.x + ph * 7.0;
    float h = (s.y * 2.0 - 1.0) * (1.0 - ph) * 0.5;
    p = rotX(vec3(cos(a) * r, h, sin(a) * r), 0.85);
    b = 0.45 + ph;
  } else if (m < 3.5) {
    // ANALYSE — un réseau de neurones : des grappes et des synapses où le
    // signal circule.
    float k = floor(s.x * 9.0);
    vec3 c = clusterCenter(k);
    if (s.w < 0.62) {
      vec3 off = vec3(s.y, s.z, fract(s.w * 7.13)) - 0.5;
      p = c + off * 0.3 * (0.65 + 0.35 * sin(t * 1.3 + k));
      b = 0.95;
    } else {
      float k2 = mod(k + 1.0 + floor(s.z * 3.0), 9.0);
      float f = fract(s.y + t * 0.3);
      p = normalize(mix(c, clusterCenter(k2), f) + 1e-4) * 0.9;
      p += (vec3(s.z, fract(s.y * 3.7), s.w) - 0.5) * 0.025;
      b = 0.55 + 0.9 * pow(sin(f * PI), 6.0);
    }
  } else if (m < 4.5) {
    // RÉFLÉCHIT — une galaxie : trois bras, rotation plus rapide au centre.
    float arm = floor(s.x * 3.0);
    float r = 0.12 + 1.05 * pow(s.y, 0.75);
    float a = arm * TAU / 3.0 + r * 3.4 - t * 0.9 / (r + 0.35) + (s.z - 0.5) * 0.55;
    float y = (s.w - 0.5) * 0.14 * (1.3 - r);
    p = rotX(vec3(cos(a) * r, y, sin(a) * r), 0.95);
    b = 0.7 + 0.6 * (1.0 - s.y);
  } else if (m < 5.5) {
    // RÉVISE — une sphère en treillis, balayée par un scan.
    float lat = floor(acos(dir.y) / PI * 22.0 + 0.5) / 22.0 * PI;
    float lon = floor(s.x * 44.0 + 0.5) / 44.0 * TAU;
    vec3 g = vec3(sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
    float dy = (g.y - sin(t * 1.3)) * 5.0;
    float band = exp(-dy * dy);
    p = g * (0.97 + 0.07 * band) + (vec3(s.z, s.w, s.y) - 0.5) * 0.015;
    b = 0.5 + 1.3 * band;
  } else if (m < 6.5) {
    // RÉDIGE — un anneau où l'information circule.
    float u = TAU * s.x + t * 0.55;
    float v = TAU * s.y;
    float rr = 0.1 + 0.05 * sin(u * 5.0 + t * 2.2) + (s.z - 0.5) * 0.05;
    float R = 0.92 + 0.04 * sin(u * 3.0 - t * 1.4);
    p = vec3((R + rr * cos(v)) * cos(u), rr * sin(v) * 1.4 + 0.07 * sin(u * 4.0 + t * 1.8),
      (R + rr * cos(v)) * sin(u));
    p = rotX(p, 1.2);
    b = 0.7 + 0.5 * (0.5 + 0.5 * sin(u * 2.0 - t * 3.0));
  } else {
    // PARLE — la sphère vibre comme une membrane.
    float th = TAU * s.x;
    float ph = acos(dir.y);
    float w = sin(3.0 * th + t * 6.0) * cos(2.0 * ph - t * 4.5);
    float w2 = sin(5.0 * ph + t * 7.0) * 0.5;
    p = dir * (0.92 + uLevel * (0.11 * w + 0.04 * w2) + (s.w - 0.5) * 0.03);
    b = 0.8 + 0.5 * abs(w);
  }
  return vec4(p, b);
}

// Le morphing : chaque particule part avec un léger décalage (s.z), et
// l'ensemble « inspire » pendant le passage — c'est ce qui le rend organique.
vec4 morph(vec4 s, float kind) {
  vec4 a = shape(uFrom, s, kind, uTime);
  vec4 b = shape(uTo, s, kind, uTime);
  float k = smoothstep(s.z * 0.4, s.z * 0.4 + 0.6, uMix);
  vec3 p = mix(a.xyz, b.xyz, k);
  p += normalize(p + 1e-4) * sin(PI * k) * 0.16 * (1.0 - kind * 0.6);
  return vec4(p, mix(a.w, b.w, k));
}
`;

/** La projection commune : rotation, inclinaison au pointeur, perspective. */
const PROJECT = /* glsl */ `
uniform float uRot;
uniform vec2 uTilt;
uniform vec2 uScale;

vec4 project(vec3 q, out float depth, out float persp) {
  vec3 p = rotY(q, uRot + uTilt.x * 0.45);
  p = rotX(p, 0.18 + uTilt.y * 0.3);
  persp = 3.2 / (3.2 - p.z);
  depth = clamp((p.z + 1.2) / 2.4, 0.0, 1.0);
  return vec4(p.x * persp * uScale.x, p.y * persp * uScale.y, 0.0, 1.0);
}
`;

export const POINT_VERTEX = /* glsl */ `${SHAPES}${PROJECT}
attribute vec4 aSeed;
attribute float aKind;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uPointSize;
uniform float uGlow;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 q = morph(aSeed, aKind);
  float depth;
  float persp;
  gl_Position = project(q.xyz, depth, persp);
  gl_PointSize = uPointSize * persp * (aKind > 0.5 ? 1.5 : 1.0) * (0.75 + 0.5 * aSeed.w);
  vec3 col = mix(uColorA, uColorB, aSeed.y);
  vColor = aKind > 0.5 ? mix(col, vec3(1.0), 0.35) : col;
  vAlpha = uGlow * q.w * (0.25 + 0.75 * depth) * 0.6;
}
`;

export const POINT_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float a = vAlpha * (1.0 - d) * (1.0 - d);
  gl_FragColor = vec4(vColor * a, a);
}
`;

/** Les liaisons : chaque sommet connaît les deux bouts pour s'effacer quand
 *  la liaison s'étire (une synapse longue traverserait toute la forme). */
export const LINE_VERTEX = /* glsl */ `${SHAPES}${PROJECT}
attribute vec4 aSeed;
attribute vec4 aSeedB;
attribute float aEnd;
uniform float uLinks;
varying float vAlpha;

void main() {
  vec3 pa = morph(aSeed, 0.0).xyz;
  vec3 pb = morph(aSeedB, 0.0).xyz;
  float len = distance(pa, pb);
  float depth;
  float persp;
  gl_Position = project(aEnd < 0.5 ? pa : pb, depth, persp);
  vAlpha = uLinks * (1.0 - smoothstep(0.28, 0.6, len)) * (0.25 + 0.75 * depth) * 0.6;
}
`;

export const LINE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColorA;
varying float vAlpha;

void main() {
  gl_FragColor = vec4(uColorA * vAlpha, vAlpha);
}
`;
