# TradeVault — FEATURES_STATUS.md

> **État vivant des fonctionnalités** : terminées, en cours, prévues.
> Chaque entrée : statut · priorité · dépendances · description.
> Les priorités et numéros (#1–#29) renvoient à la liste unique de
> [`ROADMAP.md`](ROADMAP.md) §5. Le contexte global est dans
> [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).
>
> Statuts : ✅ Terminé · 🟡 En cours (partiellement livré) · ⚪ Prévu.
> Priorités : P0 (bloque crédibilité/lancement) · P1 (fort ROI) ·
> P2 (important, non urgent) · P3 (fond/opportuniste) · — (socle, hors grille).

Dernière mise à jour : 2026-07-21 (Sprints 1–2 du backlog 90 jours. S1 :
Coach V2 Phase 1, Discipline Score v1 + streak, analytics first-party. S2 :
moteur comportemental `modules/trading/behavior` (post-perte/revenge,
overtrading, timing, adhérence — significativité obligatoire), « coût de mes
erreurs » mensuel (carte Mistakes + bloc BEHAVIORAL PATTERNS injecté au
coach), Onboarding V2 (situation prop-firm, écran miroir, démo par défaut +
fallback, 1ᵉʳ message coach déterministe). Voir `BACKLOG_90_DAYS.md`).

---

## 1. Fonctionnalités terminées ✅

### Cœur trading

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Journal de trades | ✅ | — (socle) | Supabase (RLS), Storage | CRUD complet : stratégie, confluences, erreurs, qualité de setup, notes, R-multiple, screenshots. Optimistic UI (l'UI n'attend jamais le réseau). |
| Import CSV | ✅ | — | Journal | `ImportCsvModal` — import en masse. Le blindage + fallback démo restent à faire (voir P0 #5). |
| Dashboard | ✅ | — | Journal, `computeStats` | Stats clés, equity curve (lazy, −381 KB), streaks, skeletons. |
| Analytics | ✅ | — | Moteur d'analyse (pur) | Win rate, profit factor, drawdown, par symbole/jour/stratégie. Les verdicts en clair restent à faire (P1 #7). |
| Calendrier P&L | ✅ | — | Journal | Vue calendrier des performances quotidiennes. |
| Seasonality | ✅ | — | Journal | Analyse de saisonnalité des performances. |
| Mistakes (erreurs récurrentes) | ✅ | — | Moteur d'analyse | Erreurs chiffrées (occurrences + P&L total) issues du moteur déterministe. Le « coût des erreurs » mensuel narré reste à faire (P1 #6). |
| Missed Opportunities | ✅ | — | Journal | Journal des setups manqués (avec détail par modal). |
| Goals (objectifs) | ✅ | — | Journal, cron `goal-reminders` | Objectifs cible/actuel + rappels automatiques. |
| Checklist pré-market (+ Wizard) | ✅ | — | Bus d'événements (`tv:ask-coach`) | Rituel de discipline quotidien ; peut ouvrir le coach avec un prompt prérempli. |
| Trading Plan | ✅ | — | — | Plan de trading structuré du trader. |
| Lot Size Calculator | ✅ | — | — | Calculateur de taille de position. |
| Economic News | ✅ | — | — | Calendrier économique intégré. |
| Rapports mensuels | ✅ | — | Cron Vercel `0 6 1 * *`, emails | Génération + envoi automatique. À terme alimentés par la Weekly Review (fusion prévue). |

### IA

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| AI Platform (infrastructure) | ✅ | — (fondation) | `modules/ai`, `modules/ai-provider` | Router, Provider Service (retry + télémétrie), Context Builder (caps stricts), Prompt Builder, Tool System, Response Formatter. 46 tests verts. |
| Providers multi-modèles | ✅ | — | AI Platform | Gemini (défaut) / Anthropic / OpenAI-compatible, tool-calling inclus. Changer de modèle = une env var (`AI_PROVIDER`). |
| **AI Coach V1** (P0 #1, 1ʳᵉ partie) | ✅ | **P0** | AI Platform, `computeStats`, `requireProAccess` | Agent read-only en prod : lit stats, trades, erreurs, objectifs ; répond en multi-tours. Règle `ANTI_HALLUCINATION` : n'invente jamais, ne prédit jamais le marché. Surfaces : widget `AiAssistant` (voix, persistance locale) + page Insights (quick prompts). |
| Mémoire coach (seed profil) | ✅ | P0 | Table `ai_memory` (RLS), onboarding | `ai_memory` + seed du profil onboarding (`seedProfileMemory`) livrés (PR #14). **Non injectée dans Coach V1** — branchement = V2 (voir « En cours »). |

### Plateforme, growth & design

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Auth + onboarding profilé | ✅ | — | Supabase Auth | Signup/login, onboarding (style, expérience, pain, objectif mensuel, ICT) qui nourrit la mémoire du coach. |
| i18n FR/EN | ✅ | — | `useT()` | Bilingue intégral ; la langue UI pilote la langue des réponses IA. |
| PWA + push notifications | ✅ | — | `push.functions`, service worker | Notifications push + bannière d'onboarding push. |
| Command Palette | ✅ | — | — | Navigation clavier rapide. |
| Thèmes (Appearance) | ✅ | — | — | Personnalisation visuelle. Sera absorbé dans Réglages (P1 #11). |
| Abonnement (Stripe + crypto) | ✅ | — | `billing.server`, `crypto-pay.server`, webhooks idempotents | Infra payante complète mais **désactivée** : `AI_REQUIRE_PRO=false`, tout gratuit en beta. |
| Emails lifecycle | ✅ | — | Cron `0 8 * * *`, `email-templates` | Emails de cycle de vie automatiques. |
| Landing + pages légales | ✅ | — | — | Landing marketing premium (son thème = âme visuelle du produit), privacy/terms. |
| Trustpilot (widget + prompt) | ✅ | — | ⚠️ **ZONE GELÉE** | Conservé en l'état, vrais avis en cours d'arrivée. **Ne jamais toucher.** |
| Design System `shared/ui` | ✅ | — | `styles.css` (tokens `--tv-*`) | Button, Input, Card, Badge, Table, Modal, Chart, Typography, `cn`, `tokens.ts` — pointent vers le CSS existant, zéro changement de rendu. |
| Sécurité socle | ✅ | — | Supabase | RLS owner-only, `consume_ai_quota` + rate-limit, idempotence webhooks, index composites en prod. |

---

## 2. Fonctionnalités en cours 🟡

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Coach IA « complet » (P0 #1, reste) | 🟡 | **P0** | Coach V2 P1 ✅, `ai_memory` ✅ | ✅ Fait (Sprint 1) : mémoire long terme + règles + objectifs injectés (`buildCoachV2Payload`), persona doctrine de coaching, format adaptatif (conversationnel par défaut, rapport sur demande de bilan). Reste : fil de conversation en DB (cross-device), mémorisation active des leçons/engagements (Sprint 3). |
| Adoption du Design System | 🟡 | P3 (fond) | `shared/ui` ✅ | Modals + Inputs migrés (byte-identical). Reste : Cards, Badges, boutons restants, modals lourdes (TradeDetailModal swipe, MissedOpportunities, AuthModal/landing, MobileNav). Un lot = un build vert. |
| Restructuration du dépôt | 🟡 | P2 #23 | Issues #46, #49 | Phases 1/3/4 faites (code mort, types Supabase, frontière serveur). Reste : pruning deps (bloqué egress registry, #46) et UI par `features/` (au fil des lots, #49). |
| Dette typographique / tokens morts | 🟡 | P3 | `DESIGN-SYSTEM.md` | ~300 tailles arbitraires (`text-[10px]`…), anciens tokens shadcn oklch à purger. Résorption opportuniste, jamais en urgence. |

---

## 3. Fonctionnalités prévues ⚪

### P0 — Bloquant crédibilité / lancement

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Insights proactifs (#2) | ⚪ | **P0** | Coach V1 ✅, moteur d'analyse ✅, notifications ✅, jobs IA | Détection de pattern → notification : le produit vient au trader (« tu as pris 3 trades hors plan cette semaine »). Cœur de la promesse « coach 24 h/24 ». |
| Weekly Review + Daily Brief (#3) | ⚪ | **P0** | AI Platform ✅, crons ✅, emails ✅, table `ai_reports` | Bilan hebdo automatique + brief pré-session quotidien, in-app + e-mail. Crée le rendez-vous récurrent (rétention). Reports existants à fusionner dans cette chaîne. |
| Déclencheurs de retour push (#4) | ⚪ | **P0** | Push ✅, checklist ✅, streaks | Notifs pré-market, rappel de review, protection de streak — transformer le produit « pull » en produit « push ». |
| Import CSV blindé + fallback démo (#5) | ⚪ | **P0** | Import CSV ✅, données démo | Le premier « wow » ne doit jamais échouer : parsing robuste + bascule automatique sur données démo en cas d'échec. |

### P1 — Fort ROI (ce trimestre)

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| « Coût de mes erreurs » chiffré (#6) | ⚪ | P1 | `mistakeStats` ✅ | Narration mensuelle : « l'overtrading t'a coûté 840 € ce mois-ci ». La preuve de ROI qui justifie 25 €/mois. |
| Verdicts IA sur chaque métrique (#7) | ⚪ | P1 | Analytics ✅, AI Platform ✅ | Une phrase-verdict en clair par métrique — pas de nouvelles métriques, des conclusions. |
| Bloc « Aujourd'hui » sur le dashboard (#8) | ⚪ | P1 | Données existantes | Le dashboard passe de rétroviseur à copilote : règle du jour, checklist, objectif en cours. Quick win. |
| Streak de discipline + checklist poussée (#9) | ⚪ | P1 | Checklist ✅, push ✅ | Rituel quotidien imposé : streak visible + notification pré-market. |
| Sync broker / import auto (#10) | ⚪ | P1 | APIs brokers (externe) | Supprime la friction n°1 (saisie manuelle). Chantier lourd, incontournable pour la rétention. |
| Navigation réduite à 6–7 entrées (#11) | ⚪ | P1 | — | Fusions : Appearance+Settings+Profile→Réglages ; Insights+AiAssistant→Coach IA ; Mistakes+Missed→Discipline ; Seasonality/Calculateur/News→Outils. |
| Écran « plan personnalisé » fin d'onboarding (#12) | ⚪ | P1 | Profil onboarding ✅ | Payoff immédiat du profil collecté. Quick win. |
| ICP resserré prop-firm/discipline (#13) | ⚪ | P1 | Landing ✅ | Message antidouleur tranché (challenge prop-firm) au lieu du positionnement « vitamine ». |
| Free qui fait goûter l'IA — quota (#14) | ⚪ | P1 | Billing ✅, `consume_ai_quota` ✅ | Bascule commerciale : quota IA en Free, jamais un Free sans IA. Fail-open→fail-closed au passage payant. Décision fondateur requise. |
| Analytics en SQL/RPC + pagination (#15) | ⚪ | P1 | Supabase | Agrégats côté DB pour tenir des dizaines de milliers d'utilisateurs (aujourd'hui calcul client). |

### P2 — Important, non urgent

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Objectif visible partout + célébrations (#16) | ⚪ | P2 | Goals ✅ | Progression omniprésente + micro-célébrations aux jalons. |
| Rapport e-mail + carte partageable (#17) | ⚪ | P2 | Weekly Review (#3) | Le rapport devient canal de rétention ET d'acquisition (carte de perf partageable). |
| Micro-feedback discipline à la saisie (#18) | ⚪ | P2 | Moteur discipline ✅ | Le journal « répond » à chaque trade enregistré (respect du plan, streak). |
| Empty states guidés (#19) | ⚪ | P2 | — | Dashboard/journal vides deviennent pédagogiques. Pur front, quick win. |
| Coach IA omniprésent contextuel (#20) | ⚪ | P2 | Coach V1 ✅ | L'assistant flottant devient contextuel à la page (suggestions selon l'écran). |
| Démo sans compte depuis la landing (#21) | ⚪ | P2 | Données démo | Goûter le produit avant signup. |
| Bandeau statut beta sur les tarifs (#22) | ⚪ | P2 | Landing ✅ | Cohérence prix affiché ⇄ produit gratuit : assumer la beta honnêtement. |
| Perf secondaire (#24) | ⚪ | P2 | — | Fonts, images, vendor chunks, prefetch. |

### P3 — Fond & opportuniste

| Fonctionnalité | Statut | Priorité | Dépendances | Description |
| --- | --- | --- | --- | --- |
| Leaked Password Protection (#25) | ⚪ | P3 | Dashboard Supabase (manuel) | Activation manuelle côté Supabase. |
| ESLint warn → error progressif (#26) | ⚪ | P3 | — | Durcissement lint au fil de l'eau. |
| Agents IA secondaires (#27) | ⚪ | P3 | Coach V2, AI Platform ✅ | Performance Analyst, Risk Manager, Psychologist, Pattern Finder — un fichier agent + une server function chacun (extension par plug-in, on ne touche pas au coach). |
| RAG sur le journal (#28) | ⚪ | P3 | Migration `ai_os_foundation`, embeddings | Recherche sémantique dans les notes de trades ; fondation `modules/ai/rag` déjà posée. |
| MCP — outils externes (#29) | ⚪ | P3 | Tool System ✅ | Connexion d'outils externes via MCP ; fondation `modules/ai/mcp` déjà posée. |

---

## 4. Règles de lecture

- **Ordre de bataille** = lots de `ROADMAP.md` §7 : Lot 1 cœur (coach vivant +
  nav) → Lot 2 rendez-vous (proactivité/rétention) → Lot 3 preuve (valeur
  chiffrée) → Lot 4 go-to-market → Lot 5 fond.
- **Go/no-go** (`CLAUDE.md`) : toute fonctionnalité doit servir conversion,
  rétention, valeur perçue, différenciation, churn ou productivité du trader.
- **Zone gelée** : tout ce qui touche Trustpilot est intouchable.
- **Maintenance** : mettre à jour ce fichier à chaque livraison (déplacer la
  ligne, dater l'en-tête). Un statut périmé est pire qu'absent.
