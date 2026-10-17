import { lazyPage } from "@/shared/lazy-page";
import logoSrc from "@/assets/tradevault-logo-128.png";

/**
 * Le repli SSR des écrans AUTHENTIFIÉS (`/journal`, `/settings`, …).
 *
 * POURQUOI IL EXISTE. `$page.tsx` importait `Landing.tsx` pour ce repli — en
 * STATIQUE. Le `lazyPage()` d'`App.tsx` ne servait alors à rien sur ces routes, et
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
  /* SANS TEXTE À TRADUIRE, SANS CYAN.
     Il affichait « Journal de trading et coach IA. » et un bouton
     « Découvrir TradeVault » — en français pour tout le monde, alors que la
     langue servie par défaut est l'anglais (`SSR_LANG`), et dans le cyan de
     l'ancienne identité. Cet écran ne vit que le temps de l'hydratation : la
     marque suffit, et elle reste un lien vers l'accueil pour qui n'exécute
     pas JavaScript. */
  return (
    <div className="public-shell min-h-dvh flex flex-col items-center justify-center gap-4 bg-[var(--tv-bg)] px-6 text-center">
      <a href="/" className="flex flex-col items-center gap-4" aria-label="TradeVault">
        <img src={logoSrc} alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
        <span className="text-xl font-bold tracking-tight text-white">TradeVault</span>
      </a>
    </div>
  );
}
