-- Licence à vie : comportement RÉEL sur Postgres (migration 20261101120000).

\set ON_ERROR_STOP on

truncate table public.subscriptions cascade;
delete from auth.users;
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lifetime@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'monthly@example.com');

do $$
declare r text;
begin
  -- Un paiement unique pose une licence `lifetime`, active, sans échéance.
  r := public.apply_subscription_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lifetime', 'active', 'stripe',
    null, 'cus_A', null, null, false, now() - interval '1 hour');
  assert r = 'applied', format('licence: attendu applied, obtenu %s', r);
  assert public.effective_tier('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'elite',
         'une licence à vie doit ouvrir le palier le plus haut';

  -- La fin d'un ANCIEN abonnement (événement plus récent, plan free) ne doit
  -- jamais couper la licence : l'écriture est refusée (stale).
  r := public.apply_subscription_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'free', 'expired', 'stripe',
    'sub_old', 'cus_A', null, now() - interval '1 minute', false, now());
  assert r = 'stale', format('rétrogradation: attendu stale, obtenu %s', r);
  assert (select plan from public.subscriptions
           where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'lifetime',
         'la ligne doit rester lifetime';
  assert public.effective_tier('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'elite',
         'la licence doit rester active après la fin de l''ancien abonnement';

  -- Un abonné mensuel actif est CONVERTI en licence (écriture qui pose
  -- lifetime) : elle passe.
  r := public.apply_subscription_event(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pro_monthly', 'active', 'stripe',
    'sub_B', 'cus_B', null, now() + interval '20 days', false, now() - interval '2 hours');
  assert r = 'applied';
  r := public.apply_subscription_event(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lifetime', 'active', 'stripe',
    'sub_B', 'cus_B', null, null, true, now() - interval '1 hour');
  assert r = 'applied', format('conversion: attendu applied, obtenu %s', r);
  assert public.effective_tier('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 'elite',
         'un abonné converti doit garder tout l''accès';

  -- Le remboursement de la licence (et lui seul) retire l'accès.
  assert public.revoke_lifetime_license('cus_A') = 1, 'une licence remboursée doit être retirée';
  assert public.effective_tier('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'free',
         'après remboursement, l''accès payant est retiré';
  assert public.revoke_lifetime_license('cus_inconnu') = 0, 'aucun autre client touché';
end;
$$;
