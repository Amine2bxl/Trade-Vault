# Index des features

Pour chaque feature : où elle vit, son point d'entrée, ses dépendances
importantes. Les écrans sont déclarés dans `PAGES` / `SECTIONS`
(`src/app/types.ts`) et chargés par `src/app/shell/pageModules.ts`.

Chemins relatifs à `src/app/` sauf mention contraire.

## App connectée — par section de navigation

| Feature (`page`) | Dossier | Entrée | Dépendances importantes |
| --- | --- | --- | --- |
| Dashboard (`dashboard`) | `features/dashboard/` | `Dashboard.tsx` | `CopilotBlock`, `edgeHistory`, `trading/EquityChart`, `trading/useEdgeScore`, `domain/edgeScore` |
| Checklist pré-market (`checklist`) | `features/checklist/` | `Checklist.tsx` | `ChecklistWizard`, `checklistDefaults`, `checklistStreak`, `voice` (lignes parlées), `jarvis/jarvisVoice`, `profiles.checklist_config` |
| Calculateur de position (`calculator`) | `features/calculator/` | `LotSizeCalculator.tsx` | `trading/positionCalc`, `utils/userPrefs` |
| Calendrier économique (`news`) | `features/news/` | `EconomicNews.tsx` | `useEconomicCalendar`, `economicEvents`, `modules/economic-calendar`, `backend/economic-calendar.*` |
| Journal (`journal`) | `features/journal/` | `Journal.tsx` | `TradeModal` (saisie), `TradeDetailModal`, `ImportCsvModal` + `csvImport`, `exportCsv`, `useTradeFilter` + `deepLink`, `trading/tradeFilter`, `store/trades` |
| Calendrier P&L (`calendar`) | `features/calendar/` | `CalendarPage.tsx` | `WeekDetailModal`, `calendarGrid`, `calendarTone`, `hooks/useAvailableHeight` |
| Erreurs (`mistakes`) | `features/mistakes/` | `Mistakes.tsx` | `mistakePlan`, `trading/mistakeClusters`, `domain/behavioral`, `goals/useGoalProgress` |
| Setups manqués (`missed`) | `features/missed/` | `MissedOpportunities.tsx` | `MissedSetupDetailModal`, `store/missed` |
| Analytics (`analytics`) | `features/analytics/` | `Analytics.tsx` | `domain/quantStats`, `domain/tradeCalcs`, `trading/EquityChart`, `trading/chartTheme` |
| Saisonnalité (`seasonality`) | `features/seasonality/` | `Seasonality.tsx` | `SeasonalEquity`, `assetSeasonality`, `seasonalCurve` |
| Rapports (`reports`) | `features/reports/` | `Reports.tsx` | `reportMonths`, `domain/monthlyReport`, `store/reports`, `backend/reports.functions` |
| Monte Carlo (`montecarlo`) | `features/monte-carlo/` | `MonteCarlo.tsx` | `monteCarloEngine`, `monteCarloViz`, `propFirms`, `mistakes/mistakePlan` |
| Jarvis (`insights`) | `features/jarvis/` | `Jarvis.tsx` (page) · `AiAssistant.tsx` (widget) | voir [`AI.md`](AI.md) |
| Plan de trading (`tradingplan`) | `features/trading-plan/` | `TradingPlan.tsx` | `TradingRulesSection`, `trading/tradingPlan`, `trading/tradingRules` |
| Objectifs (`goals`) | `features/goals/` | `Goals.tsx` | `views`, `goalPlan`, `useGoalProgress` (consommé aussi par Mistakes et Jarvis), `modules/probability/goals` |
| Réglages (`settings`, `profile`, `appearance`) | `features/settings/` | `Settings.tsx` · `Profile.tsx` · `Appearance.tsx` | `ThemeSettings`, `ThemeStudioModal`, `PushNotificationSettings`, `RecalibrateAccountModal`, `utils/themes` |
| Abonnement (`subscription`) | `features/billing/` | `Subscription.tsx` | `PricingPlans`, `PlanMatrix`, `PremiumGate`, `UpgradeModal`, codes promo, `domain/plans`, `hooks/useSubscription` |
| Inbox (`inbox`) | `features/inbox/` | `Inbox.tsx` | `NotificationDetailModal`, `notificationMeta`, `useUnreadCount` (badge de la sidebar), `modules/notifications` |

