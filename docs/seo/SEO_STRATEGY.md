# SEO_STRATEGY — TradeVault

Comment ce produit compte être trouvé, et par quel ordre de priorités.

Les documents voisins portent le détail : `SEO_AUDIT.md` (l'état des lieux noté),
`KEYWORD_MAP.md` (une URL, une intention), `ENTITY_MAP.md` (ce que la marque
affirme), `CONTENT_ROADMAP.md` (ce qu'il reste à écrire), `GEO_STRATEGY.md` (les
moteurs de réponse), `SEO_ROUTES.md` (la surface publique).

---

## La position de départ, sans complaisance

TradeVault est un produit **jeune**, sur un marché **encombré** (Edgewonk,
TraderSync, Tradervue, TradeZella), avec **aucun signal d'autorité externe** et
**six URL indexables**.

Cela dicte la stratégie plus que n'importe quelle considération technique : on
ne gagne pas « trading journal » de front en six mois. Ce qui se gagne, c'est
la longue traîne, les segments étroits, et le français — où la concurrence est
nettement plus faible et où le produit parle déjà la langue.

---

## Les quatre paris

### 1. Le français, parce qu'il était gratuit

C'est le pari le plus rentable de tout ce chantier, et il ne demandait aucun
contenu nouveau : la vitrine française **existait déjà**, entièrement traduite,
et n'avait simplement pas d'adresse. Elle vivait derrière un sélecteur, à la
même URL que l'anglais — donc invisible pour tout moteur.

`/fr` la rend indexable. Le marché francophone du trading de détail est réel,
la concurrence y est plus faible qu'en anglais, et le produit y est
naturellement crédible : ses CGU, sa politique de confidentialité et sa voix
(le tutoiement) sont en français.

### 2. La longue traîne avant la tête

`KEYWORD_MAP.md` place délibérément les requêtes de catégorie
(« trading journal software ») **après** les requêtes étroites
(« prop firm trading journal », « r multiple trading »). Une page qui se
positionne sur une requête étroite envoie du trafic dans trois mois ; une page
qui vise la tête n'envoie rien avant deux ans, si jamais.

### 3. Être cité, pas seulement classé

Les moteurs de réponse redistribuent une part croissante de la découverte, et
c'est le terrain où un produit jeune part le moins désavantagé : ils pondèrent
la **clarté** autant que l'autorité. Un `llms.txt` exact, une FAQ balisée, un
rendu serveur et des réponses extractibles coûtent peu et rapportent tôt. Voir
`GEO_STRATEGY.md`.

### 4. Ne rien inventer, jamais

Ce n'est pas une posture morale, c'est un calcul. Un faux avis structuré, une
statistique inventée ou un profil social qui n'existe pas se découvrent, et la
sanction — perte de confiance côté moteur, propagation d'une information fausse
côté IA — coûte plus cher que tout ce que le mensonge aurait rapporté. Le site
n'affiche aucune note ; le graphe schema.org n'en déclare aucune. Le produit n'a
pas de compte Twitter ; le pied de page n'affiche pas d'icône Twitter.

---

## L'ordre des travaux

**Ce qui est fait** (cette PR) : la technique. Elle ne rapporte pas de trafic
toute seule — elle enlève ce qui empêche le reste de fonctionner. Un maillage
interne mort, une carte sociale invisible, une langue sans adresse et des
données structurées qui contredisent la page sont des plafonds : tant qu'ils
sont là, écrire du contenu ne sert pas à grand-chose.

**Ce qui suit** : le contenu (`CONTENT_ROADMAP.md`), à raison d'une page par
vague, écrite et relue. Puis, seulement ensuite, l'autorité — qui ne s'écrit pas
dans le code.

---

## Ce que le code ne peut pas faire

Il faut le dire clairement, parce que c'est la moitié du résultat :

- **L'autorité de domaine ne se code pas.** Les liens entrants viennent de
  choses réelles — un modèle utile qu'on partage, une présence dans les
  communautés de traders, un produit dont on parle.
- **Le contenu ne se génère pas.** Voir `CONTENT_ROADMAP.md`.
- **Le temps ne se raccourcit pas.** Une page publiée aujourd'hui trouve sa
  position en trois à six mois.

Et une garantie qui n'existera jamais : **aucune première position n'est
promise, ici ou ailleurs.** Le SEO technique retire des obstacles ; il n'achète
pas de rang. Quiconque promet le contraire vend autre chose.

---

## Comment on saura

| Indicateur | Où | Cadence |
|---|---|---|
| Pages indexées | Search Console → Couverture | mensuel |
| Impressions FR vs EN | Search Console, filtre par pays | mensuel |
| Requêtes qui ramènent | Search Console → Performances | mensuel |
| Core Web Vitals | Search Console → Signaux web | mensuel |
| Erreurs de données structurées | Search Console → Améliorations | à chaque déploiement |
| Exactitude des réponses IA | interrogation manuelle | mensuel — voir `GEO_STRATEGY.md` |

Le premier jalon honnête : **`/fr` indexée et recevant des impressions**. C'est
le signal que la moitié invisible du site est devenue visible. Il devrait
apparaître dans les deux à six semaines suivant le déploiement.
