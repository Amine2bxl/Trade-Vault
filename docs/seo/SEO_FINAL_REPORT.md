# SEO_FINAL_REPORT — TradeVault

Après implémentation. L'état des lieux d'avant est dans `SEO_AUDIT.md`, et
reste volontairement inchangé : un audit qu'on réécrit après coup ne sert plus
à rien.

---

## SEO_FINAL_SCORE : 76 / 100 — *avant : 58*

+18 points, tous techniques. Le plafond restant n'est pas technique, et c'est le
point le plus important de ce rapport : **il ne reste presque rien à corriger
dans le code.** Ce qui manque désormais, c'est du contenu et de l'autorité, que
le code ne produit pas.

### Par axe

| Axe | Avant | Après | Ce qui a bougé |
|---|---:|---:|---|
| INTERNATIONAL_SEO | 15 | **80** | `/fr` existe, rendue en français au SSR, `hreflang` réciproque dans le `<head>` et le sitemap |
| INTERNAL_LINKING | 25 | **75** | 13 liens morts → 0 · `/contact` n'est plus orpheline |
| SOCIAL_DISCOVERY | 40 | **80** | Vrai PNG 1200×630 avec dimensions et `alt` · 5 faux profils retirés |
| STRUCTURED_DATA | 45 | **80** | `inLanguage` aligné · tarifs dérivés du catalogue · `FAQPage` · `BreadcrumbList` |
| AEO | 30 | **70** | La FAQ visible est enfin balisée, dans les deux langues |
| BRAND_ENTITY | 35 | **60** | `sameAs` réel · `contactPoint` · lien Trustpilot réparé |
| AI_SEARCH (GEO) | 40 | **70** | `llms.txt` réécrit d'après les faits du dépôt, annoncé par `robots.txt` |
| TECHNICAL_SEO | 78 | **88** | `lastmod` honnête · `changefreq` · `Disallow: /api/` · manifest réaligné |
| INDEXABILITY | 80 | **88** | 6 URL au sitemap au lieu de 5, aucune orpheline |
| CONVERSION | 55 | **65** | Les points de sortie du pied de page mènent quelque part |
| PERFORMANCE | 70 | **70** | Inchangé — rien n'a été ajouté au chemin critique |
| CONTENT | 35 | **38** | Quasi inchangé : `/fr` ajoute une URL, pas du contenu neuf |
| AUTHORITY | 20 | **20** | Inchangé, et ce n'est pas au code de le changer |

---

## BEFORE → AFTER, en faits vérifiables

| | Avant | Après |
|---|---|---|
| URL indexables | 5 | 6 |
| Langues indexables | 1 (anglais) | 2 (anglais, français) |
| Balises `hreflang` | 0 | 3, réciproques, sur les deux pages |
| Liens morts (`href="#"`) | 13 | 0 |
| Pages publiques orphelines | 1 (`/contact`) | 0 |
| Profils sociaux annoncés sans compte | 5 | 0 |
| Types schema.org émis | 3 | 6 (`+FAQPage`, `+BreadcrumbList`, `+ContactPoint`) |
| Contradictions de langue dans le document | 1 (`inLanguage: fr-FR`) | 0 |
| Prix écrits en dur dans le balisage | 1 (`"0"`) | 0 — dérivés de `TIERS` |
| Aperçu social | icône carrée 512×512 | PNG 1200×630 |
| `lastmod` | recalculé à chaque requête | figé au build |
| Tests d'invariants SEO | 8 (dans `publicSurface`) | 36 |

---

## REMAINING_ISSUES

### Ce qui reste et dépend d'une décision, pas d'un correctif

**1. Le `<h1>` ne porte aucun mot-clé** *(P0, non appliqué — voir `SEO_AUDIT.md`
§ P0-4)*
« Trade better. Understand why. » est une bonne accroche de marque et le signal
on-page le plus fort de la page d'accueil, gaspillé. Les deux chaînes de
remplacement sont prêtes dans `KEYWORD_MAP.md`, à structure et longueur
identiques. **C'est le correctif au meilleur rapport effort/effet de toute la
liste** — une ligne de dictionnaire — et il attend un accord, parce que
réécrire une accroche de vente n'est pas une correction technique.

**2. Cinq étoiles Trustpilot affichées sans note publiée**
`AuthModal.tsx` rend cinq carrés verts pleins à côté de « Avis vérifiés sur
Trustpilot », au moment exact de l'inscription. C'est plausiblement la charte
graphique de Trustpilot plutôt qu'une note revendiquée — mais un visiteur lit
« 5/5 ». Aucune donnée structurée ne l'affirme (le test l'interdit), donc ce
n'est pas un risque de pénalité : c'est une question d'honnêteté d'affichage, et
elle appartient au produit. Le lien, lui, est réparé.

