import type { ReactNode } from "react";
import { ChevronRight } from "./icons";
import { cn } from "./cn";

/**
 * LES PAGES DE PARAMÈTRES — une seule anatomie.
 *
 * Chaque page de réglages empilait ses propres cartes (« glass » dans une
 * carte, icône dans une pastille dans une rangée dans une carte). Ici, un
 * réglage est une RANGÉE : son nom et une ligne d'aide à gauche, sa commande
 * à droite. Les rangées d'un même sujet partagent un seul cadre, séparées par
 * un filet. Rien d'autre : pas de bannière, pas de pastille décorative.
 */

export function SettingsGroup({
  title,
  tone,
  children,
  className,
}: {
  title?: ReactNode;
  tone?: "danger";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("tv-set-group", className)} data-tone={tone}>
      {title != null && <h2 className="tv-set-title">{title}</h2>}
      <div className="tv-set-list">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  aside,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Petit état à côté du libellé (« Enregistré »). */
  aside?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="tv-set-row">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="tv-set-label">
          {label}
          {aside}
        </label>
        {hint != null && <p className="tv-set-hint">{hint}</p>}
      </div>
      {children != null && <div className="tv-set-control">{children}</div>}
    </div>
  );
}

export function SettingsAction({
  icon,
  label,
  hint,
  onClick,
  href,
  disabled,
  danger,
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const body = (
    <>
      {icon != null && <span className="tv-set-action-icon">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="tv-set-label">{label}</span>
        {hint != null && <span className="tv-set-hint block">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
    </>
  );
  if (href) {
    return (
      <a href={href} className="tv-set-row tv-set-action" data-danger={danger}>
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tv-set-row tv-set-action"
      data-danger={danger}
    >
      {body}
    </button>
  );
}

/** Interrupteur accessible (`role="switch"`). */
export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="tv-switch"
    >
      <span className="tv-switch-knob" aria-hidden />
    </button>
  );
}

/**
 * LA CARTE HÉROS d'une page de réglages. Profil, Abonnement, Brokers et
 * Apparence ouvrent sur la même anatomie : un disque (ou un visuel) à gauche,
 * un surtitre, le titre, une phrase — et à droite les chiffres ou l'action.
 * Le titre est un `h2` : le `h1` de la page est le grand titre de l'en-tête.
 */
export function SettingsHero({
  media,
  mediaTone,
  eyebrow,
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  media?: ReactNode;
  mediaTone?: "accent";
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("tv-set-hero animate-fade-in-up", className)}>
      <div className="tv-set-hero-top">
        <div className="tv-set-hero-main">
          {media != null && (
            <div className="tv-set-hero-media" data-tone={mediaTone}>
              {media}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow != null && <p className="tv-set-hero-eyebrow">{eyebrow}</p>}
            <h2 className="tv-set-hero-title">{title}</h2>
            {subtitle != null && <div className="tv-set-hero-sub">{subtitle}</div>}
          </div>
        </div>
        {aside != null && <div className="tv-set-hero-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Un chiffre de la carte héros : libellé micro, valeur tabulaire. */
export function SettingsFact({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="tv-set-fact">
      <div className="tv-set-hero-eyebrow truncate">{label}</div>
      <div className="tv-set-fact-value truncate" data-tone={tone}>
        {value}
      </div>
    </div>
  );
}
