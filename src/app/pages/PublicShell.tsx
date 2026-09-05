import logoSrc from "@/assets/tradevault-logo.webp";

/**
 * Le repli SSR des écrans AUTHENTIFIÉS (`/journal`, `/settings`, …).
 *
 * POURQUOI IL EXISTE. `$page.tsx` importait `Landing.tsx` pour ce repli — en
 * STATIQUE. Le `lazy()` d'`App.tsx` ne servait alors à rien sur ces routes, et
 * la page de vente partait dans le chargement initial de CHAQUE trader
 * connecté, qui ne la verra jamais.
 *
 * CHIFFRE CORRIGÉ : ce chunk pèse ~80 Ko, pas 279. Le 279 datait d'une mesure
 * antérieure au découpage et il est resté ici, trois fois et demie trop gros —
 * un commentaire qui donne un ordre de grandeur faux oriente mal la prochaine
 * décision de performance. Vérifiable à chaque build :
 * `.vercel/output/static/assets/Landing-*.js`.
 *
 * La route `/`, elle, importe Landing en STATIQUE — et c'est NÉCESSAIRE : elle
 * la rend côté serveur, ce qui est toute la stratégie de référencement (voir
 * `routes/index.tsx`). L'absence de découpage y est donc volontaire, pas un
 * oubli.
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
      <img
        src={logoSrc}
        alt="TradeVault"
        width={56}
        height={56}
        className="h-14 w-14 rounded-2xl"
      />
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
