# Neural Brain — graphe de connaissance et découvertes

Document propriétaire du Neural Brain : audit de départ (phase 0),
architecture livrée, décisions, ce qui reste à construire et pourquoi.
État vérifié contre le code le **2026-11-21**.

## 1. Ce que c'est

Une page (`/brain`, section « Neural Brain ») qui montre le journal entier
comme un graphe 3D navigable : trades, jours, mois, setups, symboles,
séances, erreurs et leurs familles, confluences, bandes de risque, captures,
setups manqués, annonces économiques, conversations avec Jarvis, notes de
recherche, expériences, simulations, rapports, propositions et
**découvertes**. Chaque nœud ouvre son original ; chaque lien dit pourquoi il
existe, avec quelle méthode, et à quel point on le sait.

Règle de fond, la même que le reste du produit : **les chiffres viennent des
moteurs déterministes, Jarvis ne fait que les formuler ; aucune formulation
causale ; aucun chiffre sous l'échantillon minimum ; toute statistique
porte son `n`.**

## 2. Audit de départ (phase 0)

| Constat | Conséquence pour le Neural Brain |
| --- | --- |
| Les statistiques sont recalculées en mémoire côté client depuis les trades (`domain/`), jamais stockées | Le graphe est lui aussi **dérivé** à l'affichage : aucune table de nœuds ni de liens, rien ne peut diverger de la source |
| Sources disponibles : `trades` (+ provenance lot 1), `missed_opportunities`, `research_notes`, `progress_experiments`, `monthly_reports`, `agent_proposals`, `simulation_scenarios`, `economic_events` (lecture publique) | Un extracteur par source dans `modules/knowledge/build.ts` |
| Conversations Jarvis et plan du labo Monte Carlo : **localStorage**, par appareil | Lus sur l'appareil (`peekConversations`, `mc-plan-v1.*`) ; un autre appareil ne les voit pas |
| Moteurs de preuve existants : EdgeLab (bootstrap par séances, Benjamini-Hochberg), BehaviorLab, seuils uniques `modules/patterns/thresholds` | Réutilisés tels quels par les découvertes ; un seul seuil ajouté (`MIN_GROUP_SESSIONS`) |
| Liens profonds : filtre unifié `?f=` (`tradeFilter`) et événement `tv:navigate` | Chaque type de nœud a une destination (`Record<NodeKind, …>`) ; ajout de `?open=` (fiche d'un trade, d'un setup manqué) et de l'ouverture d'une conversation précise |
| `setupQuality`, `confidence` (0–100, défaut 70), `mistakes[]`, `confluences[]` sont déclaratifs | Les comparaisons d'auto-évaluation listent le biais de résultat comme explication concurrente |
| Setups manqués : ni setup, ni heure, ni prix ; `estimatedR` estimé après coup | Comparaison manqués / pris étiquetée **hypothétique**, sans test ; aucun appariement de conditions inventé |
| Pas de captures analysées, pas d'OCR, pas de documents importés, pas de données de marché intrajournalières, `ai_embeddings` sans consommateur | Hors de ce lot (voir §6) ; rien n'est simulé à leur place |

## 3. Architecture

