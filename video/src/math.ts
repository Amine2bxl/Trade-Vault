import type { Cam } from "./types";

/** Hasard déterministe : même frame → même valeur, à chaque rendu. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const lerpCam = (a: Cam, b: Cam, p: number) => {
  const m = (x: number | undefined, y: number | undefined, d: number) =>
    (x ?? d) + ((y ?? d) - (x ?? d)) * p;
  return {
    fx: m(a.fx, b.fx, 0),
    fy: m(a.fy, b.fy, 0),
    z: m(a.z, b.z, 1),
    ax: m(a.ax, b.ax, 0.5),
    ay: m(a.ay, b.ay, 0.5),
    rx: m(a.rx, b.rx, 0),
    ry: m(a.ry, b.ry, 0),
  };
};
