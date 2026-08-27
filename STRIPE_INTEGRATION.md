# STRIPE_INTEGRATION.md

Spec for Claude Code. Audited 2026-08-12 against the live Stripe account and the
repo at `main`. Every item below was verified in the dashboard or in the source —
nothing here is assumed. Items marked **[DECISION]** need the owner's answer
before you touch code.

## 0. Non-negotiables

- **Never write a secret value.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_*` are set by the owner in Vercel. Reference them by name only.
  If a value is missing, fail loudly at startup — do not invent a fallback.
- **Do not run migrations against production.** Write the migration file, let CI
  and the Supabase preview branch validate it.
- **Test mode first.** No change ships to live until the full purchase path has
  been walked in test mode.

## 1. Current state (verified)

Stripe account is in **live mode**, EUR. Le catalogue applicatif compte
**deux offres payantes** (plus l'offre gratuite) (`src/domain/plans.ts`, source unique lue
par l'app, la landing, Stripe et le paiement crypto) :

| Offre | Mensuel | Annuel | Variables d'environnement |
|---|---|---|---|
| Pro | 15 € | 120 € (4 mois offerts) | `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY` |
| Elite | 25 € | 200 € (4 mois offerts) | `STRIPE_PRICE_ELITE_MONTHLY` / `STRIPE_PRICE_ELITE_YEARLY` |

Le nom de la variable est dérivé de l'identifiant du plan
(`STRIPE_PRICE_${PLAN.toUpperCase()}`) : ajouter un palier au catalogue ne
demande aucune modification du code de facturation, seulement la variable
correspondante. Les anciens prix (19 € / 199 €) ne sont plus référencés nulle
part dans le code.

| Area | State |
|---|---|
| Webhook endpoint | **None configured.** Zero destinations. |
| Product/prices | OK — 1 product, 2 prices |
| Customer portal | Enabled; ToS + Privacy links **empty** |
| Stripe Tax | Not enabled; no `automatic_tax` in checkout params |
| Code | `src/backend/billing.server.ts` complete but untested end-to-end |
| DB | `public.subscriptions` + `processed_webhook_events` exist, RLS select-own |

## 2. [DECISION] The trial model contradicts itself

This is the most important item in this document. Fix it before anything else.

**What the code does today.** `supabase/migrations/20260717100000_billing.sql`
creates a trigger `handle_new_user_billing` that gives every new signup:

```
plan = 'pro_monthly', status = 'trialing', trial_ends_at = now() + 14 days
```

No card. Full Pro for 14 days, granted at signup. `handleCheckout` then carries
the *remaining* trial into Stripe via `subscription_data[trial_end]`.

**What the owner specified.** A **7-day trial that requires a card up front.**

These are incompatible. A card-required trial means the trial lives in Stripe,
starts at checkout, and users who never check out get nothing.

**Target design (implement this unless told otherwise):**

1. Signup trigger inserts `plan='free', status='canceled', source='trial',
   trial_ends_at=null`. New users are on the free tier, full stop.
2. Checkout passes `subscription_data[trial_period_days]=7`. Stripe collects and
   validates the card, charges nothing for 7 days.
3. Delete the `trial_end` carry-over branch in `handleCheckout` — it becomes
   dead code and would double-apply a trial.
4. Backfill: existing `trialing` rows keep their current `trial_ends_at` so no
   one loses access mid-trial. Do not retroactively downgrade anyone.
5. `AI_REQUIRE_PRO` stays `false` until this ships, then flips to `true`.

Note the gating consequence: today every signup silently gets Pro. After this
change the free tier must actually be usable, or signups hit a wall. Confirm the
free-tier feature set before shipping.

## 3. Bug: webhook idempotency loses events

`markWebhookProcessed` inserts `(provider, event_id)` **before** the state change
runs. If the handler then throws, the function returns 500, Stripe retries — and
the retry is deduped as "already processed". The subscription update is lost
permanently, with no error surfaced to anyone.

The window is small but the failure is silent and unrecoverable, which is the
worst combination for billing.

**Fix:** on handler failure, delete the idempotency row before returning 500, so
Stripe's retry can do real work. Keep the fail-open behaviour of the insert
itself — that part is correct.

```ts
try {
  // ... existing subscription projection
} catch (e) {
  await sb.from("processed_webhook_events")
    .delete().eq("provider", "stripe").eq("event_id", event.id);
  console.error("stripe webhook failed", e);
  return json({ error: "handler failed" }, 500);
}
```

## 4. Bug: `ensureCustomer` can silently create duplicate customers

`ensureCustomer` persists the new Stripe customer id with `.update()` on
`subscriptions`. If no row exists for that user — trigger failed, user predates
the migration, row deleted — the update matches zero rows, returns no error, and
the id is never stored. The next checkout creates *another* Stripe customer.

Result: one human, several Stripe customers, split billing history, and a portal
session that shows the wrong subscription.

**Fix:** use `upsert` on `user_id`, and assert the write affected one row.

## 5. Missing: VAT

Checkout is created with no `automatic_tax`. The business is in Belgium selling a
digital service to EU consumers, so VAT is owed at the **buyer's** rate, not the
Belgian one, and reported through OSS.

Implementation once the owner enables Stripe Tax in the dashboard:

```
automatic_tax[enabled]=true
customer_update[address]=auto
customer_update[name]=auto
```

Also set `tax_behavior` on both prices. For B2C, `inclusive` is usually what you
want — 19 € stays 19 € on the card statement and VAT is carved out of it.
`exclusive` would add VAT on top, so the French buyer pays 22,80 €.

**[DECISION]** inclusive or exclusive. This changes displayed pricing.

Flag to the owner: this is a tax matter, not an engineering one. It should be
confirmed with an accountant, and this file is not tax advice.

## 6. Missing webhook events

Currently handled: `customer.subscription.created|updated|deleted`. That covers
the core lifecycle correctly, including `past_due` via `updated`.

Add:

- **`customer.subscription.trial_will_end`** — fires 3 days before the trial
  ends. With a 7-day card-required trial this is the single most important event
  for avoiding disputes. Wire it to the existing Resend lifecycle-email path and
  the `email_log` dedupe table (`email_key = 'trial_ending'`).
- **`invoice.payment_failed`** — for the dunning email. Status already flips via
  `subscription.updated`, so this is notification only, not state.

## 6bis. Accès offert (influenceurs, collègues, soi-même)

Donner le premium sans paiement passe par `ADMIN_EMAILS` (variable Vercel,
liste d'adresses séparées par des virgules) et le panneau « Accès offert » qui
apparaît alors dans Réglages → Abonnement.

- La liste est tenue par adresse e-mail dans `public.comp_grants`. Elle vaut
  aussi pour quelqu'un qui n'a pas encore de compte : l'accès s'applique à son
  inscription, via `handle_new_user_billing`.
- L'abonnement écrit porte `source = 'comp'` : tout le reste de l'application
  (paliers, cadenas, page d'abonnement) fonctionne sans savoir que l'accès est
  offert, et aucun client Stripe n'est créé.
- Révoquer retire de la liste et repasse la ligne en `free` — **uniquement** si
  sa source est `comp`, pour ne jamais couper un abonnement réellement payé.
- `comp_grants` a RLS active et aucune politique : la table est invisible aux
  clients, seul le rôle de service y touche. Le panneau masqué n'est pas le
  contrôle d'accès — chaque appel revérifie `ADMIN_EMAILS` côté serveur.

## 7. Owner tasks — dashboard only, cannot be done in code

Give this list to the owner verbatim.

1. **Create the webhook endpoint.** URL `https://tradevault.be/api/stripe/webhook`,
   events: the five listed above. Copy the signing secret into Vercel as
   `STRIPE_WEBHOOK_SECRET`. Do this in **test mode first**, then live.