```
features/brain/NeuralBrain.tsx   page : état, recherche, filtres, frise, fil d'Ariane, ?node=
 ├─ useBrainData.ts              sources (stores existants, RLS), échecs comptés
 ├─ GraphCanvas.tsx + camera.ts  rendu Canvas 2D en perspective, orbite/zoom/pan, survol, vol
 ├─ Inspector.tsx                agrégats (n), faits, relations navigables, provenance
 ├─ DiscoveryPanel.tsx           découvertes, preuve, alternatives, expérience, revue
 ├─ destinations.ts              nœud → original (tv:navigate, ?f=, ?open=, ?report=)
 ├─ jarvisBrief.ts               sélection / découverte → question pour Jarvis (≤ 3 600 car.)
 ├─ useDiscoveryFeedback.ts      revues dans user_preferences (brain.feedback.v1)
 └─ presentation.ts              formes, couleurs, libellés i18n, textes des découvertes
modules/knowledge/               PUR, déterministe, partagé client et serveur
 ├─ types.ts      NODE_KINDS (famille, feuille), RELATIONS (origine), provenance
 ├─ graph.ts      KnowledgeGraph : ids stables, liens refusés vers le vide, voisins, chemin, recherche
 ├─ build.ts      extracteurs → graphe ; agrégats avec gardes d'échantillon
 ├─ discovery.ts  9 détecteurs, BH sur tous les tests, ajout au graphe
 ├─ stats.ts      écart entre deux groupes, bootstrap par séances
 ├─ layout.ts     disposition 3D seedée (grille de hachage, ancres de familles)
 └─ view.ts       niveau de détail, focus, frise, plafond compté, liens « trades en commun »
backend/ai-tools/tools.ts        get_discoveries (lecture seule) pour Jarvis
```

**Nœuds** : `kind:clé`, stables d'un calcul à l'autre (sélection, fil
d'Ariane, `?node=`). Une **feuille** (trade, jour, capture, annonce, setup
manqué) n'apparaît que si son moyeu est déplié, en focus, ou « tout montrer ».

**Liens** : `type|source|cible`, chacun avec `provenance` — origine
(`record`, `derived`, `statistical`, `text_match`), validation (`fact`,
`observed_association`, `hypothesis`), méthode versionnée, confiance,
instant, enregistrements sources, mesures. Ce qui ne se prouve pas n'est pas
relié : un import non relu n'a ni setup ni séance, un trade sans risque mesuré
n'a pas de bande, l'enchaînement de deux trades exige `verifiedPriorClosedTrade`,
une annonce n'est reliée à un trade que si elle tombe pendant la position
(±15 min, heure approximative = hypothèse). Une mention de texte
(conversation, setup manqué, proposition) est une **hypothèse**.

**Vue d'ensemble** : les trades masqués relient leurs moyeux visibles par des
liens `shares_trades` (nombre de trades partagés, trades en source, six au
plus par moyeu). Au-delà de 1 200 nœuds (500 sur téléphone), les moins reliés
sont écartés et **comptés** dans la barre d'état.

**Rendu** : Canvas 2D (pas de WebGL ni de three.js : ~600 Ko évités pour un
volume que le niveau de détail borne). Forme = famille, couleur = famille ou
résultat du trade (jamais la couleur seule). Aucun halo. La disposition se
pose puis le canevas ne se redessine qu'à une interaction ; sous
`prefers-reduced-motion`, elle se calcule hors écran et le vol saute. Clavier :
flèches, `+`/`-`, `0`, `Échap` ; recherche et inspecteur donnent le même
parcours sans pointeur.

## 4. Les découvertes

Un détecteur compare **deux groupes** de trades sur **une** dimension. Publié
seulement si chaque groupe atteint `MIN_GROUP` trades et `MIN_GROUP_SESSIONS`
séances, que l'intervalle à 95 % (bootstrap par séances, 2 000 tirages,
graine dérivée stable) exclut zéro, et que le q de Benjamini-Hochberg calculé
sur **toutes** les comparaisons de tous les détecteurs reste sous
`FDR_ALPHA` (0,1). Fragilité : l'écart survit-il au retrait du trade le plus
favorable ?

| Détecteur | Groupes | Catégorie |
| --- | --- | --- |
| `edge_condition` | Cellules EdgeLab (setup, symbole, séance, jour) contre zéro | Point fort / condition faible |
| `mistake_pair` | Les deux erreurs cochées / une seule des deux | Faiblesse d'exécution |
| `risk_after_loss` | Risque (× médiane) juste après une perte / un gain (ordre prouvé) | Anomalie de risque |
| `day_rank` | 3e trade et au-delà / deux premiers d'une séance (heures prouvées) | Motif caché |
| `setup_grade` | Notes 4–5 / 1–2 | Point fort ou contradiction |
| `confidence` | ≥ 75 / < 50 | Point fort ou contradiction |
| `missed_vs_taken` | R estimé des manqués / R mesuré des pris, mêmes instruments — **hypothétique, sans test**, écart ≥ `MIN_R_DELTA` | Motif caché |
| `simulation_risk` | Risque supposé par une simulation / risque mesuré médian — **hypothétique**, tolérance 25 % | Anomalie de risque |
| `data_gap` | Couverture d'un champ (risque, heure, setup) sous 70 % | Angle mort des données |

