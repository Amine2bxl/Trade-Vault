import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { createNeuralEngine, type NeuralEngine } from "./neural/engine";
import { canvasDpr, particleBudget, type DeviceProfile, type JarvisMode } from "./neural/modes";

export type { JarvisMode } from "./neural/modes";
export { JARVIS_MODES } from "./neural/modes";

/** Ce que l'appareil annonce — lu une fois, au montage. */
function deviceProfile(): DeviceProfile {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    cores: nav.hardwareConcurrency || 4,
    memoryGb: nav.deviceMemory || 4,
    coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    saveData: !!nav.connection?.saveData,
  };
}

/**
 * LE CŒUR NEURONAL DE JARVIS — l'agent qui se voit penser.
 *
 * Un nuage de particules sur la carte graphique, dont la FORME dit ce que fait
 * Jarvis : il respire, écoute, comprend, analyse, réfléchit, révise, rédige,
 * parle (voir `neural/modes.ts`). Un changement de mode est un morphing : les
 * particules quittent une forme pour l'autre.
 *
 * C'est, avec `JarvisOrb` dont il prend la suite sur les grandes surfaces, la
 * seule exception décorative de l'application — demandée pour qu'on SENTE un
 * agent au travail. Il en respecte le reste :
 *   • rien ne tourne hors de l'écran ni dans un onglet caché ;
 *   • `prefers-reduced-motion` : une image fixe par mode, aucune boucle ;
 *   • sans WebGL (ou contexte perdu) : `fallback`, l'orbe CSS ;
 *   • la densité s'adapte à la taille et à l'appareil, puis en direct.
 *
 * Il remplit son conteneur : donner une taille (`size`) ou un parent dimensionné.
 */
export function JarvisNeural({
  mode,
  size,
  className,
  label,
  fallback = null,
  keepAlive = false,
}: {
  mode: JarvisMode;
  /** Côté en pixels CSS ; absent = remplit le parent. */
  size?: number;
  className?: string;
  /** Nom accessible — sinon l'élément est décoratif. */
  label?: string;
  /** Rendu si WebGL est indisponible. */
  fallback?: ReactNode;
  /** Ne jamais geler au repos — pour un petit cœur qui doit rester vivant. */
  keepAlive?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NeuralEngine | null>(null);
  const modeRef = useRef(mode);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
    engineRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || failed) return;

    const device = deviceProfile();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const box = wrap.getBoundingClientRect();
    const side = Math.max(1, Math.min(box.width || size || 1, box.height || size || 1));
    const engine = createNeuralEngine(canvas, {
      count: particleBudget(side, device),
      mode: modeRef.current,
      reducedMotion,
      idleFreeze: !keepAlive,
      onLost: () => setFailed(true),
    });
    if (!engine) {
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    const dpr = canvasDpr(window.devicePixelRatio, device);
    engine.resize(box.width || side, box.height || side, dpr);

    // Visible = dans l'écran ET onglet actif. Hors de ces deux conditions,
    // la boucle est arrêtée : zéro image, zéro batterie.
    let onScreen = false;
    const sync = () => engine.setVisible(onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "64px" },
    );
    io.observe(wrap);
    document.addEventListener("visibilitychange", sync);

    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      if (r.width > 0 && r.height > 0) engine.resize(r.width, r.height, dpr);
    });
    ro.observe(wrap);

    // Inclinaison au pointeur : pointeur fin seulement, sans re-rendu React.
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      engine.setTilt(
        ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
        ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1,
      );
    };
    const onLeave = () => engine.setTilt(0, 0);
    if (fine && !reducedMotion) {
      wrap.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave, { passive: true });
    }

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      engine.destroy();
      engineRef.current = null;
    };
    // Le moteur se crée une fois par montage ; la taille suit par ResizeObserver
    // et le mode par l'effet ci-dessus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  return (
    <div
      ref={wrapRef}
      className={cn("tv-neural", className)}
      style={size ? { width: size, height: size } : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-mode={mode}
    >
      {failed ? fallback : <canvas ref={canvasRef} className="tv-neural-canvas" />}
    </div>
  );
}
