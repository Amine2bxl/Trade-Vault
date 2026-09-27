import type { ShotId } from "./assets";
import type { EaseName } from "./theme";

/** Caméra : le point (fx, fy) de la capture — fractions 0..1 de l'image — est
    posé au point (ax, ay) de l'écran (0.5 = centre), grossi z fois, incliné de
    rx/ry degrés. z = 1 → la capture fait 1600 px de large. */
export type Cam = {
  fx: number;
  fy: number;
  z: number;
  ax?: number;
  ay?: number;
  rx?: number;
  ry?: number;
};

/** Comment le plan ENTRE (la sortie du plan précédent en découle). */
export type Enter = "cut" | "fade" | "whip-left" | "whip-right" | "whip-up" | "zoom" | "wipe";

/** Une ligne de texte. `*mot*` = mot en émeraude. `at` en temps, depuis le début du plan. */
export type Line = { at: number; text: string; fx?: "rise" | "type" | "glitch" };

/** Rectangle dans la capture : [x, y, largeur, hauteur], fractions 0..1. */
export type Box = [number, number, number, number];

/** Surlignage posé SUR l'UI réelle, à un temps donné (un « tic » sonore l'accompagne). */
export type Mark = {
  at: number;
  box: Box;
  tone?: "accent" | "red";
  pill?: boolean;
  check?: [number, number];
};

export type Scene = {
  id: string;
  beat: number;
  len: number;
  shot: ShotId;
  /** [départ, arrivée] — interpolés sur toute la durée du plan. */
  cam: [Cam, Cam];
  ease?: EaseName;
  enter?: Enter;
  /** Impact visuel + sonore à l'entrée (flash, sub-drop). */
  impact?: boolean;
  /** « dim » : la capture éteinte et floue — le produit traité comme le problème. */
  look?: "dim";
  label?: string;
  copy?: Line[];
  pos?: "center" | "left" | "bottom";
  size?: number;
  /** Révélation par bandes horizontales (bords, fractions de la hauteur). */
  bands?: number[];
  stagger?: number;
  marks?: Mark[];
  /** La lueur émeraude derrière la capture, comme le héros de la LP. */
  halo?: boolean;
};

export type Flash = { shot: ShotId; cam: Cam };