Chaque découverte porte ses **explications concurrentes** (régime, sélection,
biais d'étiquetage, valeur extrême, frais, recul, contexte du jour, règle de
taille, données manquantes) et une **expérience** mesurable. La revue du
trader (confirmée, rejetée, non concluante, gardée, note) garde l'empreinte de
la preuve ; si de nouvelles données la changent, l'écran montre l'ancienne et
la nouvelle valeur — rien n'est réécrit en silence.

## 5. Jarvis

- « Demander à Jarvis » sur un nœud ou une sélection multiple (Maj+clic) :
  la sélection est DÉCRITE (types, noms, agrégats du moteur, relations et
  leur statut de preuve) dans la question, puis Jarvis lit lui-même le journal
  avec ses outils ; les chiffres de la question comptent comme source pour la
  validation des réponses.
- `get_discoveries` : même calcul que l'écran, côté serveur, cloisonné
  utilisateur + compte actif. Offert au profil `jarvis_nq` et préchargé pour
  les diagnostics croisés.
- Un nœud « conversation » rouvre CETTE conversation (`tv:open-jarvis` avec
  `conversationId`). Les conversations restent des hypothèses, jamais des faits.

## 6. Ce qui reste — feuille de route

| Phase du cahier des charges | Livré dans ce lot | Reste, et ce qui bloque |
| --- | --- | --- |
| 1 Fondation | Graphe dérivé, provenance, requêtes, recherche | Recherche sémantique (`ai_embeddings` + pgvector) : demande un fournisseur d'embeddings payant — accord du propriétaire |
| 2 Multimodal | Captures = nœuds, aperçu et visionneuse | Analyse d'image, OCR, PDF/DOCX/XLSX : fournisseur de vision + stockage de documents ; jamais de détail de graphique inventé |
| 3 Neural Brain | 3D, filtres, focus, fil d'Ariane, frise, liens profonds, état mémorisé | Sélection au lasso ; vue « chemin entre deux nœuds » (`shortestPath` existe, sans interface) |
| 4 Connectivité | Journal, manqués, erreurs, risque, Monte Carlo (plan du labo + scénarios), Jarvis, recherche, expériences, rapports, propositions, annonces | Objectifs, plan de trading, checklist et séances (`trading_sessions`, `trade_intent`, `trade_reflection`) : extracteurs à ajouter |
| 5 Découverte | 9 détecteurs, FDR global, fragilité | Contrefactuels sur données de marché, ruptures de régime, régression multivariée |
| 6 Recherche externe | — | Agent de recherche web avec citations : fournisseur de recherche + budget |
| 7 Multi-agents | — | Orchestrateur et agents spécialisés au-dessus de `coach.orchestrator` |
| 8 Trader DNA, évolution | Revue avec preuve datée | Profil longitudinal par période, versions des découvertes stockées côté serveur |
| 9 Automatisation | — | Scan nocturne des découvertes (cron `pattern-scan` comme modèle) et notifications |
| 10 Qualité | Tests (moteur, écran, outil Jarvis), i18n en/fr, mobile utilisable | Audit d'accessibilité complet, test de charge sur 10 000 trades |

## 6 bis. Version 2 — environnement immersif (conception, 2026-11-21)

**Audit v1 → v2.** Le lot 1 est une page dans le cadre de l'app, rendue en
Canvas 2D : nœuds plats, liens uniformes, aucun flux, aucune transition de
vue. Les découvertes ne comparent qu'une dimension et n'exploitent ni
`trade_reflection` (plan respecté) ni `trade_intent` (émotion, risque prévu).
Aucune simulation de comportement, aucune lecture de l'évolution. Rien n'est
simulé ni factice : tout ce qui s'affiche vient des données.

