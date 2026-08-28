-- Codes promo gérés par l'application.
--
-- Un code promo = une offre d'abonnement. Il en existe deux usages, dans le
-- même enregistrement ou séparés :
--
--   • `owner_email` — l'accès PERMANENT pour une personne (l'influenceur).
--     Quand cette adresse utilise le code au checkout, l'accès est ouvert en
--     base (`source = 'promo'`) sans passer par Stripe ni demander une carte.
--   • `discount_percent` — la réduction pour sa communauté. Tous les autres
--     utilisateurs du code arrivent sur Stripe Checkout avec un coupon
--     `percent_off` récurrent : on encaisse réellement, à prix réduit.
--
-- Un code sans `owner_email` et sans `discount_percent` est un « invite » :
-- il ouvre l'accès permanent à quiconque le possède, dans la limite de
-- `max_uses`. `uses_count` et `promo_redemptions` tiennent le compte.
--
-- La résolution se fait serveur (service role) au checkout : la table est
-- invisible aux clients, comme `comp_grants`.

-- `source` accepte l'accès ouvert par un code promo.
alter table public.subscriptions
  drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check
  check (source in ('signup', 'trial', 'stripe', 'crypto', 'comp', 'promo'));

create table if not exists public.promo_codes (
  code             text primary key,
  plan             text not null default 'pro_yearly'
                   check (plan in (
                     'pro_monthly', 'pro_yearly',
                     'elite_monthly', 'elite_yearly'
                   )),
  -- L'adresse qui ouvre l'accès permanent. Nulle = code ouvert à tous.
  owner_email      text,
  -- La réduction accordée à la communauté, en pourcentage. Nulle = aucune.
  discount_percent int check (discount_percent is null or discount_percent between 1 and 100),
  active           boolean not null default true,
  expires_at       timestamptz,
  max_uses         int check (max_uses is null or max_uses >= 1),
  uses_count       int not null default 0,
  note             text,
  granted_by       text,
  created_at       timestamptz not null default now()
);

-- Le code est comparé en minuscules partout : « Ami20 » et « ami20 » sont le
-- même code, et un code qui rate à cause d'une majuscule est un code cassé.
create unique index if not exists promo_codes_code_lower_idx
  on public.promo_codes (lower(code));

-- RLS active et AUCUNE politique : la table est invisible aux clients. Seul
-- le rôle de service — le checkout et les points d'entrée admin — la lit.
alter table public.promo_codes enable row level security;

-- Chaque utilisation du code, pour savoir qui l'a utilisé et pouvoir retirer
-- l'accès d'un utilisateur précis sans croiser les sources de paiement.
create table if not exists public.promo_redemptions (
  code       text not null references public.promo_codes (code) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  plan       text not null,
  kind       text not null check (kind in ('owner', 'free', 'discount')),
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.promo_redemptions enable row level security;