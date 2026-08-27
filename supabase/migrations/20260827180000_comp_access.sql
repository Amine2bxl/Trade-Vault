-- Accès offert (« comp ») — donner le premium sans paiement.
--
-- Le propriétaire doit pouvoir ouvrir l'accès complet à un influenceur, à un
-- collègue ou à lui-même, sans passer par Stripe et sans bricoler une ligne à
-- la main en base à chaque fois. Deux mécanismes complémentaires :
--
--  1. `comp_grants` est la LISTE, tenue par adresse e-mail. Elle vaut aussi
--     pour quelqu'un qui n'a pas encore de compte : l'accès s'applique tout
--     seul à son inscription.
--  2. La ligne `subscriptions` correspondante est écrite avec `source='comp'`,
--     donc tout le reste de l'application (paliers, cadenas, page
--     d'abonnement) fonctionne sans savoir que l'accès est offert.
--
-- Révoquer, c'est retirer de la liste : la ligne repasse en `free`. Un accès
-- offert n'a ni client ni abonnement Stripe, donc rien à annuler côté paiement.

-- `source` accepte désormais l'accès offert.
alter table public.subscriptions
  drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check
  check (source in ('trial', 'stripe', 'crypto', 'comp'));

create table if not exists public.comp_grants (
  email       text primary key,
  plan        text not null default 'elite_yearly'
              check (plan in (
                'pro_monthly', 'pro_yearly',
                'elite_monthly', 'elite_yearly',
                'fund_monthly', 'fund_yearly'
              )),
  note        text,
  granted_by  text,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- L'adresse est comparée en minuscules partout : « Ami@x.com » et « ami@x.com »
-- sont la même personne, et une liste d'accès qui rate à cause d'une majuscule
-- est une liste d'accès cassée.
create unique index if not exists comp_grants_email_lower_idx
  on public.comp_grants (lower(email));

-- RLS active et AUCUNE politique : la table est invisible aux clients. Seul le
-- rôle de service (les points d'entrée admin) la lit et l'écrit.
alter table public.comp_grants enable row level security;

-- L'inscription applique un accès offert déjà enregistré pour cette adresse.
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
    insert into public.subscriptions (user_id, plan, status, source, trial_ends_at)
    values (new.id, 'pro_monthly', 'trialing', 'trial', now() + interval '14 days')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
