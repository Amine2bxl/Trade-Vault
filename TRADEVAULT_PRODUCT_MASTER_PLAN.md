# TradeVault — Product Master Plan

> **Internal directive:** TradeVault doesn't just record what you trade. It learns how you trade. Then it helps you trade better.
>
> **Category:** AI Trading Coach / Trading Performance & Discipline Platform.
> **Author:** Product Lead (acting) · **Status:** v1 — analysis of the actual repository, not a wishlist.

---

## 0. TL;DR — the honest read

The brief frames TradeVault as "journal + analytics + chatbot" that needs to grow into a "closed progression system". **That framing undersells what already exists.** The repository already contains most of the pillars you listed as "future": a real AI coach (memory + RAG + agent router + MCP + deterministic fallback), a discipline engine, a pattern-detection subsystem that persists findings and emits **proposals**, a statistically-grounded Monte Carlo (bootstrap, not invented math), prop-firm presets, goals with a 6-month action plan, trading sessions, missed setups, and an automation engine that routes post-trade side effects.

The problem is **not a feature gap. It's an integration gap.** The systems exist as islands. A trade written into the journal does feed automation + discipline + notifications, but the **coaching loop** (before → during → after → daily → weekly) is largely **reactive chat**, not proactive intelligence. That loop — and the navigable "claim → evidence" graph under it — is the entire differentiation, and it is the weakest link.

**Therefore:** the master plan prioritises *wiring what exists into a closed, evidence-backed coaching loop* over *building new analytics pages*.

---

## 1. Product Vision

**One sentence:** TradeVault is the personal intelligence layer that learns how a trader actually trades — and turns that into better decisions, better discipline, and measurable progression.

**The closed loop we are building toward:**

```
DATA → UNDERSTANDING → INSIGHT → ACTION → BEHAVIOR CHANGE → MEASUREMENT → PROGRESSION
```

A single trade should fan out automatically to: Journal → Trade DNA → Analytics → Personal Edge → Discipline → Risk Guard → Jarvis → Objectives → Weekly Review → Monte Carlo → Progression. Today that fan-out is ~40% wired. Closing it is the product.

**Success test (what the trader must feel):**
- "TradeVault understands how I trade."
- "It shows me things I couldn't see alone."
- "It stops me repeating mistakes."
- "It learns with me."
- "After a few months, it knows my trading better than any journal."
- "I don't want to be without it."

---

## 2. Current Product State (audit of the repo)

### 2.1 What exists and is solid
| System | Where | State |
|---|---|---|
| Journal (trades, CSV import, quick edit, screenshots) | `store/trades`, `pages/Journal` | ✅ solid |
| Analytics (20+ metrics: PF, expectancy, Sharpe/Sortino, Kelly, drawdown, consistency) | `utils/tradeCalcs`, `utils/quantStats` | ✅ solid |
| Dashboard (KPIs, Copilot, equity curve, recent) | `pages/Dashboard` | ✅ solid |
| Pre-market checklist + wizard + streak | `pages/Checklist`, `utils/checklistStreak` | ✅ solid (streak card added) |
| Jarvis AI coach (memory, RAG, router, agents, MCP, deterministic fallback) | `modules/ai/**`, `components/jarvis/**` | 🟡 large, partially wired |
| Insight detectors (costliest mistake, overtrading, risk-after-loss, discipline streak, rule-kept) | `jarvis/insights/detectors` | ✅ exists |
| Pattern detection (concentration, after-loss, time-of-day, readiness) + scan + persist + **proposals** | `modules/patterns/**`, `agent_proposals` | 🟡 built, UI thin |
| Discipline engine (checkTrade, day summary, events) | `modules/discipline` | ✅ exists, reactive |
| Monte Carlo (bootstrap, run/compare/scenario/sensitivity, prop firms, goals forecasting) | `modules/probability/**`, `pages/MonteCarlo` | ✅ advanced |
| Missed setups | `missed_opportunities`, `pages/MissedOpportunities` | ✅ exists |
| Goals + 6-month plan (goal_plans) | `pages/Goals`, `modules/probability/goals` | ✅ exists |
| Trading sessions | `trading_sessions` | ✅ exists |
| Economic calendar (Forex Factory) | `modules/economic-calendar` | ✅ exists |
| Automation engine (tradeSaved → side effects) | `modules/automation` | ✅ exists |
| Notifications + push + inbox | `modules/notifications` | ✅ exists |
| Memory (ai_memory, extract/select, RAG) | `modules/ai/memory*` | ✅ exists |
| Recalibration (per-account) | `store/accounts` | 🟡 basic |

