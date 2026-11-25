# TradeVault — réseaux sociaux, refonte de A à Z

> Novembre 2026. Remplace le plan des 10 slides (`content/tiktok/captions.md`,
> `content/hooks.md`), archivé. Fichiers prêts : `content/affiches/` (affiches
> et kit partenaire) et `video/` (motion design 9:16, `bun run render:vertical`).

## 0. La décision : on garde @tradevault.be, on fait le ménage, on reposte en natif

**Pas de nouveau compte.** @tradevault.be est déjà relié partout : pied de page
du site et données structurées (`src/shared/socials.ts`), Buffer, Higgsfield.
Un nouveau compte repart de zéro sans garantie de « boost » : sur TikTok, la
diffusion se joue surtout vidéo par vidéo (rétention des premières secondes,
visionnage complet), pas sur l'âge du compte.

**Pourquoi la pub 20 s n'a pas percé** (hypothèse la plus probable) : elle est
en **16:9**. Sur un téléphone, elle s'affiche en bandeau avec deux bandes
noires, texte minuscule. Le fil vertical la fait passer pour un contenu
recyclé.

**Ne pas reposter le même fichier.** Un ré-upload identique peut être traité
comme contenu dupliqué. Les quatre nouvelles versions sont des **montages
9:16 différents** (téléphone, texte dans la zone sûre, accroche lisible dès la
première image), sur la même musique.

**Archiver plutôt que supprimer** : *Seulement moi* est réversible et garde les
statistiques. Sur chaque vidéo à retirer : `•••` → *Paramètres de
confidentialité* → *Qui peut regarder cette vidéo* → **Seulement moi**.

À archiver :

