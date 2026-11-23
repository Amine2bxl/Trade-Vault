# Décisions

Ajout seulement. Une décision remplacée est marquée, jamais effacée.

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
