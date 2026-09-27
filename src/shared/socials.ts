/**
 * LES RÉSEAUX SOCIAUX — une seule table, deux surfaces.
 *
 * Le pied de page dessine ces entrées, `seo.ts` en tire son `sameAs`. C'est
 * la MÊME vérité déclarée à deux endroits : un compte ajouté ici apparaît
 * dans la page et dans les données structurées du même coup. Quand les deux
 * listes vivaient séparément, la seconde était toujours la périmée.
 *
 * ── UNE ENTRÉE SANS `url` N'EST PAS RENDUE ────────────────────────────────
 *
 * Cinq réseaux sont prévus, deux existent. Les trois autres restent ici avec
 * `url: null` : la table dit l'intention sans que la page affirme une
 * présence qui n'existe pas. Le commit `f4249be` a justement retiré cinq
 * icônes qui pointaient toutes vers `#` — « un logo de réseau est une
 * affirmation, et celle-ci était fausse ». Ouvrir un compte, c'est remplir
 * `url` et `chemin`, et rien d'autre : le pied de page et `sameAs` suivent.
 *
 * ── LES TRACÉS ───────────────────────────────────────────────────────────
 *
 * `lucide-react` ne fournit plus d'icônes de marque (ni TikTok, ni le X
 * actuel). Les tracés sont donc posés à la main, sur la grille 24×24 de
 * Simple Icons, qui est du domaine public (CC0). Le logo lui-même reste la
 * marque de son propriétaire : on ne le redessine pas, on ne le recolore pas
 * autrement qu'en `currentColor`, et il ne sert qu'à désigner notre propre
 * compte.
 */
export interface Reseau {
  /** Le nom de la plateforme, tel qu'un lecteur d'écran doit l'annoncer. */
  nom: string;
  /** L'identifiant, écrit comme sur la plateforme. `null` si le compte n'existe pas. */
  handle: string | null;
  /** Le profil. `null` tant qu'il n'y a pas de compte — rien n'est alors rendu. */
  url: string | null;
  /** Le tracé de l'icône sur une grille 24×24. `null` tant qu'il ne sert pas. */
  chemin: string | null;
}

export const RESEAUX: readonly Reseau[] = [
  {
    nom: "TikTok",
    handle: "@tradevault.be",
    url: "https://www.tiktok.com/@tradevault.be",
    chemin:
      "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  {
    nom: "X",
    handle: "@tradevault.be",
    url: "https://x.com/tradevault.be",
    chemin:
      "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  /* Prévus, pas ouverts. Remplir `url` et `chemin` suffit à les faire
     apparaître dans le pied de page ET dans `sameAs`. */
  { nom: "Instagram", handle: null, url: null, chemin: null },
  { nom: "Reddit", handle: null, url: null, chemin: null },
  { nom: "Pinterest", handle: null, url: null, chemin: null },
];

/** Les comptes réellement ouverts — ce que le pied de page dessine. */
export const RESEAUX_ACTIFS = RESEAUX.filter(
  (r): r is Reseau & { url: string; handle: string; chemin: string } =>
    Boolean(r.url && r.handle && r.chemin),
);

/** Les mêmes, en URL seules — ce que `sameAs` déclare. */
export const URLS_RESEAUX = RESEAUX_ACTIFS.map((r) => r.url);