- tous les anciens slide-posts (P1 à P10) ;
- en priorité ceux qui enfreignent nos règles d'honnêteté : **P5** (« 90 %
  échouent », chiffre non sourcé), **P6** (« règle tenue 11 fois sur 12 »,
  illustration présentée comme un résultat), **P3** (« ~620 $ » sans mention
  d'exemple) ;
- la pub 16:9 **une fois** la version 9:16 publiée.

La bio actuelle dit « Gratuit, 30 trades » : **c'est faux** depuis l'offre
actuelle (gratuit pour toujours, 10 nouveaux trades par mois). À remplacer
tout de suite (§ 2).

## 1. Ce qu'on raconte, partout

**Promesse** : le coach IA qui te montre pourquoi tu perds, et qui te refait la
discipline, semaine après semaine. On ne vend jamais « un journal ».

**Cible** : trader en challenge prop firm (FTMO, Apex, Topstep — NQ/ES) et
retail actif. Sa phrase : *« Je sais trader. Je n'arrive pas à être
discipliné quand ça compte. »*

**Quatre piliers**, en rotation :

| Pilier | Rôle | Exemples prêts |
| --- | --- | --- |
| Le miroir | il se reconnaît en 1 s | affiches 01, 02 · vidéo accroche A |
| La preuve | le vrai produit, un geste | vidéos 9:16 · affiches 04, 05 |
| La méthode | la discipline comme process | 05-checklist · questions en commentaire |
| La conversion douce | lever l'objection prix | 03-challenge · 06-gratuit |

**Règles qui ne se négocient pas** (AGENTS.md) : aucune promesse de gain, aucun
chiffre, avis ou résultat inventé ; une capture porte « Vraie app · données
d'exemple », un chiffre d'illustration porte « Exemple illustratif » ; jamais
de signaux ni de prédiction ; jamais « je suis passé de −X à +Y grâce à
TradeVault ».

## 2. TikTok — @tradevault.be

**Bio** (≤ 80 caractères) :

> Coach IA de discipline pour traders prop firm.
> Gratuit pour toujours ↓

EN, si le compte bascule en anglais : *AI discipline coach for prop-firm
traders. Free forever ↓*

**Lien** : `tradevault.be` (ou `tradevault.be/fr`). Si TikTok ne propose pas
encore le lien cliquable (selon le type de compte et le nombre d'abonnés),
garder « tradevault.be » en texte : il est aussi sur l'écran de fin de chaque
vidéo.

**Rythme** : 1 publication par jour pendant 30 jours, en alternant vidéo 9:16
et carrousel photo (les affiches `*-story.jpg`, déjà au format accepté).

**Accroche** : le texte est lisible dès la frame 0 (c'est voulu dans les
montages). Tester **A contre B** : A le jour 1, B le jour 3, puis comparer la
durée moyenne de visionnage et le taux de visionnage complet dans les
statistiques. La gagnante devient le gabarit des suivantes.

**Son** : la piste d'origine est calée image par image (impacts, coches,
silence avant le CTA). Un son tendance peut s'ajouter très bas (5–10 %),
jamais à la place.

**Hashtags** : 3 à 5, pas plus — `#trading #propfirm #daytrading
#tradingpsychology #futures` (EN) / ajouter `#tradingfrance #trader` en FR.

**Engagement** : répondre à chaque commentaire, de préférence en **réponse
vidéo** (l'affiche ou l'écran concerné à l'appui). Épingler : la vidéo
gagnante, 03-challenge, 06-gratuit.

### Légendes prêtes

**Vidéo A (FR)** — `tradevault-9x16-fr-a.mp4`
> Tu sais trader. Tu casses tes règles quand ça compte.
> TradeVault te montre lesquelles, et ce qu'elles te coûtent. Gratuit pour
> toujours, sans carte. 🔗 tradevault.be
> #trading #propfirm #daytrading #tradingpsychology

**Vidéo B (FR)** — `tradevault-9x16-fr-b.mp4`
> Ce n'est pas ta stratégie qui te fait perdre.
> C'est ce que tu fais après une perte. Journal, checklist, Jarvis : la
> discipline devient un process. 🔗 tradevault.be
> #trading #futures #propfirm #discipline

**Vidéo A (EN)** — `tradevault-9x16-en-a.mp4`
> You know how to trade. You break your rules when it counts.
> TradeVault shows you which ones, and what they cost you. Free forever, no
> card. 🔗 tradevault.be
> #trading #propfirm #daytrading #tradingpsychology

**Vidéo B (EN)** — `tradevault-9x16-en-b.mp4`
> It's not your strategy that's costing you.
> It's what you do after a loss. Journal, checklist, Jarvis: discipline
> becomes a process. 🔗 tradevault.be
> #trading #futures #propfirm #discipline

**Carrousels / photos** — une affiche = un post, légende = la phrase de
l'affiche + une question :

- 01 : « Quelle règle tu casses le plus souvent ? » 
- 02 : « Tu grossis après une perte ? Sois honnête. »
- 03 : « Combien de challenges ratés cette année ? »
- 04 : « Ton journal te dit quoi, concrètement ? »
- 05 : « Tu as une checklist avant d'entrer ? »
- 06 : « Lien en bio. Sans carte. »

## 3. Instagram — à ouvrir

**Compte** : @tradevault.be (même identifiant partout), en compte
professionnel pour les statistiques.

**Bio** :

> Le coach IA qui te montre pourquoi tu perds.
> Journal · Checklist · Jarvis — pour traders prop firm.
> Gratuit pour toujours ↓

**Grille** : affiches `*-feed.jpg` (4:5) ; **Reels** = les vidéos 9:16 ;
**Stories** = affiches `*-story.jpg` + sondage (« Ta plus grosse fuite :
taille après perte · overtrading · entrée hors plan ? »). Stories à la une :
*Commencer*, *Jarvis*, *Gratuit*, *Partenaires*.

**Une fois ouvert** : remplir l'entrée Instagram de `src/shared/socials.ts`
(`handle`, `url`, `chemin`) — le pied de page et `sameAs` suivent seuls.
Buffer gratuit est limité à 3 réseaux (TikTok, Pinterest, X aujourd'hui) :
remplacer X par Instagram, ou passer à l'offre payante.

## 4. Pinterest — tradevaultsaas

Pinterest est un **moteur de recherche** : une épingle vit des mois. On écrit
pour la recherche, pas pour le fil.

- **Nom affiché** : « TradeVault — journal & coach de trading ». Aligner le nom
  d'utilisateur sur la marque si possible.
- **Tableaux** : *Discipline de trading* · *Challenge prop firm* · *Journal de
  trading* · *Psychologie du trading* — et en anglais *Trading discipline* ·
  *Prop firm challenge* · *Trading journal*.
- **Épingles** : les 12 affiches `*-pin.jpg` (1000×1500) + les 4 vidéos 9:16
  en épingles vidéo. Lien de chaque épingle : `tradevault.be` (EN) ou
  `tradevault.be/fr` (FR), avec UTM (§ 7).
- **Titre** = mot-clé d'abord : « Journal de trading : arrêter le revenge
  trading », « Prop firm challenge : pourquoi tu échoues sur la règle »,
  « Checklist pré-market pour day trader ». Description : deux phrases de
  l'affiche + « Gratuit pour toujours ».
- **Rythme** : 1 à 2 épingles par jour, étalées.

## 5. Influenceurs — le kit et l'approche

**À envoyer** : `content/affiches/fr/kit-partenaire-tradevault.pdf` (ou
`en/tradevault-partner-kit.pdf`) + les affiches `*-story.jpg` qu'ils peuvent
reposter telles quelles.

**Qui** : micro-créateurs trading de 5 k à 100 k abonnés — prop firm,
futures, psychologie du trading, FR et EN. On regarde l'engagement, pas le
nombre. **On évite** les vendeurs de signaux et les comptes « lifestyle » :
ils contredisent tout ce que dit la marque.

**L'offre (à décider)** — recommandation pour démarrer : licence Pro à vie
offerte au créateur + un **code promo** pour sa communauté (la carte d'achat
accepte déjà les codes promo ; à créer dans Stripe). Une commission à la
vente demande un suivi d'affiliation qui n'existe pas encore dans le produit.

**Obligatoire** : mention du partenariat (#ad / #partenariat, et l'option
« contenu commercial » de TikTok). Brief créateur : montrer **son** usage
réel, aucune promesse de gain, aucun « j'ai gagné X avec ».

**DM (FR)**

> Salut [prénom] ! Je suis [ton prénom], fondateur de TradeVault, un coach IA qui
> montre aux traders pourquoi ils perdent — revenge sizing, overtrading,
> entrées hors plan — chiffres à l'appui, sans jamais promettre de gain.
> J'aime ton contenu sur [sujet précis]. Je t'offre la licence Pro à vie pour
> le tester sur ton propre trading, et si ça te parle, un code promo pour ta
> communauté. Je t'envoie le kit (2 min de lecture) ?

**DM (EN)**

> Hey [name]! I'm [your name], founder of TradeVault — an AI coach that shows
> traders why they lose (sizing up after a loss, overtrading, off-plan
> entries), with their own numbers and zero profit promises. Loved your
> content on [specific topic]. Happy to give you a lifetime Pro license to
> try it on your own trading, and a promo code for your audience if it
> clicks. Can I send you the kit (2-min read)?

Relance unique après 5 jours, puis on passe.

**Trois angles à proposer au créateur** : « ma plus grosse fuite, chiffrée » ·
« ma checklist avant chaque entrée » · « ce que Jarvis m'a dit après une
mauvaise semaine ».

## 6. Les 30 premiers jours

| Jour | TikTok | Instagram | Pinterest |
| --- | --- | --- | --- |
| 1 | Vidéo FR-A | Reel FR-A | 01 FR + 01 EN |
| 2 | Carrousel 01 | Feed 01 | 02 FR + vidéo FR-A |
| 3 | Vidéo FR-B | Story 02 + sondage | 03 FR + 03 EN |
| 4 | Carrousel 03 | Feed 03 | 04 FR |
| 5 | Vidéo EN-A | Reel FR-B | 05 FR + 05 EN |
| 6 | Carrousel 02 | Feed 02 | 06 FR |
| 7 | Bilan A/B → la gagnante repart en Spark/boost si budget | Story 06 | 02 EN + vidéo EN-A |
| 8–14 | 1/jour : vidéos restantes, carrousels 04, 05, 06, réponses vidéo aux commentaires | Feed 04, 05, 06 · Reel EN | 1–2 épingles/jour (EN puis FR) |
| 15–30 | Décliner la gagnante : nouvelles accroches sur le même montage (`video/src/vertical/script.ts`, `HOOKS`) | Reprise des meilleurs TikTok | Répéter les mots-clés qui cliquent |

Premiers contacts influenceurs : dès le jour 3 (10 DM par semaine).

## 7. Mesurer

- **TikTok / Reels** : durée moyenne de visionnage, % visionnage complet,
  visites du profil, clics sur le lien.
- **Pinterest** : clics sortants (pas les impressions).
- **Inscriptions** : liens avec UTM, par exemple
  `tradevault.be/?utm_source=tiktok&utm_medium=social&utm_campaign=hook-a`
  (`pinterest`, `instagram`, `partenaire-<pseudo>`).
- **Revue chaque lundi** : on garde ce qui retient, on coupe le reste.

## 8. Fichiers

| Quoi | Où |
| --- | --- |
| Vidéos 9:16 (FR/EN × accroche A/B) | `video/out/tradevault-9x16-*.mp4` — `cd video && bun run render:vertical` |
| Affiches 4:5, 9:16, 2:3 | `content/affiches/{fr,en}/0X-*-{feed,story,pin}.jpg` — `node scripts/affiches.mjs` |
| Kit partenaire | `content/affiches/fr/kit-partenaire-tradevault.pdf` · `content/affiches/en/tradevault-partner-kit.pdf` |
| Textes du montage vidéo | `video/src/vertical/script.ts` |
| Textes des affiches | `scripts/affiches.mjs` (`CONCEPTS`, `KIT`) |