**3. `user-scalable=no`** *(P2, non appliqué — voir `SEO_AUDIT.md` § P2-13)*
Échec d'accessibilité relevé par Lighthouse, mais décision produit assumée et
implémentée (`lock-zoom.ts`). Le brief interdit de retirer une fonctionnalité
pour simplifier le SEO. Signalé pour que le compromis reste conscient.

### Ce qui reste et demande du travail, pas une décision

**4. Le volume de contenu** — six URL, dont quatre légales. C'est le plafond
réel. `CONTENT_ROADMAP.md` propose six pages en trois vagues.

**5. L'autorité externe** — aucun signal. Ne s'écrit pas dans le code.

**6. Les pages légales n'existent qu'à une URL** alors qu'elles se rendent en
douze langues. Elles ne déclarent donc aucun `hreflang`, ce qui est correct
aujourd'hui. Si elles méritent un jour d'être indexées par langue, elles
suivront le motif de `/fr`.

**7. Le poids du JavaScript.** `vite.config.ts` documente déjà le sujet :
`react-dom/client` pèse ~386 Ko à lui seul. Le découpage vendor en place est un
instrument de mesure, pas un gain. Hors périmètre de ce chantier, mais c'est le
prochain plafond de PERFORMANCE.

---

## NEXT_30_DAYS

Par ordre d'effet décroissant.

1. **Décider du `<h1>`.** Une ligne, le plus gros effet unitaire restant.
2. **Soumettre `/fr` à Search Console** et demander l'indexation explicitement.
   Ne pas attendre la découverte naturelle : c'est une URL neuve sur un site
   sans autorité.
3. **Vérifier la grappe `hreflang`** dans Search Console → International
   Targeting. C'est là qu'apparaît une erreur de réciprocité, et elle
   invaliderait toute la mécanique.
4. **Contrôler l'aperçu social** avec les débogueurs de Facebook, LinkedIn et X,
   et purger leurs caches — ils gardent longtemps l'ancienne carte.
5. **Valider les données structurées** avec le test des résultats enrichis de
   Google, sur `/`, `/fr` et `/privacy`.
6. **Écrire `/trading-journal`** (vague 1, `CONTENT_ROADMAP.md`).

## NEXT_60_DAYS

7. **`/fr/journal-de-trading`** et **`/ai-trading-coach`** — la vague 1 complète.
8. **Étendre la FAQ** de 4 à 8 questions. Le balisage suit tout seul.
9. **Premier relevé GEO** : interroger ChatGPT, Claude, Perplexity et Gemini sur
   la marque, noter ce qui est faux, corriger `llms.txt` en conséquence.
10. **Relever les Core Web Vitals réels** dans Search Console — les vrais, pas
    ceux d'un test synthétique.

## NEXT_90_DAYS

11. **Vague 2** : `/trading-journal-template`, `/r-multiple`,
    `/fr/discipline-trading`.
12. **Mesurer la répartition FR / EN** des impressions. C'est le verdict du
    pari `/fr` — et le premier chiffre qui dira si cette PR a servi à quelque
    chose.
13. **Ouvrir les comptes sociaux** s'il y a quelqu'un pour les tenir. Le jour
    où ils existent : deux lignes à changer (`ENTITY_MAP.md`), et les icônes
    peuvent revenir au pied de page.
14. **Réévaluer le score.** Un axe CONTENT à 38 est le prochain plafond ; il ne
    montera qu'avec des pages écrites.

---

## Ce qui n'est toujours pas promis

Aucune position, dans aucun moteur, à aucune échéance. Ce chantier a retiré des
obstacles — un site où la moitié du contenu n'avait pas d'adresse, où le
maillage ne menait nulle part, où la carte sociale ne pouvait pas s'afficher et
où les données structurées contredisaient la page. C'est la part qui dépendait
du code, et elle est faite. Le reste dépend de ce qui sera écrit et de qui en
parlera.

---

## Vérification de ce rapport

- `bun test` — 1071 pass, 0 échec réel (2 échecs environnementaux permanents :
  `@supabase/supabase-js` et `react-markdown` absents, `bun install` étant
  refusé par le registre du bac à sable)
- `tests/seo.test.ts` — 28 invariants, tous verts
- `npx eslint .` — 0 erreur
- `tsc --noEmit` — aucun nouveau fichier en échec par rapport à la ligne de base
- **CI GitHub — verte**, `bun run build` (Vite) et `bun run typecheck` compris :
  c'est la vérification qui n'était pas possible en local, et c'est elle qui
  valide la route `/fr`, l'arbre de routes et la lecture de l'état du routeur
  dans le shell.
