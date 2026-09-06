# KEYWORD_MAP — TradeVault

Une URL, une intention, un mot-clé principal. Cette carte est la règle qui
empêche deux pages de se disputer la même requête (cannibalisation) — le mode
d'échec le plus courant d'un site qui grandit.

**Avertissement, et il compte.** Les volumes ci-dessous ne sont pas mesurés :
ce dépôt n'a accès à aucun outil de recherche de mots-clés. Ils sont donnés
comme des **ordres de grandeur relatifs** (`élevé` / `moyen` / `faible`), pas
comme des chiffres. À vérifier dans Search Console une fois les pages en ligne
— c'est la seule source honnête, parce qu'elle mesure *ce site*, pas le marché
en général.

---

## Les pages existantes

| URL | Intention | Mot-clé principal | Secondaires | Volume |
|---|---|---|---|---|
| `/` | commerciale | trading journal | AI trading coach, trade journal app, trading journal software | élevé |
| `/fr` | commerciale | journal de trading | carnet de trading, coach IA trading, journal de trading en ligne | moyen |
| `/contact` | navigationnelle | tradevault support | tradevault contact | faible |
| `/privacy` | navigationnelle | tradevault privacy | — | faible |
| `/terms` · `/cgu` | navigationnelle | tradevault terms / CGU | — | faible |

`/demo` et `/demo-site` restent en `noindex` : ce sont des parcours produit, pas
des pages de contenu. Elles n'ont donc pas de mot-clé cible, et c'est voulu.

---

## Les pages à écrire

Ordonnées par rapport valeur / effort. Le détail éditorial est dans
`CONTENT_ROADMAP.md` ; ici, seulement l'attribution de mot-clé, pour que
personne n'écrive deux fois la même page.

| URL proposée | Intention | Mot-clé principal | Pourquoi elle gagne |
|---|---|---|---|
| `/trading-journal` | commerciale | trading journal software | La requête de catégorie. `/` porte la marque ; cette page porte le produit générique. |
| `/fr/journal-de-trading` | commerciale | journal de trading excel | Capte la requête « comment tenir un journal », dont la réponse actuelle du marché est un tableur. |
| `/ai-trading-coach` | commerciale | ai trading coach | Requête émergente, faible concurrence, exactement ce que fait Jarvis. |
| `/trading-journal-template` | informationnelle | trading journal template | Volume élevé, intention haute-de-tunnel. Aimant à liens. |
| `/fr/discipline-trading` | informationnelle | discipline trading | Le vrai sujet du produit, et le vocabulaire des traders francophones. |
| `/r-multiple` | informationnelle | r multiple trading | Requête de définition. Établit l'expertise, se cite facilement. |
| `/prop-firm-journal` | commerciale | prop firm trading journal | Segment étroit, intention d'achat forte, concurrence faible. |

---

## Les règles qui tiennent cette carte

1. **Un mot-clé principal appartient à UNE page.** Si une nouvelle page vise un
   mot-clé déjà attribué, ce n'est pas une nouvelle page : c'est une mise à jour
   de l'existante.
2. **Le mot-clé principal apparaît dans le `<title>`, le `<h1>` et les cent
   premiers mots.** Pas ailleurs par obligation — la répétition n'est pas un
   signal, c'est un symptôme.
3. **Le français n'est pas une traduction de l'anglais.** Les requêtes ne se
   décalquent pas : « journal de trading excel » n'a pas d'équivalent anglais de
   même intention. Chaque page FR est écrite pour ses propres requêtes, et c'est
   pourquoi `/fr` a sa propre description plutôt que la traduction de celle
   de `/`.
4. **Aucune page n'est créée pour un mot-clé seul.** Une page qui n'aurait pas
   existé sans le SEO est une page-satellite, et les moteurs les traitent comme
   telles.

---

## Le trou béant du haut de tableau

`/` cible « trading journal » avec un `<h1>` qui dit **« Trade better.
Understand why. »** — aucune occurrence du mot-clé, ni d'aucun autre. Le
`<title>` et la description sont corrects ; le `<h1>` est le maillon isolé, et
c'est le signal on-page le plus fort d'une page.

C'est le point **P0-4** de l'audit, laissé volontairement non appliqué : réécrire
l'accroche d'une page de vente est une décision de marque. La proposition, à
structure et longueur identiques :

| Clé | Actuel | Proposé (EN) | Proposé (FR) |
|---|---|---|---|
| `hero.h1a` | Trade better. | Your trading journal. | Ton journal de trading. |
| `hero.h1b` | Understand why. | With an AI coach. | Avec un coach IA. |

Le souligné manuscrit reste sur la seconde ligne, le rythme en deux temps est
conservé, la mise en page ne bouge pas.