### 2.2 What is partial
- **Risk Guard** — exists as rule-checking inside DisciplineEngine, but there is no *behavioural* guard (no "your current behaviour looks like 11 past revenge-trade episodes"), no Recovery Mode.
- **Personal Edge Engine** — Seasonality + Analytics + patterns exist, but there is no unified "edge" surface with confidence tiers and "this is your highest-expectancy setup".
- **Claim → evidence** — detectors produce findings, but the UI does not consistently render "why" (sample size, comparison, deep-link to the trades).
- **Before/after trade** — the trade captures *what happened*, not *what you intended / estimated*.

### 2.3 What is absent (and how important)
- **Broker auto-journal** (Tradovate/Rithmic/NinjaTrader) — absent. Highest-leverage moat, highest effort/risk.
- **Trade DNA / similarity engine** — absent. No "find similar trades".
- **Confidence calibration** — absent (depends on before-trade capture).
- **"What changed?" regime detection** — absent (before/now comparison).
- **Proactive coaching loop** (briefing → trade readiness → live guard → reflection → daily/weekly review) — absent as a *proactive* surface; mostly chat.

---

## 3. Product Pillars

The 14 pillars you listed map to reality as follows (I rename/re-scope two):

1. **Auto-Journal / Broker integration** — keep, but as *later-phase moat*, not P0.
2. **Jarvis — AI Coach** — the *orchestrator*, not a pillar among equals. Elevate.
3. **Discipline OS** — exists; extend with Risk Guard + Recovery Mode.
4. **Personal Edge Engine** — merge Trade DNA + pattern detection + analytics into ONE "edge" concept.
5. **Trade DNA** — merge into Edge Engine (a similarity *view*, not a separate product).
6. **Advanced Analytics** — exists; stop adding metrics, start adding *navigation*.
7. **Monte Carlo / Prop Intelligence** — exists; add "current vs disciplined" comparison (the killer feature).
8. **Missed Setup Analysis** — exists; cross-link with Edge Engine.
9. **Goals & Progression** — exists; wire "goal → evidence" fully.
10. **Psychology / Behaviour** — merge into "behavioural intelligence" (patterns + regimes + calibration).
11. **Personal Playbook** — *rename* to "Personal Playbook" (exists partially as TradingPlan page). Keep, but data-fed.
12. **Knowledge / Memory** — exists (ai_memory); expose as "Memory Timeline".
13. **Premium UX** — cross-cutting; not a pillar.
14. **Live / Proactive Coaching** — the *missing* pillar; this is P1.

**Verdict:** collapse 14 pillars into **5 product pillars** so they actually communicate:
1. **Capture** (Journal + broker + before/after intent)
2. **Understand** (Analytics + Edge Engine + Trade DNA)
3. **Coach** (Jarvis, proactive loop, claim→evidence)
4. **Discipline** (Discipline OS + Risk Guard + Recovery)
5. **Project** (Monte Carlo + Goals + Playbook)

---

## 4. Feature Inventory (existing + proposed, consolidated)

Existing (built): journal, analytics, dashboard, checklist+streak, Jarvis chat, memory, RAG, detectors, patterns, proposals, discipline, Monte Carlo, prop firms, missed setups, goals+plan, sessions, econ calendar, automation, notifications, recalibration, trading plan, reports, seasonality, lot calculator, theme studio.

Proposed (from brief): before/after intent, confidence calibration, Trade DNA similarity, edge engine w/ confidence tiers, playbook, intelligent checklist, discipline OS loop, risk guard (behavioural), recovery mode, Monte Carlo × discipline, counterfactual, "what changed", objectives (data-fed), goal→evidence, weekly evolution, memory timeline, claim→evidence, teach Jarvis, broker integration, missed-setup analysis (extended), journal text intelligence, day/time analysis, account recalibration (full), premium UX, personalization.

---

## 5. Feature Audit & Classification

Legend: **P0** indispensable · **P1** très forte valeur · **P2** important · **P3** nice-to-have · **DEFER** · **REJECT**

### Jarvis & coaching
| Idea | Class | Verdict |
|---|---|---|
| Proactive coaching loop (before/during/after/daily/weekly) | **P0** | *The* differentiator. Wire the reactive parts into one loop. |
| Claim → evidence everywhere | **P0** | Trust. Non-negotiable — no bullshit AI. |
| Jarvis deep-links into filtered views | **P1** | Cheap, huge navigation value. |
| Teach Jarvis (custom definitions) | **DEFER** | Complex, risks corrupting analysis. Revisit after Playbook. |
| Journal text intelligence (NLP on notes) | **DEFER** | High effort, low confidence. Simple keyword/emotion extraction first. |

