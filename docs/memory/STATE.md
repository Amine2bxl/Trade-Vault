# État du projet — mémoire de session

Mis à jour : 2026-11-25 (session `claude/great-meitner-lnjgls`). **PR unique
#256 vers `main`** : il contient #250, #251, #252, #253 et #255 (fermés) ;
#254 (Neural Brain) exclu à la demande du propriétaire.

## Objectif

Un trader qui capture une image plutôt que remplir quinze champs, parle plutôt
que rédige, valide plutôt que ressaisit, et passe d'une donnée à sa source
sans rechercher.

## État actuel

- **#255** (lots A→G du plan `docs/superpowers/plans/2026-11-22-…`) : livré,
  non fusionné. Ses migrations sont **appliquées en production** (2026-11-24),
  ainsi que `lifetime_license`, qui manquait. Types régénérés, `as never` retirés.
- **#256** (cette session) :
  - Moteur de capture : `domain/capture*`, `modules/ai-provider` (images),
    `modules/ai/agents/capture.agent`, `backend/capture.functions`, table
    `capture_items` (appliquée en prod, RLS vérifiée).
  - Formulaire de trade et de setup manqué : Analyser / Dicter / note → champs
    vides remplis, détecté / calculé / estimé / à revoir / manquant, doublons.
  - Respect du plan règle par règle : `modules/discipline/compliance`.
  - Inbox : « Captures à traiter » (`features/capture/CaptureQueue`).
  - Liens : `utils/navigate` (`navigateTo`, `openTrades`, `?trade=`, `?missed=`).
- Vérifié de bout en bout sur la preview (Gemini 2.5 Flash, base réelle) :
  capture d'un long NQ 5m → 9 champs remplis, risque calculé, confluences vues.
- Portes : typecheck, lint (0 erreur), build, 2 256 tests (TZ New York et Auckland).

## Décisions clés

- ENV-001 à ENV-004 : environnement cloud figé, `graphify-out/` hors git, skills
  du dépôt prioritaires sur le design global, mémoire dans `docs/memory/`.
- D-001 à D-005 : voir `DECISIONS.md` (#255).
- D-006 : un seul moteur de capture, la table `capture_items` sert de cache,
  de file et d'historique — appliquée.
- D-007 : l'IA lit, le domaine calcule et tranche ; « vérifié » interdit à l'IA — appliquée.
- D-008 : la capture n'écrit jamais dans le journal ; seul le formulaire validé écrit — appliquée.
- D-009 : le résultat, jamais le processus (règle universelle, AGENTS.md) —
  appliquée, garde-fou `tests/outputNotProcess.test.ts`.

## Prochaines étapes

1. Supprimer le compte de test `tv-capture-e2e@test.dev` (id `340d8271-…`) et
   son fichier `trade-screenshots/340d8271-…/` : la suppression SQL attendait
   une confirmation dans l'outil Supabase.
2. Jarvis : outil de recherche (trades, setups manqués, captures) qui rend des
   liens `navigateTo` ; journal vocal qui passe par `analyzeCapture` (note).
3. Rattachement automatique trade ↔ séance (`trades.session_id` existe, jamais posé).
4. Revue de séance générée (lot I de #255) et panneau comportemental (lot G).
5. Relire puis fusionner #256 (PR unique).

## Questions ouvertes

- Langue des commits et commentaires : AGENTS.md dit français, la consigne
  globale dit anglais (commits actuels : français).
- Clips français du Mode Terminal : ElevenLabs (payant) ou F5-TTS local ?
- Bougies OHLC réelles / MAE-MFE : fournisseur intraday payant (Databento) ?
