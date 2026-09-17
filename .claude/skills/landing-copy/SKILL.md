---
name: landing-copy
description: Copywriting et conversion de la landing TradeVault — positionnement discipline/prop-firm, promesse, ordre de persuasion des sections, anatomie d'un titre, règles d'honnêteté (zéro promesse de gain, zéro faux avis), ancrage de prix, CTA, objections/FAQ, bilinguisme EN/FR. À charger avant d'écrire ou de modifier un titre, un sous-titre, un CTA, une FAQ, une clé du dictionnaire `landing/i18n.tsx` ou une section de la landing. Se déclenche sur : landing, copy, copywriting, accroche, headline, titre marketing, CTA, conversion, pricing, FAQ, argumentaire, positionnement, vitrine.
---

# Landing — vendre la discipline, pas le journal

## La promesse (ne jamais en dériver)

> **« TradeVault est le coach IA qui te montre précisément pourquoi tu perds —
> et qui te refait la discipline, semaine après semaine. »**

**On ne vend jamais « un journal de trading ».** Le journal est le support, pas
la promesse. Le marché « journal + analytics » est saturé : y entrer, c'est
devenir un me-too de Tradezella à −5 €.

Ce qu'on vend : **un changement de comportement mesurable**.

## La cible et sa douleur

Cœur de cible : **trader en challenge prop-firm** (FTMO, Apex, Topstep, MFF —
NQ/ES) et **retail sérieux et actif**. Il paie déjà 200–600 $ par challenge.

Sa douleur, mot pour mot :

> *« Je sais TRADER. Je n'arrive pas à être DISCIPLINÉ quand ça compte. »*

Son vrai besoin n'est pas « plus de stratégie », c'est **arrêter de casser ses
propres règles au moment où ça compte** : revenge sizing après une perte,
overtrading, entrée hors-plan.

Hors cible assumé : investisseur long terme, trader occasionnel, quant qui veut
une API.

## Ce que TradeVault dit et que personne d'autre ne peut dire

Les trois phrases qui font la différence — s'en servir comme matrice :

1. « Tu avais prévu de risquer 1 %. Tu as risqué 1,8 % **après une perte**.
   Voilà ce que ça t'a coûté sur tes 12 derniers trades. »
2. « Ta plus grosse fuite n'est pas ton setup, c'est **X**, et elle te coûte
   **Y $**. »
3. « Voici ta semaine en une carte : ce qui s'est amélioré, ce qui s'est
   dégradé, et **UNE** priorité pour lundi. »

Différenciateurs prouvables, à citer partout :

- **Claim → Evidence** : chaque affirmation de Jarvis porte ses chiffres, sa
  période, son échantillon, et un lien vers les trades. Zéro hallucination
  (règle `ANTI_HALLUCINATION`).
- **Edge Score** : un score 0–100 de **comportement** dont le P&L est
  volontairement absent.
- **Signaux comportementaux déterministes** : dérive de taille après une perte,
  coût de l'overtrading, edge par jour/session/symbole.
- **Erreurs *et* setups manqués** chiffrés.
- **Sécurité statistique** : aucune conclusion sur un échantillon faible.

## Le ton

Direct, exigeant, **jamais infantilisant**. Un coach, pas un assistant.
Tutoiement en français. Phrases courtes. Verbes concrets.

## Ordre de persuasion des sections

```
1  Héros            la douleur nommée + la promesse + CTA + preuve visuelle
2  Le problème      le miroir : 3 symptômes qu'il reconnaît
3  La mécanique     comment ça marche, en 4 temps
4  Claim → Evidence la preuve que l'IA ne raconte pas d'histoires
5  Edge Score       le score qui ignore ton P&L
6  Analytics        la donnée qui sert le diagnostic
7  Jarvis           le coach ancré, en conversation
8  Les fuites       le coût chiffré des erreurs
9  Pour qui         challenge / funded / retail sérieux
10 vs Excel/Notion  comparaison vérifiable uniquement
11 Ancrage de prix  un mois de Pro vs un challenge raté
12 Preuve & confiance  par qui, sécurité, données exportables
13 Tarifs
14 FAQ              les objections, dans l'ordre où elles viennent
15 CTA final
```

Chaque section répond à **une** objection. Si deux sections répondent à la
même, l'une des deux part.

## Anatomie d'un titre

Deux temps, dont un accentué. Le contre-temps porte le sens :

