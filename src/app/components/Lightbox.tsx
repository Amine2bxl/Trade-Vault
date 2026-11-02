import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "@/shared/ui/icons";
import { useT } from "../i18n/LanguageContext";
import { useScreenshotUrls } from "../hooks/useScreenshotUrls";
import { ScreenshotImage } from "./ScreenshotImage";

interface LightboxProps {
  /** Chemins des captures (stockage ou `data:`) : les liens sont résolus ici,
   *  et re-signés s'ils expirent pendant qu'on regarde. */
  paths: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export default function Lightbox({ paths, index, onClose, onIndexChange }: LightboxProps) {
  const { t } = useT();
  const urls = useScreenshotUrls(paths);
  const hasMultiple = paths.length > 1;

  const prev = useCallback(() => {
    onIndexChange((index - 1 + paths.length) % paths.length);
  }, [index, paths.length, onIndexChange]);

  const next = useCallback(() => {
    onIndexChange((index + 1) % paths.length);
  }, [index, paths.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) prev();
      else if (e.key === "ArrowRight" && hasMultiple) next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, hasMultiple]);

  const path = paths[index];
  if (!path) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--tv-z-top)] bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      {/* Controls are anchored to the viewport, not the image, so they stay put
          regardless of the image's natural aspect ratio / size. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("common.close")}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 md:top-6 md:right-6 w-12 h-12 md:w-11 md:h-11 rounded-full glass-strong border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-90 transition z-20"
      >
        <X className="w-5 h-5" />
      </button>

      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t("common.previous")}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass-strong border border-white/10 text-white flex items-center justify-center hover:bg-white/10 hover:scale-105 transition z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t("common.next")}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass-strong border border-white/10 text-white flex items-center justify-center hover:bg-white/10 hover:scale-105 transition z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="tv-figure tv-figure-secondary absolute bottom-5 md:bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass-strong border border-white/10 text-[11px] text-slate-300 z-10">
            {index + 1} / {paths.length}
          </div>
        </>
      )}

      {/* Tapping anywhere in the dim area — including the empty space around the
          image — closes. Only the image itself swallows the click, so on mobile
          there's a huge, forgiving exit zone and no fiddly corner-only target. */}
      <div className="w-full h-full flex items-center justify-center p-4 md:p-5">
        <div onClick={(e) => e.stopPropagation()}>
          <ScreenshotImage
            path={path}
            url={urls[path] ?? ""}
            alt={`Screenshot ${index + 1}`}
            boxClassName="h-40 w-64 rounded-2xl border border-white/[0.08] bg-black/40"
            className="max-w-[92vw] max-h-[82vh] md:max-w-[80vw] md:max-h-[84vh] object-contain rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.08] animate-slide-in"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