### Capture
| Idea | Class | Verdict |
|---|---|---|
| Before-trade intent capture (confidence, reason, plan) | **P0** | *Prerequisite* for calibration + counterfactual + decision intelligence. Do it lean. |
| After-trade reflection (respect of plan) | **P1** | Light-touch, paired with intent. |
| Broker auto-journal | **P2→DEFER** | Biggest moat, biggest effort/legal risk. CSV is fine now. |
| Account recalibration (normalized + reversible) | **P3** | Edge case. Current per-account recalibration is enough. Don't build "reversible normalized data" architecture. |

### Intelligence
| Idea | Class | Verdict |
|---|---|---|
| Personal Edge Engine (unified, with confidence tiers) | **P0/P1** | Merge Trade DNA + patterns + analytics. Confidence tiers are mandatory. |
| Trade DNA similarity | **P1** | Valuable, but *build as a view* over existing trades, not a new model. |
| Confidence calibration | **P1 (after intent)** | Excellent, statistically serious, but blocked on before-trade capture. |
| "What changed?" regime detection | **P1** | High perceived intelligence; needs baseline. |
| Counterfactual ("what if") | **P2** | Powerful but must never present as real. Frame as simulation. |
| Day/time analysis | **P2** | Exists partially (Seasonality); add Jarvis deep-links. |

### Discipline
| Idea | Class | Verdict |
|---|---|---|
| Risk Guard (behavioural, "this looks like 11 past episodes") | **P1** | Extend the existing engine. The *pattern-matching* angle is the differentiator. |
| Recovery Mode | **P1** | Good, but must be *suggested*, never forced. Trader stays in control. |
| Intelligent checklist (data → proposal → validation → update) | **P2** | Excellent closed loop; build after Edge Engine + proposals mature. |
| Discipline OS full loop | **P1** | Wire what exists; don't build new pages. |

### Projection / progression
| Idea | Class | Verdict |
|---|---|---|
| Monte Carlo × Discipline (current vs disciplined) | **P1** | The single most compelling "aha" feature. Build now. |
| Objectives (data-fed) + goal→evidence | **P1** | Exists; finish the evidence view. |
| Weekly evolution review | **P1** | Personal, high retention. |
| Memory timeline | **P2** | Nice, cheap once memory is exposed. |
| Personal Playbook (data-fed) | **P2** | Good, but comes after Edge Engine so it's not empty. |

### Rejected / simplified
- **Confidence calibration standalone** → *blocked, not rejected*; fold into "before/after" as the first metric, not a separate page.
- **"Teach Jarvis" custom definitions** → REJECT for now (complex, low value, corrupting). Replace with "confirm/correct a claim", which feeds the same goal cheaply.
- **Full reversible account recalibration architecture** → REJECT (over-engineered). Keep current per-account recalibration.
- **Journal Text Intelligence (full NLP)** → DEFER (simplify to keyword/emotion tags).
- **15th pillar "Premium UX" / "Personalization"** → cross-cutting, not features.

---

## 6. Compound Features (the real moat)

The value is in the *connections*, not the pages. 15 identified:

1. **Broker + Journal + Risk Guard + Jarvis = Automatic Trading Coach** (P2/DEFER — needs broker).
2. **Trade DNA + Edge Engine + Missed Setups + Monte Carlo = Personal Trading Intelligence** (P1).
3. **Goals + Checklist + Discipline + Weekly Review = Trader Progression System** (P1).
4. **Before-intent + After-reflection + Analytics = Decision Intelligence** (P0/P1).
5. **Edge Engine + Confidence tiers + Jarvis = Evidence-backed coaching** (P0).
6. **Patterns + Proposals + Checklist = Self-improving checklist** (P2).
7. **Risk Guard + Pattern matching + Recovery Mode = Behavioural Risk Engine** (P1).
8. **Claim + Evidence + Deep-link = Auditable Jarvis** (P0 — trust foundation).
9. **Memory + Timeline + Weekly Review = Personal progression narrative** (P2).
10. **Monte Carlo + Discipline + Goals = "It's your behaviour, not your edge"** (P1).
11. **Missed Setups + Edge Engine + Jarvis = "How to recognise your A+ setup"** (P1).
12. **Sessions + Day/time + Edge Engine = "When you're sharp"** (P2).
13. **Automation + Discipline + Notifications = Proactive guardrails** (exists, extend).
14. **Playbook + Edge Engine + Jarvis = Personal model of the trader** (P2).
15. **Proposals + Validation + Measurement = Feedback loops that learn** (P1).

---

## 7. User Journeys (to design around)