**Moteurs séparés** (chacun pur et testé, sauf le rendu) :

| Moteur | Où | Rôle |
| --- | --- | --- |
| Connaissance | `modules/knowledge/build.ts` | Graphe dérivé + bibliothèque d'erreurs (signatures inférées) |
| Découverte | `modules/knowledge/discovery.ts` | Détecteurs v2 : après la 1re perte, concentration des pertes, piège du taux de réussite, combinaisons à deux conditions VALIDÉES hors échantillon, risque × qualité, processus × résultat, plan respecté, tendance des erreurs, décisions de ne pas trader |
| Simulation | `modules/knowledge/simulate.ts` | Scénarios sur l'historique (risque, plafond de trades, retrait d'une erreur, d'un setup, arrêt après N pertes, plan respecté) + projection bootstrap par séances ; trois étiquettes distinctes : observé, hypothétique, simulation statistique |
| Évolution | `modules/knowledge/evolution.ts` | Le trader face à lui-même : fenêtres mensuelles, erreurs résolues / nouvelles / persistantes avec intervalle |
| Calcul | `features/brain/brain.worker.ts` | Découvertes, simulations et évolution hors du fil d'affichage |
| Rendu | `features/brain/gl/` | WebGL2 maison (pas three.js : ~150 Ko gzip et un verrou npm fragile évités) — nœuds en SDF, liens « fait » pleins, « mesuré » pleins avec flux, « hypothèse » en pointillés, flux le long des chemins de preuve, champ d'étoiles en profondeur ; repli Canvas 2D sans WebGL |
| Son | `features/brain/brainSound.ts` | Web Audio, quatre sons courts, coupables (préférence mémorisée) |

**Expérience.** Plein écran au-dessus de l'app (`--tv-z-overlay`), entrée
cinématique (étoiles, familles qui s'allument, travelling de caméra ;
≤ 1,6 s, interrompable, instantanée sous mouvement réduit — même exception
que l'onboarding). Quatre modes : **Explorer**, **Découvertes**,
**Simuler**, **Évolution**. Rail des dimensions à gauche (isoler un cluster =
vol de caméra), panneau contextuel à droite seulement quand quelque chose est
choisi, recherche en haut, frise en bas. Survol d'un lien : sa nature, sa
force, sa preuve. Choisir une découverte : la caméra parcourt les éléments qui
la démontrent, le chemin s'illumine. Simuler : le graphe recule, les
trajectoires d'equity (observée, scénario, éventail statistique) prennent la
scène. Quitter : recul de caméra, retour à la page d'origine.

**Lumière.** Décision du propriétaire (2026-11-21) : à l'intérieur du canevas
du Neural Brain seulement, les nœuds et les flux portent une lueur bornée
(fondu additif, intensité plafonnée) — c'est la donnée qui éclaire. Hors du
canevas, la loi `theme` s'applique sans exception (aucune lueur sur carte,
bouton ou texte).

**Lots.** A moteur de découverte v2 + bibliothèque d'erreurs → B simulation +
évolution → C rendu WebGL + expérience immersive + SFX → D vérification
(données réelles, desktop/mobile, mouvement réduit, son coupé) et docs.

## 7. Risques connus

- **Calcul côté client** : un journal de plusieurs milliers de trades fait
  quelques centaines de ms de bootstrap au premier rendu des découvertes
  (calculées après l'affichage du graphe). Au-delà, passer le calcul dans un
  Worker, comme le labo Monte Carlo.
- **Conversations par appareil** : le graphe d'un autre appareil n'a pas les
  mêmes conversations — limite héritée, dite dans `docs/ROADMAP.md`.
- **Revues dans `user_preferences`** : une clé JSON par compte ; à migrer vers
  une table si l'historique des revues doit être interrogé côté serveur.
- **Correspondances de texte** : un nom de setup très court ou générique peut
  produire une mention sans rapport ; elles restent étiquetées hypothèse.
