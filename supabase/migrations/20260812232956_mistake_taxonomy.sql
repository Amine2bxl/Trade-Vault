-- ============ FAMILLES D'ERREURS ============
--
-- `ECOSYSTEM_WIRING.md` Phase 2. Une couche d'INTERPRÉTATION posée sur les
-- douze erreurs existantes, pas un remplacement.
--
-- ── POURQUOI REGROUPER ─────────────────────────────────────────────────────
-- « FOMO entry » et « Chased entry » décrivent le même défaut vu sous deux
-- angles. Comptées séparément, chacune reste sous le seuil où l'on peut dire
-- quoi que ce soit, et le trader ne voit jamais que sa première cause de pertes
-- est l'impatience. Regroupées, la fuite devient visible — et surtout, elle
-- atteint une taille d'échantillon qui autorise à en parler.
--
-- ── CE QUI N'EST PAS FAIT, ET C'EST VOULU ──────────────────────────────────
-- Aucune ligne de `trades` n'est touchée. `trades.mistakes` reste un `text[]`
-- des libellés d'origine. Migrer les données ferait perdre ce que le trader a
-- réellement coché, pour un regroupement qui se calcule à la lecture et qui
-- changera d'avis plus d'une fois. Les tables ci-dessous décrivent, elles ne
-- réécrivent pas.
--
-- ── LES LIBELLÉS SONT DES CLÉS i18n ────────────────────────────────────────
-- `label_key` porte `cluster.fomo`, pas « Impatience ». Dix locales sur douze
-- sont à 26 % de couverture (`GO-LIVE.md` §2.10) : écrire du texte en base
-- garantirait une famille affichée en anglais pour tout le monde, et
-- inchangeable sans migration.
--
-- Additif : deux tables neuves, aucune colonne existante modifiée.

create table if not exists public.mistake_clusters (
  id        text primary key,
  -- Clé i18n, jamais un libellé. Voir l'en-tête.
  label_key text not null,
  -- Gravité relative, utilisée pour trier ce qu'on montre en premier quand
  -- plusieurs familles ressortent. Le risque prime : ne pas mettre de stop est
  -- d'une autre nature qu'une sortie prématurée.
  severity  int not null default 1
);

create table if not exists public.mistake_taxonomy (
  -- Doit correspondre EXACTEMENT à une valeur de `MISTAKE_OPTIONS`
  -- (`src/app/types.ts`). `tests/mistakeClusters.test.ts` compare les deux
  -- listes et échoue si l'une avance sans l'autre.
  mistake    text primary key,
  cluster_id text not null references public.mistake_clusters(id)
);

-- Tables de RÉFÉRENCE, pas de données utilisateur : lisibles par tout compte
-- authentifié, écrites uniquement par le service role. Pas de RLS par
-- propriétaire ici — il n'y a pas de propriétaire.
alter table public.mistake_clusters  enable row level security;
alter table public.mistake_taxonomy  enable row level security;

grant select on public.mistake_clusters to authenticated;
grant select on public.mistake_taxonomy to authenticated;
grant all on public.mistake_clusters to service_role;
grant all on public.mistake_taxonomy to service_role;

drop policy if exists "mistake_clusters_read" on public.mistake_clusters;
create policy "mistake_clusters_read"
  on public.mistake_clusters for select to authenticated using (true);

drop policy if exists "mistake_taxonomy_read" on public.mistake_taxonomy;
create policy "mistake_taxonomy_read"
  on public.mistake_taxonomy for select to authenticated using (true);

-- ── SEED ───────────────────────────────────────────────────────────────────
-- Idempotent : `on conflict do update` pour que corriger une gravité ou une
-- clé i18n plus tard ne demande pas de supprimer d'abord.
insert into public.mistake_clusters (id, label_key, severity) values
  ('fomo',           'cluster.fomo',           3),
  ('plan_violation', 'cluster.planViolation',  3),
  ('risk',           'cluster.risk',           4),
  ('exit',           'cluster.exit',           2)
on conflict (id) do update
  set label_key = excluded.label_key,
      severity  = excluded.severity;

insert into public.mistake_taxonomy (mistake, cluster_id) values
  ('FOMO entry',                'fomo'),
  ('Chased entry',              'fomo'),
  ('Ignored market conditions', 'fomo'),
  ('Ignored plan',              'plan_violation'),
  ('Size too large',            'plan_violation'),
  ('Averaged down',             'plan_violation'),
  ('No stop loss',              'risk'),
  ('Overtrading',               'risk'),
  ('Revenge trade',             'risk'),
  ('Low liquidity',             'risk'),
  ('Premature exit',            'exit'),
  ('Holding too long',          'exit')
on conflict (mistake) do update
  set cluster_id = excluded.cluster_id;

comment on table public.mistake_clusters is
  'Familles d''erreurs (reference). label_key est une cle i18n, jamais un libelle.';
comment on table public.mistake_taxonomy is
  'Correspondance erreur -> famille. Les valeurs de mistake doivent egaler MISTAKE_OPTIONS cote application.';