1. **New trader (0 trades):** onboard → import CSV or log first trade → see dashboard + checklist streak → first Jarvis insight after ~10 trades.
2. **Daily ritual:** pre-market checklist → briefing → trade (intent) → after-trade (reflection) → end-of-day summary.
3. **Struggling trader (drawdown):** Risk Guard triggers → "this looks like 11 past episodes" → Recovery Mode suggested → measure recovery.
4. **Prop-firm candidate:** Monte Carlo with prop presets → "current vs disciplined" → pass-probability → iterate behaviour.

---

## 8–17. Architectures (condensed)

**Jarvis:** keep the router/agent/MCP structure; add a **scheduler/lifecycle** (before-session briefing, after-trade reflection, daily/weekly review) that *reuses the same detectors* and renders **claim→evidence** blocks with deep-links. Jarvis becomes the *interface to navigate TradeVault*, not just a chatbox.

**Data:** single source of truth = `trades` + `trading_sessions` + `missed_opportunities` + `goal_plans` + `ai_memory` + `detected_patterns` + `agent_proposals`. No new tables for Phase 0–1 except `trade_intent` (before-trade capture).

**Analytics/Edge:** one `computeStats` + `computeQuantStats` + a new **Edge Engine** that aggregates setup × condition × time with **confidence tiers** (rename your LOW SAMPLE / EMERGING / SUPPORTED / STRONG → I propose: **insufficient / emerging / supported / established**, tied to explicit minimum n and confidence interval, never a bare win rate).

**Monte Carlo:** keep the bootstrap engine; add a **"current vs disciplined" scenario diff** (two SimDatasets side by side) and a premium multi-trajectory equity-curve view (50→10k, percentile bands, target/DD lines). Model = **bootstrap resampling of actual R-multiples** (honest, no invented distribution).

**Discipline OS:** the loop already has pieces; the missing link is **Risk Guard's behavioural matching** (compare today's trade sequence to historical loss-episode fingerprints) and **Recovery Mode as a *suggestion***.

**Broker:** defer. When ready: webhooks/API (Tradovate, Rithmic, NinjaTrader) → prepopulate trade → trader confirms. Legal: read-only, user-owned credentials, no trade *execution*.

**Memory:** expose ai_memory as a timeline; keep it auditable.

**Personal Trading Intelligence Graph:** the unifying concept. Nodes = trade / setup / mistake / session / pattern / goal / memory; edges = "evidence", "similar to", "led to", "violated". Built *incrementally on top of existing tables*, not as a new database.

---

## 18–22. Cross-cutting

**UX principles:** calm confidence; no decorative animation; zero useless skeleton; every number has a "why". **Mobile:** the coaching loop must be mobile-first (traders live on phones). **Performance:** keep heavy deps code-split (already done). **Security:** user data is financial — never log P&L in cleartext logs, keep RLS, service-role keys server-side. **Privacy/legal:** no broker *execution* (avoids licensing); calibration/counterfactual always labeled as *estimates, not advice*; no performance claims (avoid the "results" trap — already correctly handled).

**Pricing/value:** the moat is the *accumulated personal model* — switching cost grows with time. Justify price via "it knows my trading" — which is exactly what Phase 1–2 build.

---

## 23. Roadmap (recommended — reordered from yours)

| Phase | Theme | Why this order |
|---|---|---|
| **0** | Foundation: wire claim→evidence + deep-links + intent capture | Trust + navigation are prerequisites for everything |
| **1** | Jarvis proactive loop (briefing/reflection/daily/weekly) | The differentiator; reuses existing detectors |
| **2** | Personal Edge Engine + confidence tiers | "Shows me what I can't see" — the core promise |
| **3** | Discipline: Risk Guard (behavioural) + Recovery Mode | Prevents repeat mistakes |
| **4** | Monte Carlo × Discipline + multi-scenario | The "aha" that justifies price |
| **5** | Personal Playbook + Memory timeline | Data-fed, arrives when Edge is mature |
| **6** | Broker auto-journal | Moat, but only after the loop is proven |
| **7** | Advanced behavioural (calibration, "what changed", counterfactual) | Requires history + intent |
| **8** | Premium UX / mobile / app-native | Polish on a proven loop |

*(I moved Broker to Phase 6 — your Phase 5 — because the proactive loop proves value *before* you invest in the riskiest integration. I moved calibration/"what changed" to Phase 7 because they need before-trade intent history first.)*

---

## 24. Definition of Done

A feature is **done** when: (1) it ships behind the existing design system, (2) every AI claim renders its **evidence + deep-link**, (3) it is **statistically honest** (no conclusion on thin samples), (4) it works on **mobile**, (5) it has **no new skeleton/decorative animation**, (6) tests cover the deterministic path (detectors, math, streak).

---

## A–G. The answers you asked for

*(See the chat response for the full A–G summary.)*
