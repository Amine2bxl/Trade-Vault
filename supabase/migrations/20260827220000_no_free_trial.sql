-- Fin de l'essai gratuit automatique.
--
-- Chaque inscription ouvrait 14 jours de Pro sans carte. Tant que ce
-- déclencheur existe, un nouveau compte ne voit jamais le mur d'aperçu : il
-- découvre le produit payant, s'y habitue, puis perd l'accès — et la
-- monétisation ne démarre qu'au quinzième jour.
--
-- Désormais une inscription démarre sur l'offre GRATUITE, qui est utilisable
-- indéfiniment (journal, tableau de bord, calendrier, checklist, plan,
-- calculateur). L'accès payant s'ouvre au paiement, immédiatement.
--
-- Les accès offerts (`comp_grants`) continuent de s'appliquer à l'inscription :
-- c'est le seul chemin qui donne le premium sans payer.
--
-- AUCUNE LIGNE EXISTANTE N'EST TOUCHÉE. Un essai en cours va jusqu'à son terme :
-- couper l'accès de quelqu'un pendant qu'il l'utilise se voit comme une panne,
-- pas comme une décision commerciale.

-- `source` distingue désormais une inscription ordinaire d'un essai.
alter table public.subscriptions
  drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check
  check (source in ('signup', 'trial', 'stripe', 'crypto', 'comp'));

create or replace function public.handle_new_user_billing()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  granted public.comp_grants%rowtype;
begin
  select * into granted
  from public.comp_grants
  where lower(email) = lower(new.email)
    and (expires_at is null or expires_at > now())
  limit 1;

  if found then
    insert into public.subscriptions (user_id, plan, status, source, current_period_end)
    values (new.id, granted.plan, 'active', 'comp', granted.expires_at)
    on conflict (user_id) do update
      set plan = excluded.plan,
          status = 'active',
          source = 'comp',
          current_period_end = excluded.current_period_end;
  else
    -- Offre gratuite, sans date de fin. `canceled` est le statut « aucun
    -- abonnement en cours » : il n'ouvre aucun accès payant, et il ne prétend
    -- pas qu'un essai a expiré alors qu'il n'y en a jamais eu.
    insert into public.subscriptions (user_id, plan, status, source, trial_ends_at)
    values (new.id, 'free', 'canceled', 'signup', null)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
