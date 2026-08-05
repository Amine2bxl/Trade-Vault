# TradeVault — Audit produit, page par page

> Complément à `AUDIT-PREMIUM.md` (technique). Ici : la valeur, la rétention, la conversion,
> le moat. Raisonnement Product Lead, pas ingénieur.
>
> **Profondeur proportionnelle aux enjeux** — c'est un choix assumé. Consacrer autant de place
> à `Appearance` qu'au `Dashboard` serait un manque de jugement produit, pas de la rigueur.

---

## PARTIE I — LE DIAGNOSTIC PRODUIT CENTRAL

Avant les 23 pages, un constat qui les surplombe toutes et qui doit guider chaque arbitrage.

### 1. Le test « pourquoi ouvrir cette page chaque jour ? » — 19 pages sur 23 échouent

J'ai appliqué ton test à chaque page. Le résultat est brutal :

| Fréquence naturelle | Pages | Nombre |
|---|---|---|
| **Quotidienne** | Dashboard, Checklist, Jarvis, Inbox | **4** |
| Par trade | Journal, TradeModal, LotSizeCalculator, MissedOpportunities | 4 |
| Hebdomadaire | Analytics, Mistakes, Calendar, Goals | 4 |
| Mensuelle | Reports, Seasonality, TradingPlan | 3 |
| Une seule fois | Onboarding, ChecklistWizard, Appearance, Subscription, Settings, Profile, Landing, Legal | 8 |

**TradeVault a 23 surfaces qui se disputent l'attention, mais seulement 4 raisons de revenir
demain matin.** C'est le problème produit n°1 — bien avant les URLs ou la typographie.

Les produits premium ne sont pas ceux qui ont le plus d'écrans. Ce sont ceux qui ont **un
rituel**. Linear a un rituel. Superhuman a un rituel. Strava a un rituel. Un journal de trading
avec 23 onglets n'a pas de rituel : il a un menu.

### 2. Le vrai problème de rétention d'un journal de trading

Il faut le nommer précisément, sinon toutes les solutions sont à côté :

> **Journaliser est un effort immédiat dont la récompense est différée de plusieurs semaines.**

C'est structurellement le pire schéma de rétention qui existe. C'est pourquoi 90 % des journaux
de trading (papier, Notion, Excel, concurrents) sont abandonnés en trois semaines. Ajouter des
graphiques ne corrige pas ça — ça ajoute de la récompense différée à de la récompense différée.

**La seule correction est de rapprocher la récompense de l'effort.** Le trader doit obtenir
quelque chose **le jour même où il journalise**, pas au bout de 50 trades.

C'est exactement ce que Jarvis peut faire, et personne d'autre dans le produit.

### 3. La boucle qui doit devenir le cœur du produit

```
        Matin : Checklist pré-market
                 (Jarvis a injecté LA leçon d'hier)
                          ↓
                       Le trade
                          ↓
        Soir : journalisation (30 secondes)
                          ↓
        Jarvis réagit LE JOUR MÊME → 1 observation, 1 règle
                          ↓
        Le lendemain matin : la règle apparaît dans la checklist
                          ↓
        Une semaine après : « tu l'as tenue 4 fois sur 5, +180 € »
                          ↓
                    (boucle fermée)
```

**Cette boucle est simultanément la rétention, la conversion et le moat.** Elle n'existe pas
aujourd'hui : chaque maillon existe séparément, aucun ne parle au suivant.

- Le Checklist ne sait pas ce que Jarvis a dit hier.
- Jarvis ne sait pas si la règle proposée a été tenue.
- Les Goals ne savent pas si le plan est suivi.

**Tout le reste de ce document découle de ce constat.**

### 4. Conversion — le levier est déjà en place, mal exploité

La limite gratuite est de **5 questions Jarvis par jour** (`FREE_DAILY_LIMIT`). C'est le seul
mur payant significatif. Deux problèmes :

1. **Le mur arrive trop tard.** Un utilisateur gratuit qui pose 5 questions par jour est déjà
   convaincu. Celui qui en pose 1 par semaine ne heurtera jamais le mur — et ne convertira jamais.
2. **Le mur est quantitatif, pas qualitatif.** Limiter le *nombre* de réponses dit « paie pour
   avoir plus de la même chose ». Un mur premium dit « paie pour ce que tu ne peux pas avoir ».

