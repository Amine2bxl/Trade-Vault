# Décisions — TradeVault

Ajout seulement. Une décision remplacée est marquée « Remplacée par … »,
jamais effacée. `ENV-…` : environnement de travail ; `D-…` : produit.

## ENV-001 — Setup de l'environnement cloud aux versions figées

- Date : 2026-11-18
- Statut : acceptée (validée par le propriétaire)
- Contexte : chaque session cloud part d'un conteneur neuf ; l'environnement
  `trade-vault` ne faisait que `bun install`, sans les outils de l'environnement
  Default.
- Décision : le script de setup de l'environnement installe, à des versions
  figées, graphify 0.9.112 (PyPI), les plugins ponytail (`96608e07`) et
  agent-skills (`39b723ce`), le design stack (emil-design-eng et choreograph
  `0f2e23b3`, impeccable `2b86d9c0`, design-taste-frontend `f6b76575`), le MCP
  Playwright `@playwright/mcp@0.0.84` sur `/opt/pw-browsers/chromium`, puis écrit
  le `~/.claude/CLAUDE.md` global. Chaque ajout se termine par `|| true` ; le bloc
  CLAUDE.md est gardé par un `grep` (idempotent) ; la ligne `bun install` d'origine
  reste la dernière et garde son code de sortie.
- Alternatives écartées : hook SessionStart commité dans le dépôt (lie l'outillage
  personnel au dépôt) ; installation manuelle à chaque session (oubliée, non reproductible).
- Conséquences : démarrage d'un conteneur neuf plus long (17,5 s mesurées en
  simulation, 30 s dans la session avec réseau ; 40 Mo de photothèque pour
  design-taste-frontend). Script : 95 lignes sur 100 permises.
  Sauvegarde de l'ancien script dans le LOG du 2026-11-18.

## ENV-002 — `graphify-out/` hors git

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : le graphe pèse 9,2 Mo et se reconstruit sans LLM en ~15 s.
- Décision : `graphify-out/` dans `.gitignore` ; `graphify update .` en début de
  session quand le graphe sert. Ni hook ni `graphify watch`.
- Alternatives écartées : commiter le graphe (bruit dans chaque diff, vite périmé).
- Conséquences : le graphe doit être reconstruit dans chaque conteneur neuf.

## ENV-003 — Skills design du dépôt prioritaires sur le design stack global

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : le design stack global (impeccable, emil-design-eng,
  design-taste-frontend) s'applique à tous les projets ; TradeVault a ses propres
  lois (langage Liquid, skills `.claude/skills/` : ship-ui, theme, ui-design…).
- Décision : sur ce dépôt, les skills du dépôt priment ; ligne ajoutée dans `CLAUDE.md`.
- Conséquences : en cas de conflit (durées, couleurs, ombres), la règle du dépôt gagne.

## ENV-004 — Mémoire projet dans `docs/memory/`

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : la mémoire automatique (`~/.claude/projects/`) est effacée à chaque
  session cloud.
- Décision : `STATE.md` (réécrit), `DECISIONS.md` et `LOG.md` (ajout seulement),
  commités avec le travail ; `CLAUDE.md` importe `@docs/memory/STATE.md`.
- Conséquences : à mettre à jour après chaque décision validée, fonctionnalité
  finie ou bug non trivial ; jamais de secret.

## D-001 — Un cerveau, deux peaux pour la checklist

- Date : 2026-11-22
- Statut : proposée (en attente de validation)
- Contexte : la checklist d'origine (« Pre-Trade OS » + HUD J.A.R.V.I.S, juillet
  2026) a été remplacée le 2026-10-31 (`54cfb0c`) par le moteur Plan → Séance →
  Bilan ; voix, sons et mise en scène ont été retirés avec l'ancienne liste à
  cocher.
- Décision : garder `features/checklist/sessionPlan.ts` comme seule logique de
  séance et rendre l'identité d'origine par un Mode Terminal (vue plein écran,
  voix, sons, cœur `JarvisNeural`).
- Alternatives écartées : restaurer `54cfb0c^` (réintroduit le cochage réflexe
  et les états FOMO auto-déclarés) ; recréer une checklist générique.
- Conséquences : exception de design à documenter dans `DESIGN_SYSTEM.md` ;
  catalogue `voice.ts` réutilisé.

## D-002 — Le calculé ne se stocke pas

- Date : 2026-11-22
- Statut : proposée
- Contexte : le brief demande une origine par valeur (MANUAL, IMPORTED,
  CALCULATED, AI_SUGGESTED, EXTERNAL) sans double source de vérité.
- Décision : R prévu, écarts, qualité d'exécution, état de séance sont dérivés
  à la lecture par des fonctions pures ; on ne stocke que les saisies, les
  corrections (origine `manual`) et les suggestions IA (avec statut).
