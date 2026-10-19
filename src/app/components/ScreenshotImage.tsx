import { useState } from "react";
import { ImageOff, RotateCw } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { useT } from "../i18n/LanguageContext";
import {
  isScreenshotUnavailable,
  reportBrokenScreenshot,
  retryScreenshot,
} from "../store/screenshotUrls";

/**
 * UNE CAPTURE, TOUJOURS VISIBLE — ou dite indisponible, jamais cassée.
 *
 * Trois états, et aucun n'est l'icône cassée du navigateur :
 *   • lien pas encore prêt (signature, nouvelle tentative) : un indicateur ;
 *   • lien prêt : l'image, révélée seulement une fois CHARGÉE ; si elle
 *     échoue, le lien est jeté et re-signé automatiquement
 *     (`store/screenshotUrls.ts`) ;
 *   • après plusieurs échecs : une tuile « Capture indisponible · Réessayer ».
 *
 * `url` vient de `useScreenshotUrls`, qui redessine le parent à chaque
 * changement d'état d'une capture.
 */
export function ScreenshotImage({
  path,
  url,
  alt,
  className,
  boxClassName,
}: {
  path: string;
  url: string;
  alt: string;
  /** Classes de l'image (taille, `object-*`…). */
  className?: string;
  /** Classes de l'emplacement affiché pendant le chargement ou l'indisponibilité. */
  boxClassName?: string;
}) {
  const { t } = useT();
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  if (isScreenshotUnavailable(path)) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 text-center text-slate-500",
          boxClassName,
        )}
      >
        <ImageOff className="h-5 w-5" aria-hidden />
        <span className="text-xs">{t("screenshot.unavailable")}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            retryScreenshot(path);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              retryScreenshot(path);
            }
          }}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--tv-highlight)] hover:bg-white/5"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          {t("error.retry")}
        </span>
      </div>
    );
  }

  const loaded = url !== "" && loadedSrc === url;
  return (
    <>
      {!loaded && (
        <div className={cn("flex items-center justify-center", boxClassName)}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--tv-border)] border-t-[var(--tv-accent)]" />
        </div>
      )}
      {url !== "" && (
        <img
          key={url}
          src={url}
          alt={alt}
          decoding="async"
          onLoad={() => setLoadedSrc(url)}
          onError={() => reportBrokenScreenshot(path)}
          className={cn(className, !loaded && "hidden")}
        />
      )}
    </>
  );
}
