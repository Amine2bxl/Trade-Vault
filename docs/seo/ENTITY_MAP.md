# ENTITY_MAP — TradeVault

Ce que les moteurs — de recherche comme de réponse — doivent pouvoir affirmer
sur cette marque, et où chaque affirmation est écrite.

Une entité n'existe pour une machine que si elle est déclarée **au même endroit,
de la même façon, partout**. La règle de ce fichier : chaque ligne cite le
fichier qui fait autorité, et il n'y en a qu'un par fait.

---

## L'entité principale

| Fait | Valeur | Source de vérité |
|---|---|---|
| Nom | TradeVault | `src/shared/seo.ts` — `SITE_NAME` |
| Type | `Organization` + `SoftwareApplication` | `src/shared/seo.ts` — `structuredData()` |
| Catégorie | `FinanceApplication`, sous-catégorie « Trading journal » | idem |
| Domaine canonique | `https://tradevault.be` | `src/shared/site.ts` — `SITE_URL` |
| Définition (EN) | `PRODUCT_DESCRIPTION_EN` | `src/shared/seo.ts` |
| Contact | `tradevault@outlook.fr` | `src/shared/seo.ts` — `SUPPORT_EMAIL` |
| Langues | `en`, `fr` (vitrine) · 12 (application) | `src/shared/lang.ts`, `src/app/i18n/` |
| Tarifs | Free 0 € · Pro 15 €/mois · Elite 25 €/mois | `src/domain/plans.ts` — `TIERS` |
| Profil externe | Trustpilot | `src/shared/site.ts` — `TRUSTPILOT_URL` |

Le nom doit rester identique **caractère pour caractère** entre `SITE_NAME`, le
`manifest`, le graphe schema.org et l'écran de consentement OAuth de Google :
la vérification de marque compare les quatre et rejette sur le moindre écart.

---

## `sameAs` : un seul lien, et c'est normal

`sameAs` déclare « cette entité, c'est aussi celle-ci ailleurs ». Un seul profil
externe réel existe aujourd'hui — la fiche Trustpilot — et c'est tout ce qui y
figure.

Le pied de page affichait cinq icônes de réseaux sociaux (Twitter, LinkedIn,
Instagram, Facebook, YouTube), toutes en `href="#"`. **Aucun de ces comptes
n'existe.** Elles ont été retirées, pas promues en `sameAs` : déclarer un profil
inexistant est une affirmation fausse faite à une machine, et c'est exactement
ce qu'un moteur pénalise quand il le découvre.

**Le jour où un compte est ouvert**, deux endroits changent, et seulement deux :
1. la constante correspondante dans `src/shared/site.ts` ;
2. le tableau `sameAs` de `structuredData()`, qui la lit.

Le test `tests/seo.test.ts` vérifie que `sameAs` ne pointe jamais vers l'ancien
domaine `*.vercel.app` — l'erreur qui existait déjà.

---

## Entités secondaires

Ce que le produit nomme, et qui mérite d'être compris comme une entité distincte
par un moteur de réponse.

| Entité | Ce que c'est | Où c'est dit |
|---|---|---|
| **Jarvis** | Le coach IA du produit. Analyse l'historique réel de l'utilisateur ; ne donne pas de conseil générique. | `public/llms.txt`, section « AI coach » |
| **Discipline OS** | Le nom interne du couple checklist pré-market + notifications disciplinaires. | Vitrine, `nav.p.discipline` |
| **R-multiple** | L'unité de mesure du produit. Un concept de trading, pas une marque. | Analytics, `llms.txt` |

Jarvis est le seul candidat à devenir une entité nommée à part entière. Ce n'est
pas encore le cas et il ne faut pas le forcer : une entité se gagne par des
mentions externes, pas par une déclaration.

---

## Ce que l'entité ne doit JAMAIS affirmer

Ces interdits ne sont pas de la prudence rédactionnelle : ils sont vérifiés par
`tests/seo.test.ts`, qui échoue si l'un d'eux réapparaît dans le graphe.

- **`aggregateRating` / `ratingValue` / `reviewCount`.** Le site n'affiche
  aucune note. En déclarer une serait un faux avis au sens strict.
- **`Review`.** Aucun témoignage n'est publié.
- **`userInteractionCount`.** Aucun compteur d'utilisateurs n'est affiché.
- **Une adresse postale, un numéro de TVA, un effectif** tant qu'ils ne sont pas
  publiés sur le site.
- **Un `foundingDate`** non vérifiable publiquement.

La règle générale, et elle vaut pour toute future addition : *une donnée
structurée ne peut affirmer que ce que la page montre déjà à un humain.*

---

## Cohérence des déclarations de langue

Cinq endroits déclarent la langue d'un document. Ils doivent dire la même
chose — ils ne le faisaient pas, et le cinquième avait été oublié.

| # | Déclaration | Fichier |
|---|---|---|
| 1 | `<html lang>` | `src/routes/__root.tsx` — via `langForPath()` |
| 2 | Le corps rendu au serveur | `LandingLangProvider pinned` |
| 3 | Titre et description | `src/routes/index.tsx`, `src/routes/fr.tsx` |
| 4 | `og:locale` | `src/shared/seo.ts` — `pageSeo()` |
| 5 | `inLanguage` du graphe | `src/shared/seo.ts` — `SITE_LOCALE` |

`tests/publicSurface.test.ts` échoue si l'une des cinq se détache des autres.