> **Recommandation de repositionnement** : rendre gratuit l'usage ponctuel (questions), et
> réserver au payant **la mémoire et la continuité** — l'historique comportemental, le suivi des
> règles dans le temps, les rapports mensuels. Le gratuit devient une démo honnête ; le payant
> devient *impossible à obtenir ailleurs*. Cela aligne le mur payant sur le moat (§ Partie III).

---

## PARTIE II — LES 23 PAGES

Format par page : **Mission · Valeur · Retour · Rétention · Conversion · Moat · Ajouter ·
Supprimer · Micro-interactions · UX · IA · Indicateurs manquants · Spectaculaire.**

---

### 🟥 TIER 1 — LES 4 SURFACES QUOTIDIENNES
*Ce sont elles qui décident si le produit vit. 80 % de l'effort devrait aller ici.*

---

#### 1. Dashboard *(745 L)*

**Mission.** Répondre en 3 secondes à « où j'en suis ». Salutation contextuelle selon l'heure
(`greetingMorning/Afternoon/Evening/StillUp`) — un détail déjà bien vu.

**Valeur actuelle.** Agrégation P&L, win rate, R:R, accès rapide à l'ajout de trade et à l'import CSV.

**Pourquoi revenir ?** *Faible aujourd'hui.* Les chiffres ne bougent pas assez d'un jour à
l'autre pour créer une attente. Un trader qui n'a pas tradé hier n'a **aucune raison** d'ouvrir
le Dashboard.

**Rétention.** Le Dashboard doit cesser d'être un miroir et devenir **un briefing**. Un mur de
chiffres est consultatif ; une phrase qui change chaque jour est une habitude. La première ligne
devrait être générée : *« 3 jours sans dépasser ta taille max — ta meilleure série depuis mai. »*
C'est ça qu'on ouvre le matin.

**Conversion.** C'est l'endroit où montrer la valeur premium **verrouillée mais visible** :
la tendance sur 90 jours floutée avec « Pro », plutôt qu'un lien tarifs.

**Moat.** Le briefing quotidien n'est copiable qu'avec l'historique du trader. Un concurrent
peut copier la mise en page en un jour ; il ne peut pas copier « ta meilleure série depuis mai ».

**Ajouter.** Le briefing génératif · une série (« streak ») de discipline · le delta vs semaine
dernière sur chaque métrique.
**Supprimer.** Toute métrique qu'on ne consulte jamais deux fois. À trancher par la mesure
(Lot 0), pas à l'intuition.

**Micro-interactions.** Compteurs qui s'animent depuis la valeur précédente (et non depuis 0 —
la différence est ce qui compte) · pastille de tendance qui apparaît en décalé.
**UX.** La salutation devrait nommer le trader. Elle a son prénom (onboarding) et ne l'utilise pas.
**IA.** Briefing quotidien = la meilleure première application de la mémoire.
**Indicateurs manquants.** Série de discipline · évolution vs période précédente · **temps depuis
la dernière journalisation** (le meilleur signal de churn qui existe dans ce produit).
**Spectaculaire.** Ouvrir l'app et lire une phrase qui n'aurait pu être écrite que pour soi.

---

#### 2. Checklist pré-market *(2 244 L — le plus gros fichier du produit)*

**Mission.** Le rituel d'avant-séance : état émotionnel (`locked` / `calm` / `neutral`),
validation des conditions, actions guidées.

**Valeur.** **C'est la page la plus sous-estimée du produit.** C'est la seule qui intervient
*avant* le trade — donc la seule qui peut **changer un résultat** au lieu de le constater. Toutes
les autres sont rétrospectives.

**Pourquoi revenir ?** Elle a le seul déclencheur naturellement quotidien : l'ouverture des
marchés. C'est le rituel du produit.

**Rétention.** Trois leviers : (a) la série de jours consécutifs — puissante et absente ;
(b) l'injection de **la leçon d'hier** en tête de checklist ; (c) une **notification à heure
fixe** avant l'ouverture. Une checklist sans rappel est une checklist oubliée.

**Conversion.** La checklist *adaptative* (générée depuis les erreurs réelles) est un premium
évident et honnête. La checklist statique reste gratuite.

**Moat.** ⭐ **Le plus fort du produit.** Une checklist qui se réécrit à partir des erreurs
réelles du trader est strictement impossible à copier sans ses données. Un concurrent peut copier
les 12 items ; il ne peut pas copier « tu as sur-tradé 3 vendredis sur 4 ».

