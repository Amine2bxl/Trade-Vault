import { useEffect, useRef, useState } from "react";

// Official Trustpilot TrustBox — live rating + real review count, rendered by
// Trustpilot's own script (CSP allows widget.trustpilot.com for script/frame).
//
// Requires VITE_TRUSTPILOT_BUSINESS_UNIT_ID (from the Trustpilot Business
// dashboard → TrustBox setup). Until it's set, render nothing: callers keep
// their static fallback and the page never shows a broken embed.

declare global {
  interface Window {
    Trustpilot?: { loadFromElement: (el: HTMLElement, force?: boolean) => void };
  }
}

const SCRIPT_SRC = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";
// "Micro Review Count" TrustBox — global score + number of reviews, compact.
const TEMPLATE_ID = "5419b6a8b0d04a076446a9ad";

export const TRUSTPILOT_BUSINESS_UNIT_ID: string | undefined = import.meta.env
  .VITE_TRUSTPILOT_BUSINESS_UNIT_ID as string | undefined;

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("trustpilot script failed"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export default function TrustpilotWidget({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TRUSTPILOT_BUSINESS_UNIT_ID) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (!cancelled && ref.current) window.Trustpilot?.loadFromElement(ref.current, true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!TRUSTPILOT_BUSINESS_UNIT_ID || failed) return null;

  return (
    <div
      ref={ref}
      className={`trustpilot-widget ${className}`}
      data-locale="fr-FR"
      data-template-id={TEMPLATE_ID}
      data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
      data-style-height="24px"
      data-style-width="100%"
      data-theme="dark"
    >
      <a
        href="https://www.trustpilot.com/review/tradevaultt.vercel.app"
        target="_blank"
        rel="noreferrer"
      >
        Trustpilot
      </a>
    </div>
  );
}