| Patron | Exemple |
| --- | --- |
| Négation + vérité | « Ce n'est pas ta stratégie **qui te fait perdre.** » |
| Constat + conséquence | « Les tableurs t'ont donné la liberté. **Et un travail à temps plein.** » |
| Capacité + limite | « Tu sais trader. **Tu casses tes règles quand ça compte.** » |

Un titre ne contient **pas** le nom du produit (sauf le héros, une fois).
Il contient un verbe. Il passe le test de l'inversion : si l'inverse est absurde
(« Trade plus intelligemment »), c'est du remplissage.

## Honnêteté — les règles qui ne se négocient jamais

**Interdits absolus :**

- Promettre un gain, un rendement, une performance.
- Inventer un avis, un nombre d'utilisateurs, un logo client, un chiffre
  d'affaires, un « +37 % de win rate ».
- Prétendre une synchronisation broker : **il n'y a pas d'API**. Les vraies
  portes d'entrée sont import CSV, copier-coller, saisie rapide, trades de démo.
- Annoncer une fonctionnalité non livrée. Vérifier dans
  `docs/product/FEATURES_STATUS.md` avant d'écrire une ligne. En particulier :
  Daily Brief et Weekly Review automatiques sont ⚪ **prévus, pas livrés**.
- Un lien de pied de page vers une page qui n'existe pas.

**Les chiffres des maquettes** (−$1,240 de revenge trading, 78 d'Edge Score, une
courbe qui monte) sont des **illustrations de l'interface**. Ils doivent être
étiquetés comme tels dans l'UI, et jamais présentés comme un résultat client.
Le texte alternatif d'une capture décrit **l'écran**, jamais le résultat qu'on y
voit.

**Vocabulaire proscrit** : revolutionary, game-changing, next-generation,
unleash, supercharge, « AI-powered everything », « révolutionnaire »,
« libère ton potentiel », « trade plus intelligemment ».

## L'ancrage de prix

Ne jamais se comparer aux journaux (20–30 $/mois). Se comparer au **coût d'un
challenge raté (200–600 $)** :

> « Un mois de Pro coûte moins qu'un challenge que tu rates en te sabordant. »
> « Un seul trade indiscipliné évité rembourse l'abonnement. »

## Les CTA

- Un **seul** CTA primaire par section, et pas dans toutes les sections.
- Verbe à la première personne ou à l'impératif : « Commencer gratuitement »,
  « Créer mon compte gratuit ».
- Toujours accompagné du **lever de risque** juste en dessous : « Gratuit pour
  toujours · sans carte bancaire · annulation en 1 clic ».
- Le CTA secondaire est un lien texte (démo), jamais un second bouton plein.

## La FAQ répond aux objections, dans l'ordre

1. « C'est encore un journal ? » → non : un journal enregistre, TradeVault
   diagnostique.
2. « Est-ce que ça prédit le marché / donne des signaux ? » → **non, jamais**.
   L'IA n'analyse que ton passé ; elle n'a pas le droit de prédire.
3. « Je suis en challenge, concrètement ça me sert à quoi ? »
4. « Le gratuit est-il vraiment gratuit ? »
5. « Mes données ? » → chiffrées, aucun accès au courtier, export à tout moment.
6. « Et si j'ai déjà un historique ? » → import CSV.

Le balisage `FAQPage` est construit **depuis le même tableau** que l'accordéon
rendu — il ne peut pas diverger. Ne pas recopier les questions dans le JSON-LD.

## Bilinguisme

Toute chaîne passe par le dictionnaire `src/app/pages/landing/i18n.tsx`
(`{ en, fr }` par clé). **Jamais** de texte codé en dur dans un composant, ni de
`lang === "fr" ? … : …`.

L'anglais est la langue par défaut de la vitrine (aucune détection navigateur).
Le français a son adresse `/fr`. Le français n'est pas une traduction mot à mot :
c'est la même idée, écrite comme un francophone l'écrirait — mêmes longueurs,
pour que la mise en page tienne dans les deux langues.

## Checklist avant de livrer une ligne de copy

- [ ] Elle parle de discipline/comportement, pas de stockage de trades.
- [ ] Elle nomme une douleur que la cible reconnaît en une seconde.
- [ ] Aucune promesse de gain, aucun chiffre inventé, aucune fonctionnalité
      non livrée.
- [ ] Aucun mot de la liste proscrite.
- [ ] EN et FR écrits tous les deux, de longueur comparable.
- [ ] Un seul CTA primaire, avec son lever de risque.
- [ ] Le titre passe le test de l'inversion.
