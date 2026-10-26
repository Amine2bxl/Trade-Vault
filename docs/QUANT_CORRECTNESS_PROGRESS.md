# TradeVault quantitative transformation — execution register

Baseline: `079d185f8e1917ca1ef48321f3e1697064db40ba`. Branch: `feat/quant-correctness-lot0`.

## Lot 0 — Quantitative Correctness: IN PROGRESS

- [x] Confirm tri-state ambiguity in historical adherence.
- [x] Add explicit PASS/FAIL/UNKNOWN for rule evaluation.
- [x] Exclude UNKNOWN from adherence rate and report sample coverage.
- [x] Reject ambiguous same-minute/missing-time ordering for cumulative rules.
- [x] Add tests for future-trade leakage, ties, missing risk and timestamps.
- [ ] Verify this patch in GitHub CI.
- [ ] Propagate unknown counts and coverage to all interfaces/Jarvis.
- [ ] Correct risk historical balance assumptions.
- [ ] Correct Average R, Profit Factor and all downstream consumers.
- [ ] Replace fictitious import defaults with provenance-aware missing values.
- [ ] Fix all affected drawdown chronology, macro events and session timezones.
- [ ] Finish full reference tests, integration tests and regression review.

Do not mark lot 0 DONE or start lot 1 until every applicable gate has been verified.
Do not merge to main without an explicit approval.
