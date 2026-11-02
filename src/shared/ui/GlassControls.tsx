import { forwardRef, type ReactNode } from "react";
import {
  Glass as GlisseGlass,
  Input as GlisseInput,
  Menu as GlisseMenu,
  Slider as GlisseSlider,
  TabBar as GlisseTabBar,
  type GlassProps,
  type MenuEntry,
  type SliderProps,
  type TabBarProps,
} from "glisse";
import { cn } from "./cn";
import { WhenShown } from "./WhenShown";
import { Search, X } from "./icons";

/**
 * LES CONTRÔLES DE VERRE (Glisse, iOS 26) que les écrans utilisent sans
 * importer la bibliothèque : une recherche traduite, un curseur, un menu et la
 * surface de verre de la couche de navigation.
 */

/**
 * La recherche. Le `SearchField` de Glisse écrit « Search » et « Clear » en
 * anglais, en dur : celui-ci prend ses deux textes de l'appelant (`useT()`),
 * sur le même champ de verre.
 */
export const SearchField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    clearLabel: string;
    className?: string;
    autoFocus?: boolean;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    "aria-label"?: string;
    trailing?: ReactNode;
  }
>(function SearchField(
  { value, onValueChange, placeholder, clearLabel, className, trailing, ...rest },
  ref,
) {
  return (
    <div className={cn("tv-search", className)}>
      <GlisseInput
        ref={ref}
        type="text"
        role="searchbox"
        icon={<Search aria-hidden />}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          className="tv-search-clear"
          aria-label={clearLabel}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onValueChange("")}
        >
          <X aria-hidden />
        </button>
      ) : (
        trailing
      )}
    </div>
  );
});

/** Le curseur d'iOS 26 : son pouce devient une lentille quand on le tient. */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, ...rest },
  ref,
) {
  return (
    <WhenShown>
      <GlisseSlider ref={ref} className={cn("tv-slider", className)} {...rest} />
    </WhenShown>
  );
});

/** La surface de verre réfractant — réservée à la couche de navigation. */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { className, ...rest },
  ref,
) {
  return <GlisseGlass ref={ref} className={cn("tv-glass", className)} {...rest} />;
});

/** Le menu « … » de Glisse : il s'ouvre depuis son bouton, en verre givré. */
export function GlassMenu(props: {
  items: MenuEntry[];
  "aria-label": string;
  icon?: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return <GlisseMenu {...props} />;
}
export type { MenuEntry };

/**
 * La barre d'onglets d'iOS 26 : la sélection glisse d'un onglet à l'autre,
 * suit le doigt, et se soulève en lentille tant qu'on la tient. Avec `href`,
 * les onglets sont de vrais liens (clic du milieu, nouvel onglet) ; `link`
 * fournit le composant de lien. Montée seulement une fois affichée
 * (`WhenShown`).
 */
export function GlassTabBar({ className, ...props }: TabBarProps) {
  return (
    <WhenShown>
      <GlisseTabBar className={cn("tv-tabbar", className)} {...props} />
    </WhenShown>
  );
}
export type { TabBarProps };
