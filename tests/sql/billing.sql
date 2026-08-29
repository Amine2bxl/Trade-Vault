-- Comportement RÉEL des fonctions de facturation et de quota, sur Postgres.
--
-- Chaque bloc `do $$ … assert … $$` échoue la transaction — et donc le script,
-- lancé avec `ON_ERROR_STOP=1` — dès qu'une garantie n'est pas tenue. Il n'y a
-- pas de client simulé ici : c'est Postgres qui répond.

\set ON_ERROR_STOP on

-- ════════════════════════════════════════════════════════════════════════════
-- Fixtures
-- ════════════════════════════════════════════════════════════════════════════
truncate table public.promo_redemptions, public.promo_codes,
               public.ai_rate_limits, public.trades, public.accounts,
               public.subscriptions cascade;
delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'influenceur@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'fan1@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'fan2@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'fan3@example.com');

insert into public.promo_codes (code, plan, owner_email, discount_percent, max_uses) values
  ('OWNERCODE', 'elite_yearly', 'influenceur@example.com', 20, null),
  ('LIMITED2',  'pro_yearly',   null,                      null, 2),
  ('DEADCODE',  'pro_yearly',   null,                      null, null),
  ('OLDCODE',   'pro_yearly',   null,                      null, null);

update public.promo_codes set active = false where code = 'DEADCODE';
update public.promo_codes set expires_at = now() - interval '1 day' where code = 'OLDCODE';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. redeem_promo_code
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r text;
begin
  -- Un code valide se consomme une fois et incrémente le compteur.
  r := public.redeem_promo_code('LIMITED2', '22222222-2222-2222-2222-222222222222',
                                'fan1@example.com', 'pro_yearly', 'free');
  assert r = 'redeemed', format('première rédemption: attendu redeemed, obtenu %s', r);
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 1,
         'uses_count doit valoir 1 après une rédemption';

  -- LA MÊME personne qui recommence ne consomme PAS un second usage. C'est le
  -- cas d'un checkout repris après abandon : ce n'est pas un abus.
  r := public.redeem_promo_code('LIMITED2', '22222222-2222-2222-2222-222222222222',
                                'fan1@example.com', 'pro_yearly', 'free');
  assert r = 'already_redeemed', format('rédemption répétée: attendu already_redeemed, obtenu %s', r);
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 1,
         'une rédemption répétée ne doit PAS incrémenter uses_count';

  -- Une seconde personne prend la dernière place.
  r := public.redeem_promo_code('LIMITED2', '33333333-3333-3333-3333-333333333333',
                                'fan2@example.com', 'pro_yearly', 'free');
  assert r = 'redeemed', format('deuxième personne: attendu redeemed, obtenu %s', r);
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 2,
         'uses_count doit valoir 2';

  -- max_uses = 2 : la troisième est refusée. C'est la garantie que le code
  -- applicatif ne tenait pas.
  r := public.redeem_promo_code('LIMITED2', '44444444-4444-4444-4444-444444444444',
                                'fan3@example.com', 'pro_yearly', 'free');
  assert r = 'exhausted', format('max_uses atteint: attendu exhausted, obtenu %s', r);
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 2,
         'un refus ne doit pas incrémenter uses_count';
  assert not exists (select 1 from public.promo_redemptions
                     where code = 'LIMITED2'
                       and user_id = '44444444-4444-4444-4444-444444444444'),
         'un refus ne doit laisser AUCUNE trace de rédemption';
end $$;

