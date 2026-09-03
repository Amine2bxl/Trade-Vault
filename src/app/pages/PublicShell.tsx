import { BrandMark } from "@/shared/ui";
/**
 * Le repli SSR des écrans AUTHENTIFIÉS (`/journal`, `/settings`, …).
 *
 * POURQUOI IL EXISTE. `$page.tsx` importait `Landing.tsx` pour ce repli — en
 * STATIQUE. Conséquence mesurée dans le build : « Landing.tsx is dynamically
 * imported by App.tsx but also statically imported by $page.tsx », donc le
 * `lazy()` d'`App.tsx` ne servait à rien et les 279 Ko de la page de vente
 * partaient dans le chargement initial de CHAQUE trader connecté, qui ne la
 * verra jamais.
 *
 * Ce composant coûte quelques centaines d'octets et tient le même rôle : la
 * première image d'un visiteur non connecté qui ouvre `/journal`, le temps que
 * l'authentification se résolve côté client. Ensuite `App` prend la main et
 * rend, lui, la vraie landing (chargée à la demande) ou l'application.
 *
 * Ces routes sont en `noindex` (voir `head` dans `$page.tsx`) : aucun contenu
 * marketing n'est perdu pour le référencement, il vit sur `/`, qui continue de
 * servir la landing complète en SSR.
 */
export default function PublicShell() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 bg-[var(--tv-bg)] px-6 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-3xl tv-accent-fill"
        aria-label="TradeVault"
      >
        <BrandMark size={30} />
      </span>
      <div className="space-y-1.5">
        <p className="text-xl font-bold tracking-tight text-white">TradeVault</p>
        <p className="text-sm text-slate-400">Journal de trading et coach IA.</p>
      </div>
      <a
        href="/"
        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300"
      >
        Découvrir TradeVault
      </a>
    </div>
  );
}