- Alternatives écartées : colonnes calculées persistées (dérive au recalcul).
- Conséquences : migrations limitées aux champs saisis (`trade_intent`,
  `trades.stop_price/target_price`, `trade_reflection`, `missed_opportunities`,
  `trades.field_provenance`).

## D-003 — Le journal n'est jamais bloqué

- Date : 2026-11-22
- Statut : proposée
- Contexte : interruptions de séance demandées (perte du jour, trades max…).
- Décision : VERROUILLÉE ferme la porte d'entrée de la checklist, s'affiche
  partout et journalise toute dérogation motivée ; enregistrer un trade
  réellement pris reste possible ; aucun ordre broker, jamais.
- Alternatives écartées : bloquer le formulaire de trade (le journal mentirait).
- Conséquences : chaque règle reçoit `enforcement: "block" | "warn"`.

## D-004 — La voix du Mode Terminal, sans nouvel achat

- Date : 2026-11-22
- Statut : appliquée (le propriétaire a demandé de coder sans trancher les questions)
- Contexte : 71 clips anglais pré-rendus (voix clonée) ne servaient plus ;
  la voix hébergée (« Daniel ») existe déjà, payée à l'usage ; aucun clip
  français.
- Décision : répliques fixes anglaises jouées depuis leur clip d'abord
  (`clipFirst`), puis voix hébergée existante, puis voix du navigateur ;
  français via voix hébergée multilingue ou voix française de l'appareil.
  Langue, vitesse, volume et coupure réglables.
- Alternatives écartées : pré-rendre des clips FR avec ElevenLabs (achat non
  autorisé) ; voix du navigateur seule (identité perdue).
- Conséquences : régénérer les clips quand le catalogue change.

## D-005 — Seuls les setups manqués valides à issue connue coûtent

- Date : 2026-11-22
- Statut : appliquée
- Contexte : « R laissé sur la table » sommait tout R saisi, et la séance
  pré-remplissait le R promis par les niveaux comme s'il était acquis.
- Décision : classe (valide, hésité, écarté, invalide) + issue (cible, stop,
  inconnue) ; seuls valide/hésité à issue connue comptent ; stop = −1R.
  Anciennes lignes : R déclaré conservé.
- Alternatives écartées : recalculer l'historique (réécriture silencieuse).
- Conséquences : `estimated_r` stocke désormais le R qui compte.

## D-006 — Un seul moteur de capture, une seule table

- Date : 2026-11-24
- Statut : appliquée
- Contexte : captures, notes, dictée, Inbox, setups manqués demandaient chacun
  une analyse ; le brief interdit un second moteur, un second système de
  captures ou des appels IA répétés.
- Décision : une fonction serveur (`analyzeCapture`), un agent, un crible
  (`domain/capture`), une table `capture_items` qui est à la fois cache
  (empreinte unique), file « À traiter » et historique. Les fichiers restent
  dans `trade-screenshots` ; le trade devient propriétaire de ses chemins.
- Alternatives écartées : cache local au navigateur (perdu d'un appareil à
  l'autre) ; une table par usage (trades, setups manqués).
- Conséquences : migration `20261124120000_capture_items` (appliquée en prod).

## D-007 — L'IA lit, le domaine calcule et tranche

- Date : 2026-11-24
- Statut : appliquée
- Décision : le modèle ne rend que ce qui est visible ou écrit, avec sa
  confiance et sa preuve ; `normalizeExtraction` refuse les formats faux, les
  dates futures, les champs de note sans citation exacte, et rétrograde les
  niveaux incohérents. « Vérifié » n'est jamais accordé à l'IA. Contrat,
  risque, R, heure de New York, bougies : `domain/captureEnrich`.
- Conséquences : les bougies OHLC réelles restent inconnues sans données intraday.

## D-008 — La capture n'écrit jamais dans le journal

- Date : 2026-11-24
- Statut : appliquée
- Décision : la capture remplit seulement les champs vides du formulaire ; un
  champ déjà saisi devient un conflit à trancher ; « à revoir » ne s'applique
  que d'un geste. Les corrections du trader sont gardées à part et n'ajustent
  que les propositions suivantes (estimées), jamais les données passées.

## D-009 — Le résultat, jamais le processus

- Date : 2026-11-25
- Statut : appliquée (consigne du propriétaire, valable sur tout le site)
- Décision : l'interface montre la valeur, son unité, son `n` et l'action à
  faire ; jamais l'IA, son modèle, une méthode ou formule de calcul, une
  confiance ni l'origine d'une valeur. Une valeur incertaine porte une seule
  marque : « à vérifier ». Les diagnostics restent dans `/dev/*`.
- Remplace en partie : l'affichage détecté / calculé / estimé du panneau de
  capture et les étiquettes observé / déclaré / à confirmer (D-002 et le plan
  du 2026-11-22 les montraient) ; la provenance reste stockée, plus affichée.
- Conséquences : garde-fou `tests/outputNotProcess.test.ts` (textes en et fr,
  imports IA dans `src/app`, champs de provenance dans `features/capture`).
