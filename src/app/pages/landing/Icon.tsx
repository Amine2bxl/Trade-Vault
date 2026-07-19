/* Icônes SVG partagées de la landing. Extrait de Landing.tsx (Phase D) — aucun changement de comportement. */

export type IName =
  | "arrow"
  | "bell"
  | "brain"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "close"
  | "compass"
  | "document"
  | "download"
  | "err"
  | "eye"
  | "flame"
  | "heart"
  | "layers"
  | "lock"
  | "mail"
  | "menu"
  | "mobile"
  | "plus"
  | "radar"
  | "shield"
  | "sparkle"
  | "star"
  | "target"
  | "trend"
  | "upload"
  | "user"
  | "x"
  | "zap";
export function Icon({ n, cls = "" }: { n: IName; cls?: string }) {
  const p: Record<IName, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    bell: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
    brain: (
      <>
        <path d="M12 5a3 3 0 0 0-5.7 1.25A3.5 3.5 0 0 0 6.5 13 3 3 0 0 0 12 15" />
        <path d="M12 5a3 3 0 0 1 5.7 1.25A3.5 3.5 0 0 1 17.5 13 3 3 0 0 1 12 15" />
        <path d="M12 5v10" />
        <path d="M9 19a3 3 0 0 0 3-3" />
        <path d="M15 19a3 3 0 0 1-3-3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    chart: (
      <>
        <path d="M3 17 9 11l4 4 8-9" />
        <path d="M15 6h6v6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2 6-6 2 2-6 6-2Z" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    err: (
      <>
        <path d="M12 9v4" />
        <path d="M10.3 3.3 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 17h.01" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    flame: (
      <path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.4-1.2-4.2-2.5-5.8C15 8.2 14.7 6.6 15.2 4c-3.1 1-5 4-5 6.8 0 .5 0 1 .13 1.5C9.4 11.6 8.9 10.8 8.7 9.5 6.9 11 5 13.2 5 15.9 5 19.2 7.6 22 12 22Z" />
    ),
    heart: (
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 8.5 5 10.5 6.5 12 8c1.5-1.5 3.5-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21Z" />
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    mobile: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    radar: (
      <>
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 12 20 4" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3-1.2 4.1L7 8.4l3.8 1.3L12 14l1.2-4.3L17 8.4l-3.8-1.3L12 3Z" />
        <path d="m19 15-.6 2.1-1.9.6 1.9.7.6 2 .7-2 1.9-.7-1.9-.6L19 15Z" />
      </>
    ),
    star: (
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45l-5.8 3.05 1.1-6.47L2.6 9.45l6.5-.95L12 2.6Z" />
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="m15 9-3 3" />
      </>
    ),
    trend: (
      <>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </>
    ),
    x: (
      <>
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    zap: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  };
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[n]}
    </svg>
  );
}
