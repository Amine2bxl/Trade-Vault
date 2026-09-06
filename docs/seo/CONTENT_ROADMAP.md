# CONTENT_ROADMAP — TradeVault

Le site a **six URL indexables**, dont quatre légales. C'est le plafond réel du
référencement : un site sans contenu ne se positionne que sur son propre nom.

Ce document propose le contenu à écrire. Il ne propose **pas** d'en produire
beaucoup — le brief l'interdit explicitement, et il a raison : cent pages
générées valent moins que six pages écrites. Chaque page ci-dessous doit
justifier son existence auprès d'un lecteur qui ne sait rien du SEO.

---

## Le test avant d'écrire

Trois questions. Si l'une des réponses est non, la page ne doit pas exister.

1. **Un trader la lirait-elle sans y avoir été amené par un moteur ?**
2. **Contient-elle quelque chose que ce produit sait et que les autres ne
   racontent pas ?** (des données réelles d'utilisation, une méthode précise, un
   point de vue tranché) Sinon, c'est une paraphrase de ce qui existe déjà.
3. **Son mot-clé est-il libre ?** Voir `KEYWORD_MAP.md`. Sinon, ce n'est pas une
   page nouvelle, c'est une mise à jour.

---

## Vague 1 — les fondations (0 → 60 jours)

Trois pages. Elles couvrent les requêtes de catégorie, celles qui manquent le
plus aujourd'hui.

### `/trading-journal` — « trading journal software »

La page de catégorie que `/` ne peut pas être. `/` porte la marque et la
conversion ; celle-ci porte la requête générique et explique **ce qu'est** un
journal de trading, ce qu'il faut y consigner, et pourquoi un tableur finit
toujours par être abandonné.

Environ 1 200 mots. Ouvre sur une réponse directe de trois phrases (voir
`GEO_STRATEGY.md`). Se termine sur le produit, sans faire semblant d'être neutre.

### `/fr/journal-de-trading` — « journal de trading »

Le pendant francophone, **écrit pour ses propres requêtes**, pas traduit. Le
marché français cherche massivement « journal de trading excel » : la page doit
partir de là — reconnaître que le tableur est le point de départ normal,
montrer où il casse (pas de R-multiple automatique, pas de détection de
schémas, abandonné au bout de six semaines), et proposer la suite.

### `/ai-trading-coach` — « ai trading coach »

Requête émergente, concurrence faible, et c'est littéralement ce que fait
Jarvis. La page doit être précise sur le **fonctionnement** : ce que l'IA lit,
ce qu'elle ne lit pas, pourquoi elle analyse l'historique de l'utilisateur
plutôt que de servir des conseils génériques. C'est aussi la page la plus
citable par un moteur de réponse.

---

## Vague 2 — l'autorité (60 → 120 jours)

### `/trading-journal-template` — « trading journal template »

Volume élevé, intention haute-de-tunnel, et le seul aimant à liens naturel de
cette liste. Un modèle réellement téléchargeable (CSV), avec l'explication de
chaque colonne. Le lien vers le produit vient après, comme la version qui
calcule ces colonnes toute seule.

### `/r-multiple` — « r multiple trading »

Une définition claire, avec des exemples chiffrés. Ce genre de page se cite
tout seul, par les forums comme par les moteurs de réponse. Elle établit
l'expertise sans rien vendre.

### `/fr/discipline-trading` — « discipline trading »

Le vrai sujet du produit et le vocabulaire des traders francophones. Sur-trading,
revenge trading, série de pertes : ce que c'est, comment ça se mesure, comment
une checklist pré-market y change quelque chose.

---

## Vague 3 — les segments (120 jours et au-delà)

### `/prop-firm-journal` — « prop firm trading journal »

Segment étroit, intention d'achat forte, concurrence faible. Les règles de
drawdown des prop firms sont un problème mesurable, et le produit gère déjà les
comptes multiples.

### Comparatifs

Une page par concurrent sérieux, **et seulement sur des faits publics
vérifiables à la date de rédaction**. Une comparaison malhonnête est plus
coûteuse que pas de comparaison du tout : elle se corrige publiquement.

Ces pages ne s'écrivent qu'une fois les vagues 1 et 2 en ligne — un site sans
contenu propre qui commence par comparer les autres n'a aucune autorité pour le
faire.

---

## Le format, pour toutes ces pages

- **`<h1>` = le mot-clé principal**, formulé comme la question se pose.
- **Une réponse directe en 2–3 phrases** juste après, avant tout développement.
  C'est ce qu'un moteur de réponse cite.
- **Des `<h2>` qui sont des questions**, pas des étiquettes.
- **Des liens contextuels** vers `/` et vers les pages voisines. Le maillage se
  construit là, pas dans le pied de page.
- **Un `Article` schema.org**, avec une date de publication **réelle**.
- **Pas d'image décorative sans `alt`.** Pas d'image du tout si elle n'apprend
  rien.

## Ce qu'il ne faut pas faire

- **Pas de déclinaisons automatiques** (« journal de trading pour le forex »,
  « … pour les indices », « … pour Paris ») : ce sont des doorway pages, et
  elles sont traitées comme telles.
- **Pas de contenu généré en série.** Une page par vague, écrite et relue.
- **Pas de chiffre non sourcé.** Si le produit ne peut pas prouver une
  statistique avec ses propres données anonymisées, elle ne s'écrit pas.
- **Pas de blog pour avoir un blog.** Une page qui n'a pas de requête attribuée
  ne sert à rien et dilue le reste.

---

## Une note sur le rythme

Six pages en six mois est un rythme lent et c'est volontaire. Le SEO de contenu
se mesure en trimestres : une page publiée aujourd'hui met trois à six mois à
trouver sa position. Publier six pages en un mois ne raccourcit pas ce délai —
ça produit simplement six pages moins bonnes qui mettront le même temps.
