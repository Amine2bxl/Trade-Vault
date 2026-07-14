import { useEffect, useRef } from "react";

// TradingView locales that match our app languages (fallback: en).
const TV_LOCALE: Record<string, string> = {
  en: "en", fr: "fr", es: "es", de: "de", it: "it", nl: "en",
  ru: "ru", zh: "zh_CN", ja: "ja", ar: "en", hi: "en", pt: "br",
};

/* Live economic calendar via TradingView's embed widget: always up to date
   (actual / forecast / previous values, real release times), no API key. We
   inject the official script imperatively and rebuild it when the language
   changes so the widget re-renders in the right locale. */
export default function TradingViewCalendar({ lang }: { lang: string }) {
  const holderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    holder.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: "100%",
      locale: TV_LOCALE[lang] ?? "en",
      importanceFilter: "0,1",
      countryFilter: "us,eu,gb,jp,ca,au,ch,cn,nz",
    });
    container.appendChild(script);
    holder.appendChild(container);

    return () => {
      holder.innerHTML = "";
    };
  }, [lang]);

  return <div ref={holderRef} className="w-full h-full" />;
}