## Hors navigation

| Feature | Dossier | Note |
| --- | --- | --- |
| Onboarding | `features/onboarding/` | Chargé par `shell/App.tsx` au premier lancement |
| Séance de trading | `features/session/SessionPanel.tsx` | Complète mais **montée nulle part** — signalé par `tests/reachability.test.ts` |
| Simulateur de probabilités | `features/simulator/Simulator.tsx` | Page **non montée** (absente de `PAGES`) ; `modules/probability` |
| Cadre de l'app | `shell/` | `App.tsx` (état global, écriture optimiste, bootstrap des moteurs), `navigation.ts`, `Sidebar`, `MobileNav`, `CommandPalette`, `AccountSwitcher` |
| Landing | `public/landing/` | `Landing.tsx`, dictionnaire `i18n.tsx`, `landing.css`, captures `shots.ts` ← `src/assets/product/` |
| Pages publiques | `public/` | `LegalPage` + `legal-content`, `ContactPage` + `contact-content`, `PricingPage`, `LandingDemo` (`/demo`, `/demo-site`) |
| Diagnostic IA | `src/routes/dev.ai.tsx` | Lit `modules/ai/runtime/*` |

## Code partagé entre features

- `app/trading/` : `EquityChart`, `ChartDefs`, `chartTheme`, `tradeFilter`,
  `tradeOrder`, `readiness`, `positionCalc`, `tradingPlan`, `tradingRules`,
  `ruleAdherence`, `accountCalibration`, `mistakeClusters`, hooks `useTrades`,
  `useTradeStats`, `useRealtimeTrades`, `useEdgeScore`, `useTradingRules`.
- `domain/` : `trade` (type `Trade`), `tradeCalcs`, `quantStats`, `edgeScore`,
  `behavioral`, `monthlyReport`, `ruleCheck`, `plans`, `entitlement`, `promo`,
  `ai-limits`.

## Métriques — sources uniques et pièges

Avant de nommer ou d'ajouter une métrique : vérifier que la grandeur n'existe
pas déjà **et** que le nom n'est pas déjà pris ailleurs dans le produit.

**Règle d'échantillon.** Un TOTAL est vrai à toute taille d'échantillon ; un
TAUX ou un CLASSEMENT ne l'est pas. `MIN_BUCKET_SAMPLE` (5 trades décisifs,
`domain/quantStats`) conditionne tout taux et tout superlatif ;
`MIN_KELLY_SAMPLE` (30) le critère de Kelly. Les seuils des motifs vivent dans
`modules/patterns/thresholds.ts`.

| Métrique | Source | Piège |
| --- | --- | --- |
| `winRate` | `domain/tradeCalcs`, `quantStats.winRateOf` | Break-even exclus du dénominateur, partout |
| `ruleAdherence` | `trading/ruleAdherence` (via `domain/ruleCheck`) | La discipline réelle constatée — pas déclarative |
| `cleanJournalScore` | `domain/behavioral` | Charge d'erreurs auto-cochées, **pas** la discipline |
| `executionScore` | `modules/trading/analysis` | Efficacité de sortie (MAE/MFE), rien à voir avec les règles |
| Edge Score | `domain/edgeScore` + `useEdgeScore` | 4 sous-scores pondérés ; consommé par Dashboard et Jarvis |
| Progression des objectifs | `features/goals/useGoalProgress` | Point d'accès unique (Goals, Mistakes, Jarvis) |
| « Violer une règle » | `domain/ruleCheck.checkTradeAgainstRules` | Même vérificateur en temps réel et en bilan 30 j |
| `pnlAfterLoss` | `features/jarvis/behaviorSignals` | Borne haute, pas un surcoût imputable |
| `profitFactor` | `domain/tradeCalcs` | Plafonné à 99 sans perte |

Relation canonique : `pnl = riskAmount × rMultiple` (`domain/tradeCalcs`).
Aucune métrique ne mesure une **causalité** : le produit observe des
associations, jamais des causes.
