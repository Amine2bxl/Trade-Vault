-- Trois paliers payants au lieu d'un seul.
--
-- `subscriptions.plan` n'acceptait que `free / pro_monthly / pro_yearly`.
-- L'offre en compte maintenant trois (pro, elite, fund), chacune en mensuel ou
-- annuel. Sans cette contrainte élargie, le webhook Stripe d'un abonné Elite
-- échouerait à l'écriture et l'abonnement payé n'ouvrirait aucun accès.
--
-- Aucune ligne existante ne change de valeur : les plans historiques restent
-- valides, ils sont simplement rejoints par les nouveaux.

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check check (
    plan in (
      'free',
      'pro_monthly', 'pro_yearly',
      'elite_monthly', 'elite_yearly',
      'fund_monthly', 'fund_yearly'
    )
  );
