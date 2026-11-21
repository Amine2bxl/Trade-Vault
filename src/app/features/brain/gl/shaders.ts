/**
 * Shaders du Neural Brain (WebGL2). La projection est EXACTEMENT celle de
 * `camera.ts` (orbite lacet/tangage, perspective) : le CPU projette les mêmes
 * points pour la sélection et les libellés, sans écart d'un pixel.
 */

const CAMERA = /* glsl */ `
uniform vec3 u_target;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_distance;
uniform float u_focal;
uniform vec2 u_view;
uniform float u_dpr;

vec3 toView(vec3 p) {
  vec3 q = p - u_target;
  float cy = cos(u_yaw);
  float sy = sin(u_yaw);
  float x1 = cy * q.x + sy * q.z;
  float z1 = -sy * q.x + cy * q.z;
  float cp = cos(u_pitch);
  float sp = sin(u_pitch);
  float y2 = cp * q.y - sp * z1;
  float z2 = sp * q.y + cp * z1;
  return vec3(x1, y2, z2 + u_distance);
}

vec4 clipOf(vec3 v) {
  float s = u_focal / v.z;
  return vec4(v.x * s / (u_view.x * 0.5), v.y * s / (u_view.y * 0.5), 0.0, 1.0);
}

float fogOf(float z) {
  return clamp(1.3 - z / (u_distance * 2.1), 0.16, 1.0);
}
`;

/** Marge du sprite autour du nœud : la place de la lueur. */
export const NODE_MARGIN = 2.4;

export const NODE_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 a_pos;
in vec3 a_color;
in float a_size;
in float a_shape;
in vec2 a_state;
${CAMERA}
uniform float u_reveal;
out vec3 v_color;
out float v_shape;
out float v_alpha;
out float v_emph;
void main() {
  vec3 v = toView(a_pos);
  if (v.z < 12.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = clipOf(v);
  float scale = clamp(u_distance / v.z, 0.35, 2.4);
  gl_PointSize = a_size * scale * u_dpr * 2.0 * ${NODE_MARGIN.toFixed(1)};
  v_alpha = a_state.x * fogOf(v.z) * u_reveal;
  v_emph = a_state.y;
  v_color = a_color;
  v_shape = a_shape;
}`;

export const NODE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 v_color;
in float v_shape;
in float v_alpha;
in float v_emph;
uniform float u_glow;
uniform vec3 u_accent;
out vec4 o;

// Distance normalisée à un polygone régulier : 1.0 sur le bord.
float poly(vec2 p, float n, float rot, float r) {
  float a = atan(p.y, p.x) - rot;
  float b = 6.2831853 / n;
  return cos(floor(0.5 + a / b) * b - a) * length(p) / (cos(3.1415927 / n) * r);
}

float shapeDist(vec2 p, float k) {
  if (k < 0.5) return length(p);
  if (k < 1.5) return poly(p, 4.0, 0.0, 1.15);
  if (k < 2.5) return poly(p, 3.0, -1.5707963, 1.25);
  if (k < 3.5) return poly(p, 4.0, 0.7853982, 1.2);
  if (k < 4.5) return poly(p, 6.0, 0.0, 1.05);
  if (k < 5.5) return poly(p, 5.0, -1.5707963, 1.1);
  if (k < 6.5) return poly(p, 3.0, 1.5707963, 1.25);
  vec2 q = abs(p) / 1.35;
  return pow(sqrt(q.x) + sqrt(q.y), 2.0);
}

void main() {
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * ${NODE_MARGIN.toFixed(1)};
  p.y = -p.y;
  float d = shapeDist(p, v_shape);
  float core = 1.0 - smoothstep(0.9, 1.0, d);
  // Lueur bornée : décroissance rapide, intensité plafonnée par u_glow.
  float glow = exp(-3.2 * max(d - 1.0, 0.0)) * (1.0 - core) * u_glow * (0.6 + 0.6 * v_emph);
  float ring = (smoothstep(1.3, 1.38, d) - smoothstep(1.5, 1.58, d)) * step(0.5, v_emph);
  vec3 col = v_color * core + v_color * glow + u_accent * ring;
  float a = max(core, max(glow, ring)) * v_alpha;
  if (a < 0.004) discard;
  o = vec4(col * v_alpha, a);
}`;

export const EDGE_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 a_pos;
in vec4 a_color;
in float a_t;
in float a_len;
in float a_dash;
${CAMERA}
uniform float u_reveal;
out vec4 v_color;
out float v_t;
out float v_len;
out float v_dash;
void main() {
  vec3 v = toView(a_pos);
  if (v.z < 12.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  gl_Position = clipOf(v);
  v_color = vec4(a_color.rgb, a_color.a * fogOf(v.z) * u_reveal);
  v_t = a_t;
  v_len = a_len;
  v_dash = a_dash;
}`;

export const EDGE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_color;
in float v_t;
in float v_len;
in float v_dash;
out vec4 o;
void main() {
  // Une HYPOTHÈSE est en pointillés : elle ne ressemble jamais à un fait.
  if (v_dash > 0.5 && fract(v_t * v_len / 9.0) > 0.45) discard;
  o = vec4(v_color.rgb * v_color.a, v_color.a);
}`;

export const FLOW_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 a_from;
in vec3 a_to;
in float a_phase;
in float a_speed;
in vec3 a_color;
${CAMERA}
uniform float u_time;
out vec3 v_color;
out float v_alpha;
void main() {
  float k = fract(a_phase + u_time * a_speed);
  vec3 v = toView(mix(a_from, a_to, k));
  if (v.z < 12.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = clipOf(v);
  gl_PointSize = 7.0 * clamp(u_distance / v.z, 0.5, 2.0) * u_dpr;
  // Entrée et sortie en fondu : la particule naît et meurt sur le lien.
  v_alpha = sin(k * 3.1415927) * fogOf(v.z);
  v_color = a_color;
}`;

export const FLOW_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 v_color;
in float v_alpha;
out vec4 o;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  float a = exp(-5.0 * d * d) * v_alpha;
  if (a < 0.01) discard;
  o = vec4(v_color * a, a);
}`;

export const STAR_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 a_pos;
in float a_size;
in float a_alpha;
${CAMERA}
uniform float u_reveal;
out float v_alpha;
void main() {
  vec3 v = toView(a_pos);
  if (v.z < 12.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = clipOf(v);
  gl_PointSize = a_size * u_dpr;
  v_alpha = a_alpha * u_reveal;
}`;

export const STAR_FS = /* glsl */ `#version 300 es
precision highp float;
in float v_alpha;
out vec4 o;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * v_alpha;
  if (a < 0.01) discard;
  o = vec4(vec3(0.78, 0.84, 0.95) * a, a);
}`;
