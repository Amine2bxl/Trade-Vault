import type { ComponentType } from "react";
import {
  Briefcase,
  Building2,
  Compass,
  CreditCard,
  Flame,
  FlaskConical,
  Globe,
  Home,
  Layers,
  Shield,
  Star,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import type { Account, AccountType } from "../store";

/**
 * L'identité visuelle d'un compte — icône et libellé de type.
 *
 * Sortie de `AccountSwitcher.tsx` pour être partagée (le gestionnaire de
 * comptes des réglages l'affiche aussi) sans qu'un fichier de composants
 * exporte des constantes : le rafraîchissement à chaud de Vite ne sait
 * recharger proprement qu'un module qui n'exporte que des composants.
 */

export const TYPE_ICON: Record<AccountType, typeof User> = {
  personal: User,
  prop: Building2,
  demo: FlaskConical,
  live: Zap,
};
export const TYPE_LABEL_KEY = {
  personal: "account.typePersonal",
  prop: "account.typeProp",
  demo: "account.typeDemo",
  live: "account.typeLive",
} as const;

export const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  User,
  Building2,
  FlaskConical,
  Zap,
  Briefcase,
  Flame,
  Star,
  Shield,
  Target,
  TrendingUp,
  Layers,
  Compass,
  Home,
  CreditCard,
  Globe,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function getAccountIcon(a: Account) {
  if (a.icon && ICON_MAP[a.icon]) return ICON_MAP[a.icon];
  return TYPE_ICON[a.type] ?? User;
}