**Ajouter.** Série de jours · leçon d'hier en tête · notification pré-ouverture · **corrélation
mesurée** entre « checklist complétée » et P&L du jour — la preuve que le rituel rapporte.
**Supprimer.** Les items jamais décochés : ils créent une validation réflexe qui détruit la
valeur de tous les autres.

**Micro-interactions.** Progression qui se remplit · vibration légère à la complétion · la
dernière case déclenche une transition franche vers « prêt ».
**UX.** ⚠️ 2 244 lignes = évolution risquée. Découpage nécessaire avant d'y ajouter quoi que ce soit.
**IA.** Génération des items depuis `behaviorSignals`.
**Indicateurs manquants.** Taux de complétion · **P&L des jours avec checklist vs sans** (le
chiffre qui vend le produit à lui tout seul).
**Spectaculaire.** « Les jours où tu complètes ta checklist, tu gagnes 2,3× plus. » Fondé sur
ses données. Rien n'est plus convaincant.

---

#### 3. Jarvis *(88 L — coquille au-dessus de JarvisShell)*

**Mission.** Le coach IA. L'argument de vente principal.

**Valeur.** Réelle sur la réponse ponctuelle (analyse + preuve chiffrée + plan + action) après
la PR #143. **Nulle sur la continuité** : mémoire à ~0 % (cf. audit technique).

**Pourquoi revenir ?** Aujourd'hui : parce qu'on a une question. C'est du réactif — donc de
l'usage occasionnel, jamais un rituel. **Jarvis n'a aucune raison de se manifester de lui-même.**

**Rétention.** Le basculement décisif du produit : **passer du réactif au proactif**. Un coach
qui attend qu'on lui parle n'est pas un coach, c'est un moteur de recherche. Jarvis doit ouvrir
la conversation : *« Tu as clôturé 3 trades hier. Le deuxième me pose une question. »*

**Conversion.** Doit devenir **le** mur payant — mais sur la mémoire et la continuité, pas sur
le nombre de questions (cf. Partie I § 4).

**Moat.** ⭐⭐ **Le moat central**, à condition que la mémoire soit branchée. Sans elle, Jarvis
est un wrapper LLM — copiable en un week-end.

**Ajouter.** Mémoire persistante · messages proactifs · suivi des règles proposées · streaming.
**Supprimer.** Rien. Terminer, ne pas élargir.

**Micro-interactions.** Streaming mot à mot · les blocs de preuve qui apparaissent en décalé
après la prose.
**UX.** Pas d'`aria-live` : les réponses n'existent pas pour un lecteur d'écran.
**IA.** Toute la Partie III.
**Indicateurs manquants.** Taux d'adoption des règles proposées · **taux de tenue des règles** —
le seul chiffre qui prouve que le coaching fonctionne.
**Spectaculaire.** Jarvis qui écrit en premier, un lundi matin : *« La règle que tu as acceptée
il y a trois semaines : tenue 11 fois sur 12. Elle t'a rapporté 340 €. On en ajoute une ? »*

---

#### 4. Inbox *(255 L)*

**Mission.** Centraliser les notifications.

**Valeur.** Faible aujourd'hui : un canal sans contenu à forte valeur est un canal vide.

**Pourquoi revenir ?** **Uniquement si une pastille apparaît.** C'est la seule page dont
l'existence dépend entièrement de ce que les autres y déposent.

**Rétention.** L'Inbox est le **véhicule de la proactivité de Jarvis**. C'est là que les
observations quotidiennes doivent atterrir. Bien alimentée, elle devient la deuxième surface
quotidienne du produit. Mal alimentée, elle doit être supprimée — un onglet vide coûte de la
crédibilité.

**Conversion.** Les notifications intelligentes = premium ; les notifications système = gratuit.
**Moat.** Dépend entièrement de la qualité des observations (donc de la mémoire).
**Ajouter.** Observations de Jarvis · jalons d'objectifs · alertes de dérive comportementale.
**Supprimer.** Toute notification purement transactionnelle sans valeur d'analyse.
**Micro-interactions.** Pastille qui pulse une fois · disparition en fondu au marquage comme lu.
**UX.** 0 breakpoint responsive — à vérifier visuellement.
**Indicateurs manquants.** Taux d'ouverture, taux d'action par type de notification.
**Spectaculaire.** Une notification par jour, toujours pertinente, jamais générique.

---

### 🟧 TIER 2 — LES SURFACES DE TRAVAIL
*Utiles, consultées régulièrement, mais elles ne créent pas l'habitude.*