2. **Créer trois produits** (Pro, Elite, Fund) avec chacun un prix mensuel et un
   prix annuel, aux montants du tableau §1, puis copier les six identifiants
   `price_...` dans Vercel sous les six noms de variables listés. Un plan dont
   la variable manque renvoie « price not configured » au checkout — c'est
   volontaire : mieux vaut un échec visible qu'un encaissement au mauvais prix.
3. **Publish ToS and Privacy pages** on tradevault.be, then declare them in
   Stripe → Public business information. They render on Checkout and the portal.
4. **Enable Stripe Tax** and register for OSS.
5. **Enable the trial-ending reminder email** in Stripe's subscription settings.
6. **Définir `ADMIN_EMAILS`** dans Vercel avec ta propre adresse, pour voir le
   panneau « Accès offert » (§6bis).
7. **Checkout branding**: button colour `#2563EB`, font `Inter` (Manrope is not
   in Stripe's font list; Inter is already the app's fallback), upload the logo
   and the square icon.

## 8. Verification checklist — nothing is "done" until this passes

Run in **test mode** with `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

- [ ] Monthly checkout with `4242 4242 4242 4242` → `subscriptions` row becomes
      `plan=pro_monthly, status=trialing`, `stripe_customer_id` and
      `stripe_subscription_id` both populated
- [ ] Card `4000 0000 0000 3220` (3DS) completes the challenge
- [ ] Card `4000 0000 0000 0341` (attaches then fails) → status reaches `past_due`
- [ ] Yearly checkout → `plan=pro_yearly`
- [ ] **Replay a delivered event** from the dashboard → response contains
      `deduped: true`, and the row is unchanged
- [ ] **Force the handler to throw, then replay** → the retry must actually
      apply the change (this is the §3 regression test)
- [ ] Trial: advance the test clock past 7 days → `status=active`, invoice paid
- [ ] Cancel via portal → `cancel_at_period_end=true`, access retained until
      `current_period_end`
- [ ] After period end → `plan=free, status=expired`, Pro features gated
- [ ] Monthly → yearly switch in the portal → proration applied, single customer
- [ ] Second checkout by the same user does **not** create a second Stripe customer
- [ ] Webhook called with a bad signature → 400, no DB write
- [ ] Same test with a stale timestamp (>5 min) → 400 (replay protection)

## 9. Out of scope

Coinbase Commerce (`crypto-pay.server.ts`) is wired but not covered here. Audit
it separately — it shares `markWebhookProcessed`, so the §3 fix applies to it too.