do $$
declare r text;
begin
  -- Code désactivé, code expiré, code inconnu : trois refus distincts et nommés.
  r := public.redeem_promo_code('DEADCODE', '22222222-2222-2222-2222-222222222222',
                                'fan1@example.com', 'pro_yearly', 'free');
  assert r = 'inactive', format('code désactivé: attendu inactive, obtenu %s', r);

  r := public.redeem_promo_code('OLDCODE', '22222222-2222-2222-2222-222222222222',
                                'fan1@example.com', 'pro_yearly', 'free');
  assert r = 'expired', format('code expiré: attendu expired, obtenu %s', r);

  r := public.redeem_promo_code('NOPE', '22222222-2222-2222-2222-222222222222',
                                'fan1@example.com', 'pro_yearly', 'free');
  assert r = 'unknown', format('code inconnu: attendu unknown, obtenu %s', r);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. release_promo_redemption — le checkout à prix réduit qui échoue
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare released boolean; r text;
begin
  released := public.release_promo_redemption('LIMITED2', '33333333-3333-3333-3333-333333333333');
  assert released, 'rendre une rédemption existante doit renvoyer true';
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 1,
         'rendre une rédemption doit DÉCRÉMENTER uses_count — sinon révoquer un accès rendrait le code inutilisable à jamais';

  -- La place rendue est réellement reprenable.
  r := public.redeem_promo_code('LIMITED2', '44444444-4444-4444-4444-444444444444',
                                'fan3@example.com', 'pro_yearly', 'free');
  assert r = 'redeemed', format('la place rendue doit être reprenable, obtenu %s', r);

  -- Rendre deux fois ne descend pas sous zéro et ne ment pas sur le résultat.
  released := public.release_promo_redemption('LIMITED2', '33333333-3333-3333-3333-333333333333');
  assert not released, 'rendre une rédemption absente doit renvoyer false';
  assert (select uses_count from public.promo_codes where code = 'LIMITED2') = 2,
         'un release à vide ne doit pas toucher au compteur';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. apply_subscription_event — idempotence et ordre
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r text;
begin
  -- LA LIGNE N'EXISTE PAS. C'est le cas qui perdait un paiement : un `update`
  -- ne touchait aucune ligne, ne renvoyait aucune erreur, et le webhook
  -- répondait 200.
  assert not exists (select 1 from public.subscriptions
                     where user_id = '22222222-2222-2222-2222-222222222222'),
         'préalable: aucune ligne d''abonnement';

  r := public.apply_subscription_event(
    '22222222-2222-2222-2222-222222222222', 'pro_monthly', 'active', 'stripe',
    'sub_123', 'cus_123', null,
    now() + interval '30 days', false, now());
  assert r = 'applied', format('création: attendu applied, obtenu %s', r);
  assert (select plan from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'pro_monthly',
         'la ligne doit avoir été CRÉÉE par le webhook';
end $$;

do $$
declare r text; before_updated timestamptz;
begin
  select updated_at into before_updated from public.subscriptions
   where user_id = '22222222-2222-2222-2222-222222222222';

  -- Rejeu à l'identique : même événement, même horodatage. Doit être accepté
  -- (idempotent) et laisser exactement le même état.
  r := public.apply_subscription_event(
    '22222222-2222-2222-2222-222222222222', 'pro_monthly', 'active', 'stripe',
    'sub_123', 'cus_123', null,
    (select current_period_end from public.subscriptions
      where user_id = '22222222-2222-2222-2222-222222222222'),
    false,
    (select provider_event_at from public.subscriptions
      where user_id = '22222222-2222-2222-2222-222222222222'));
  assert r = 'applied', format('rejeu identique: attendu applied, obtenu %s', r);
  assert (select plan from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'pro_monthly',
         'un rejeu ne doit rien changer à l''état';
end $$;

do $$
declare r text;
begin
  -- Un événement PLUS ANCIEN arrive après un plus récent : il doit être ignoré.
  -- Sans cette garde, un `subscription.updated` retardé rouvrait un accès
  -- résilié par un `subscription.deleted` déjà appliqué.
  r := public.apply_subscription_event(
    '22222222-2222-2222-2222-222222222222', 'free', 'expired', 'stripe',
    'sub_123', 'cus_123', null, null, false, now() - interval '10 days');
  assert r = 'stale', format('événement hors ordre: attendu stale, obtenu %s', r);
  assert (select status from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'active',
         'un événement périmé ne doit PAS faire régresser l''état';
end $$;

do $$
declare r text;
begin
  -- Un événement plus récent, lui, s'applique.
  r := public.apply_subscription_event(
    '22222222-2222-2222-2222-222222222222', 'free', 'expired', 'stripe',
    'sub_123', 'cus_123', null, null, false, now() + interval '1 second');
  assert r = 'applied', format('événement récent: attendu applied, obtenu %s', r);
  assert (select status from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'expired',
         'un événement récent doit s''appliquer';
end $$;

do $$
declare r text;
begin
  -- `coalesce` : un événement qui ne porte pas l'identifiant Stripe ne doit pas
  -- effacer celui déjà connu — le portail de facturation en dépend.
  r := public.apply_subscription_event(
    '22222222-2222-2222-2222-222222222222', 'pro_monthly', 'active', 'crypto',
    null, null, 'charge_abc',
    now() + interval '31 days', false, now() + interval '2 seconds');
  assert r = 'applied', format('attendu applied, obtenu %s', r);
  assert (select stripe_customer_id from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'cus_123',
         'un événement sans identifiant Stripe ne doit pas effacer celui en base';
  assert (select crypto_charge_id from public.subscriptions
          where user_id = '22222222-2222-2222-2222-222222222222') = 'charge_abc',
         'la charge crypto doit être enregistrée — c''est la clé d''idempotence du crédit';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. effective_tier — le miroir SQL de domain/entitlement.ts
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  -- Crypto échu : plus aucun accès. C'est le P0 de l'audit.
  update public.subscriptions
     set plan = 'pro_monthly', status = 'active', source = 'crypto',
         current_period_end = now() - interval '1 day'
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'free',
         'une période crypto écoulée ne doit plus donner Pro';

  -- Crypto en cours : accès ouvert, au bon palier.
  update public.subscriptions
     set current_period_end = now() + interval '1 day'
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'pro',
         'une période crypto en cours doit donner Pro';

  -- Stripe échu d'un jour : le délai de grâce de trois jours protège l'abonné.
  update public.subscriptions
     set source = 'stripe', current_period_end = now() - interval '1 day'
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'pro',
         'le délai de grâce Stripe doit couvrir un webhook en retard';

  -- Stripe échu de dix jours : au-delà du délai, l'accès se ferme.
  update public.subscriptions
     set current_period_end = now() - interval '10 days'
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'free',
         'le délai de grâce est fini, pas infini';

  -- Comp échu : aucun délai de grâce, l'accès offert s'arrête à sa date.
  update public.subscriptions
     set source = 'comp', plan = 'elite_yearly',
         current_period_end = now() - interval '1 hour'
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'free',
         'un accès offert échu ne doit plus rien ouvrir';

  -- Promo permanent : aucune date, accès ouvert.
  update public.subscriptions
     set source = 'promo', plan = 'elite_yearly', current_period_end = null
   where user_id = '22222222-2222-2222-2222-222222222222';
  assert public.effective_tier('22222222-2222-2222-2222-222222222222') = 'elite',
         'un accès promo permanent doit rester ouvert';

  -- Aucune ligne du tout = gratuit.
  assert public.effective_tier('11111111-1111-1111-1111-111111111111') = 'free',
         'sans ligne d''abonnement, le palier est free';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Quota de trades — la limite Free, tenue par la BASE
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare i int; failed boolean := false;
begin
  -- Compte gratuit : aucune ligne d'abonnement.
  delete from public.subscriptions where user_id = '33333333-3333-3333-3333-333333333333';

  for i in 1..10 loop
    insert into public.trades (id, user_id, trade_date)
    values ('t' || i, '33333333-3333-3333-3333-333333333333', date '2026-08-10');
  end loop;
  assert (select count(*) from public.trades
          where user_id = '33333333-3333-3333-3333-333333333333') = 10,
         'les dix premiers trades du mois doivent passer';

  begin
    insert into public.trades (id, user_id, trade_date)
    values ('t11', '33333333-3333-3333-3333-333333333333', date '2026-08-11');
  exception when others then
    failed := true;
    assert sqlerrm like 'PLAN_LIMIT_TRADES%', format('mauvaise erreur: %s', sqlerrm);
  end;
  assert failed, 'le onzième trade du mois doit être REFUSÉ par la base, pas seulement par React';
end $$;

do $$
declare failed boolean := false;
begin
  -- ANTIDATER NE CONTOURNE PLUS RIEN dans le mois courant : la limite porte sur
  -- le mois du trade, exactement comme le compteur affiché.
  begin
    insert into public.trades (id, user_id, trade_date)
    values ('t12', '33333333-3333-3333-3333-333333333333', date '2026-08-01');
  exception when others then failed := true;
  end;
  assert failed, 'antidater dans le MÊME mois ne doit pas contourner la limite';

  -- Un AUTRE mois a son propre quota — la limite est mensuelle, pas totale.
  insert into public.trades (id, user_id, trade_date)
  values ('t13', '33333333-3333-3333-3333-333333333333', date '2026-07-15');
  assert exists (select 1 from public.trades where id = 't13'),
         'un trade sur un autre mois doit passer';
end $$;

do $$
begin
  -- MODIFIER un trade existant reste possible à la limite : la limite porte sur
  -- les créations. L'application écrit par UPSERT, donc ce déclencheur
  -- `before insert` se déclenche aussi sur une modification.
  insert into public.trades (id, user_id, trade_date, pnl)
  values ('t1', '33333333-3333-3333-3333-333333333333', date '2026-08-10', 42)
  on conflict (id) do update set pnl = excluded.pnl;
  assert (select pnl from public.trades where id = 't1') = 42,
         'corriger un trade déjà saisi ne doit JAMAIS être bloqué par la limite d''offre';
end $$;

do $$
declare i int;
begin
  -- Un compte Pro n'a pas de limite mensuelle.
  insert into public.subscriptions (user_id, plan, status, source, current_period_end)
  values ('44444444-4444-4444-4444-444444444444', 'pro_monthly', 'active', 'stripe',
          now() + interval '30 days');
  for i in 1..25 loop
    insert into public.trades (id, user_id, trade_date)
    values ('p' || i, '44444444-4444-4444-4444-444444444444', date '2026-08-10');
  end loop;
  assert (select count(*) from public.trades
          where user_id = '44444444-4444-4444-4444-444444444444') = 25,
         'un compte Pro ne doit pas être plafonné à dix trades';
end $$;

do $$
declare failed boolean := false;
begin
  -- Un abonnement Pro ÉCHU retombe sous la limite gratuite : c'est le même
  -- prédicat d'entitlement qui décide, pas le nom du plan.
  update public.subscriptions
     set source = 'crypto', current_period_end = now() - interval '1 day'
   where user_id = '44444444-4444-4444-4444-444444444444';
  begin
    insert into public.trades (id, user_id, trade_date)
    values ('p99', '44444444-4444-4444-4444-444444444444', date '2026-08-10');
  exception when others then failed := true;
  end;
  assert failed, 'un abonnement échu doit retomber sur la limite gratuite';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Quota de comptes de trading
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare failed boolean := false;
begin
  -- Gratuit : un seul compte.
  insert into public.accounts (user_id, name) values ('33333333-3333-3333-3333-333333333333', 'Principal');
  begin
    insert into public.accounts (user_id, name) values ('33333333-3333-3333-3333-333333333333', 'Second');
  exception when others then
    failed := true;
    assert sqlerrm like 'PLAN_LIMIT_ACCOUNTS%', format('mauvaise erreur: %s', sqlerrm);
  end;
  assert failed, 'un compte gratuit ne doit pas pouvoir créer un second compte de trading';
end $$;

do $$
declare failed boolean := false; i int;
begin
  -- Pro : trois comptes, pas quatre.
  update public.subscriptions
     set source = 'stripe', current_period_end = now() + interval '30 days'
   where user_id = '44444444-4444-4444-4444-444444444444';
  for i in 1..3 loop
    insert into public.accounts (user_id, name)
    values ('44444444-4444-4444-4444-444444444444', 'Compte ' || i);
  end loop;
  begin
    insert into public.accounts (user_id, name)
    values ('44444444-4444-4444-4444-444444444444', 'Quatrième');
  exception when others then failed := true;
  end;
  assert failed, 'le palier Pro s''arrête à trois comptes';
end $$;

do $$
declare i int;
begin
  -- Elite : aucune limite.
  update public.subscriptions set plan = 'elite_yearly'
   where user_id = '44444444-4444-4444-4444-444444444444';
  for i in 4..8 loop
    insert into public.accounts (user_id, name)
    values ('44444444-4444-4444-4444-444444444444', 'Compte ' || i);
  end loop;
  assert (select count(*) from public.accounts
          where user_id = '44444444-4444-4444-4444-444444444444') = 8,
         'le palier Elite ne doit pas être plafonné';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Compteurs IA par portée — horaire et quotidien ne se marchent pas dessus
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare ok boolean; i int;
begin
  perform set_config('tv.uid', '11111111-1111-1111-1111-111111111111', false);

  -- Trois appels sur la portée quotidienne, limite 3.
  for i in 1..3 loop
    ok := public.consume_ai_quota_scoped('daily', 3, 86400);
    assert ok, format('appel %s sur 3 doit passer', i);
  end loop;
  ok := public.consume_ai_quota_scoped('daily', 3, 86400);
  assert not ok, 'le quatrième appel du jour doit être refusé';

  -- La portée HORAIRE est un compteur SÉPARÉ : elle doit être intacte. C'est
  -- exactement ce qu'une clé primaire `(user_id, window_start)` sans portée
  -- rendait impossible — les deux fenêtres tombent sur le même instant à
  -- minuit UTC et se seraient épuisées mutuellement.
  ok := public.consume_ai_quota_scoped('hourly', 60, 3600);
  assert ok, 'le compteur horaire ne doit pas avoir été consommé par le compteur quotidien';
  assert (select count(*) from public.ai_rate_limits
          where user_id = '11111111-1111-1111-1111-111111111111') = 2,
         'deux portées = deux lignes distinctes';
end $$;

do $$
declare ok boolean;
begin
  -- L'ancienne signature délègue bien sur la portée horaire.
  perform set_config('tv.uid', '22222222-2222-2222-2222-222222222222', false);
  ok := public.consume_ai_quota(1, 3600);
  assert ok, 'premier appel autorisé';
  ok := public.consume_ai_quota(1, 3600);
  assert not ok, 'second appel au-delà de la limite refusé';
  assert (select scope from public.ai_rate_limits
          where user_id = '22222222-2222-2222-2222-222222222222') = 'hourly',
         'la signature historique doit écrire sur la portée horaire';
end $$;

do $$
declare ok boolean;
begin
  -- Sans utilisateur, la fonction ne gate rien (ce n'est pas son rôle) et
  -- surtout n'écrit aucune ligne orpheline.
  perform set_config('tv.uid', '', false);
  ok := public.consume_ai_quota_scoped('daily', 1, 86400);
  assert ok, 'sans utilisateur authentifié, la fonction laisse passer';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. find_user_id_by_email
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  assert public.find_user_id_by_email('FAN1@EXAMPLE.COM')
         = '22222222-2222-2222-2222-222222222222',
         'la recherche doit être insensible à la casse';
  assert public.find_user_id_by_email('inconnu@example.com') is null,
         'une adresse inconnue rend null';
end $$;

select 'ALL SQL BILLING ASSERTIONS PASSED' as result;