---

#### 5. Journal *(660 L)*

**Mission.** La table des trades : recherche, filtres, export CSV, tri.
**Valeur.** Élevée et non négociable — c'est le registre. Le socle de confiance du produit.
**Pourquoi revenir ?** Pour retrouver ou saisir un trade. Motif fonctionnel, pas émotionnel.
**Rétention.** Le levier n'est pas la consultation, c'est **la friction de saisie**. Chaque
seconde retirée de la journalisation augmente directement la rétention. C'est *la* métrique de
cette page.
**Conversion.** L'import CSV et l'historique illimité sont des limites premium naturelles.
**Moat.** Faible en soi. Élevé indirectement : c'est lui qui produit la donnée du moat.
**Ajouter.** Saisie rapide en une ligne · duplication du dernier trade · **captures d'écran de
graphiques** (fort ancrage mémoriel, et Supabase Storage existe déjà).
**Supprimer.** Les colonnes jamais triées ni filtrées — à trancher par la mesure.
**Micro-interactions.** Nouvelle ligne surlignée puis fondue · P&L qui compte jusqu'à sa valeur ·
annulation après suppression (« Annuler » plutôt qu'une confirmation modale).
**UX.** La suppression doit être annulable, pas confirmée : moins de friction, moins de risque.
**IA.** Détection automatique du setup depuis les notes.
**Indicateurs manquants.** **Temps médian de journalisation** — indicateur de santé produit n°1.
**Spectaculaire.** Journaliser un trade en moins de 10 secondes.

---

#### 6. Analytics *(1 133 L)*

**Mission.** L'analyse approfondie : profit factor, distribution, ratios.
**Valeur.** Riche — probablement **trop**. 1 133 lignes de graphiques face à un trader qui
cherche une réponse, pas un tableau de bord d'analyste.
**Pourquoi revenir ?** Rarement. Consultation hebdomadaire au mieux. Et c'est acceptable.
**Rétention.** Ne pas chercher à en faire une page quotidienne — ce serait une erreur de
positionnement. En faire **la page de la réponse** : ouvrir sur les 3 conclusions du moment,
puis les graphiques en dessous pour qui veut creuser.
**Conversion.** Les analyses avancées derrière le premium.
**Moat.** Faible : les formules sont publiques. Le moat est dans l'**interprétation**, pas le calcul.
**Ajouter.** Un résumé en 3 phrases généré en haut de page.
**Supprimer.** ⚠️ **Le chantier le plus urgent de cette page.** Chaque graphique doit justifier
sa présence par une décision qu'il permet de prendre. Ceux qui n'en permettent aucune sont du
bruit qui dilue les autres.
**Micro-interactions.** Tracé progressif des courbes · infobulles suivant le curseur.
**UX.** Trop de tout, en même temps. La hiérarchie manque.
**IA.** Interprétation automatique de chaque graphique — c'est ce qui différencie.
**Indicateurs manquants.** Espérance mathématique par setup · **courbe de progression dans le temps**
(le trader veut savoir s'il *s'améliore*, pas seulement s'il gagne).
**Spectaculaire.** Une courbe de progression sur 6 mois qui prouve visuellement qu'il progresse.

---

#### 7. Mistakes *(563 L)*

**Mission.** Les erreurs récurrentes, leur fréquence, leur coût.
**Valeur.** ⭐ **Excellente. C'est le concept le plus fort du produit après Jarvis.** Chiffrer
une erreur en euros (`totalCost`, `cleanWr` vs `mistakeWr`) est exactement le bon angle : ça
transforme un reproche en information.
**Pourquoi revenir ?** Pour vérifier qu'une erreur recule. Motif **émotionnel** — donc puissant.
**Rétention.** Rendre visible la **tendance** : « ce mois-ci vs le mois dernier ». Une erreur qui
recule est la meilleure raison de revenir qui existe dans ce produit.
**Conversion.** La détection automatique des erreurs = premium.
**Moat.** ⭐ Élevé : les modèles de détection calibrés sur données réelles ne se copient pas.
**Ajouter.** Tendance par erreur · lien direct « créer une règle » (Jarvis sait déjà le faire) ·
**coût projeté sur l'année** — chiffre choc, tiré de ses vraies données.
**Supprimer.** Rien. Cette page est saine.
**Micro-interactions.** Barres qui se remplissent · flèche de tendance animée.
**UX.** Le ton doit rester factuel : ces chiffres sont durs à lire.
**IA.** Détection automatique depuis les notes.
**Indicateurs manquants.** Évolution dans le temps · projection annuelle du coût.
**Spectaculaire.** « Cette erreur t'a coûté 2 400 € cette année. Elle a reculé de 40 % ce mois-ci. »

---

#### 8. Calendar *(591 L)* · 9. Goals *(245 + 729 L)* · 10. Reports *(529 L)*

**Calendar** — Vue mensuelle P&L, jours gagnants, R:R. *Valeur : la reconnaissance visuelle de
motifs (les vendredis rouges sautent aux yeux).* **Ajouter** : cliquer un jour ouvre ses trades ·
**superposition des événements économiques** (`EconomicNews` existe déjà — la corrélation
« mes pires jours = jours de news » est une révélation produit à coût quasi nul).
*Moat : moyen. Spectaculaire : une heatmap annuelle façon contributions GitHub.*

**Goals** — Objectifs et progression. ⚠️ **Point faible majeur** : un objectif sans suivi actif
est un vœu. Rien ne les rappelle, rien ne célèbre un jalon. **Ajouter** : jalons intermédiaires ·
projection (« à ce rythme, atteint le 12 mars ») · Jarvis qui relie ses conseils à l'objectif
déclaré. *Moat : fort une fois relié à Jarvis. Spectaculaire : la projection datée.*

**Reports** — Rapports mensuels générés. *Valeur élevée, fréquence faible (1×/mois).* **Le levier
n'est pas la page, c'est la livraison** : un rapport qui arrive par e-mail le 1er du mois est lu ;
un rapport qu'il faut aller chercher ne l'est pas. **Ajouter** : envoi automatique · comparaison
mois précédent · **format partageable** (vecteur d'acquisition organique gratuit).
*Moat : fort (nécessite l'historique). Spectaculaire : un PDF dont il est fier.*

---

### 🟨 TIER 3 — LES SURFACES SPÉCIALISÉES

**11. MissedSetups** *(796 L)* — Concept **original et différenciant** : journaliser ce qu'on
n'a *pas* pris. Personne ne fait ça. Mais 796 lignes pour une fonction secondaire interroge
l'allocation d'effort. *Ajouter : coût cumulé des setups manqués. Moat : élevé (donnée propriétaire
inédite).*

**12. Seasonality** *(781 L)* — Biais saisonniers, onglets Assets/Journal. **La partie « Assets »
n'utilise pas les données du trader** (d'où le `assetDisclaimer`) : c'est du contenu générique,
donc **copiable et hors moat**. La partie « Journal » (saisonnalité personnelle) est la vraie
valeur. *Recommandation : investir la seconde, dégraisser la première.*

**13. EconomicNews** *(751 L)* — Calendrier économique. Même analyse : donnée **achetée, non
propriétaire** — aucun moat. Sa valeur est **relationnelle** : croisée avec les trades (« tu perds
les jours de CPI »), elle devient unique. Seule, c'est une commodité que ForexFactory offre gratuitement.

**14. LotSizeCalculator** *(562 L)* — Calcul de taille avec jauge de risque. Outil utilitaire
soigné, **fort en acquisition** (requête recherchée), faible en rétention. *Recommandation : en
faire une page publique, indexée, non authentifiée → acquisition SEO gratuite.*

**15. TradingPlan** *(668 L)* — Le plan écrit. **Devrait être la colonne vertébrale du produit** ;
c'est aujourd'hui un document isolé. Rien ne vérifie que les trades le respectent. *Le relier à
la checklist et à Jarvis est un chantier à fort effet de levier.*

---

### 🟩 TIER 4 — SURFACES DE CONFIGURATION ET PUBLIQUES

**16. Onboarding** *(787 L)* — Bien construit (prénom, capital, thème, notifications). **C'est le
moment le plus décisif du produit** : il détermine ce que Jarvis saura du trader. *Ajouter : montrer
de la valeur AVANT de tout demander (une analyse dès le premier trade importé). Chaque question
supplémentaire coûte des utilisateurs — chacune doit alimenter le coaching, sinon la supprimer.*

**17. Settings** *(468 L)* · **18. Profile** *(203 L)* — Fonctionnels. *Profile contient les liens
support/collaboration : bon signal de proximité. Rien à ajouter, c'est déjà au bon niveau.*

**19. Subscription** *(386 L)* — Essai, plans, facturation. **Doit démontrer la valeur, pas lister
des fonctions.** *Ajouter : « ce que tu perds en repassant gratuit », chiffré sur ses propres
données — l'argument de rétention le plus efficace qui existe.*

**20. Appearance** *(29 L)* — Thèmes. Petit, propre, et **plus important qu'il n'y paraît** : la
personnalisation crée de l'attachement. Peu coûteux, bon rendement émotionnel.

**21. ChecklistWizard** *(563 L)* — Configuration initiale de la checklist. *Devrait être alimenté
par les erreurs détectées plutôt que par des choix manuels.*

**22. Landing** *(1 490 L)* — Vitrine SSR. Bien pensée techniquement (SSR pour SEO/GEO).
*Le meilleur argument de vente serait une démo réelle de Jarvis, pas une description de Jarvis.*

**23. Contact / Legal** — Nécessaires, conformes. Rien à signaler.

---

## PARTIE III — LE MOAT, PAR ORDRE DE SOLIDITÉ

| # | Moat | Copiable avec le code ? | Se renforce seul ? |
|---|---|---|---|
| 1 | **Mémoire longitudinale du trader** | ❌ Impossible | ✅ Chaque jour |
| 2 | **Boucle règle → tenue → mesure** | ❌ Impossible | ✅ Chaque règle |
| 3 | **Détection calibrée sur corpus réel** | ❌ Impossible | ✅ Chaque utilisateur |
| 4 | **Checklist adaptative** | ❌ Impossible | ✅ Chaque erreur |
| 5 | Setups manqués (donnée inédite) | ⚠️ Concept copiable, données non | ✅ |
| 6 | Rapports mensuels partagés | ⚠️ | ➖ |
| — | *Intégration LLM* | ✅ **En un week-end** | ❌ |
| — | *Design & UI* | ✅ **En une semaine** | ❌ |
| — | *Calculs de stats* | ✅ **Formules publiques** | ❌ |
| — | *Calendrier économique* | ✅ **Donnée achetée** | ❌ |

**Conclusion stratégique.** Les quatre premiers moats reposent **tous** sur la même brique :
la mémoire persistante. Ce n'est pas une fonctionnalité parmi d'autres — **c'est le socle de
tout l'avantage concurrentiel de TradeVault.** Et c'est aujourd'hui la seule qui n'est pas branchée.

---

## PARTIE IV — CE QUE JE RECOMMANDE, ET CE QUE JE DÉCONSEILLE

### Faire
1. **Brancher la mémoire.** Tout le moat en dépend.
2. **Rendre Jarvis proactif.** Réactif = outil. Proactif = coach.
3. **Fermer la boucle règle → tenue → mesure.** C'est rétention + conversion + moat d'un coup.
4. **Faire du Dashboard un briefing.**
5. **Repositionner le mur payant** sur la mémoire plutôt que sur le nombre de questions.

### Ne pas faire
1. **N'ajoute pas de 24ᵉ page.** Le produit souffre de dispersion, pas de manque.
2. **N'investis pas le calendrier économique ni la saisonnalité d'actifs** : données non
   propriétaires, zéro moat.
3. **Ne cherche pas à rendre Analytics quotidienne.** Ce n'est pas sa nature ; forcer nuirait aux deux.
4. **N'ajoute rien à `Checklist.tsx` avant de l'avoir découpé** (2 244 lignes).

---

## PARTIE V — LIMITES DE CET AUDIT

Par honnêteté, et parce qu'un Product Lead qui ne distingue pas ce qu'il sait de ce qu'il suppose
est dangereux :

- **Je n'ai pas vu l'application tourner.** Aucune capture, aucun parcours réel. Tout vient de la
  lecture du code. Mes jugements UI sont donc des **hypothèses informées**, pas des observations.
- **Je n'ai aucune donnée d'usage.** Les recommandations « supprimer ce qui ne sert pas » sont des
  *méthodes*, pas des verdicts : seul le Lot 0 (mesure) permettra de trancher.
- **Je ne connais pas tes utilisateurs.** Pas d'entretiens, pas de retours, pas de taux de churn.
  Un Product Lead avec ces éléments pourrait contredire une partie de ce document — et aurait raison.
- **Les priorités sont un raisonnement, pas un résultat.** Elles découlent d'une logique explicite
  (§ Partie I), qui reste discutable.

**La chose la plus utile que tu puisses faire après avoir lu ceci : brancher la mesure, puis me
contredire avec des chiffres.**
