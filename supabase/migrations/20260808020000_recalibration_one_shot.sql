-- ============ RECALIBRAGE : CONVERSION UNIQUE ============
--
-- CORRECTION D'UN CONTRESENS DE CONCEPTION. La première version traitait le
-- recalibrage comme une LENTILLE PERMANENTE : les trades restaient stockés à
-- l'ancienne échelle et étaient convertis à chaque lecture, indéfiniment.
--
-- Deux conséquences, toutes deux fausses :
--   1. un trade saisi APRÈS le recalibrage passait quand même par la lentille,
--      alors qu'il a été tradé sur le nouveau capital et ne devait pas bouger ;
--   2. toute écriture devait faire l'aller-retour d'échelle, ce qui rendait
--      l'édition et l'import inutilement fragiles.
--
-- Le bon modèle est un ÉVÉNEMENT PONCTUEL : au moment du recalibrage, les
-- trades DÉJÀ ENCODÉS sont réellement convertis, une fois. Ensuite tout
-- redevient normal — plus aucune conversion, ni en lecture ni en écriture. On
-- crée, édite et supprime des trades exactement comme avant.
--
-- ── LE POINT DE COUPURE ────────────────────────────────────────────────────
-- `created_at` (date d'ENCODAGE), et non `trade_date`. Un trade saisi
-- aujourd'hui pour une session d'il y a trois semaines a été saisi en
-- connaissant le capital actuel : il ne doit pas être converti. C'est le geste
-- de saisie qui porte l'échelle, pas la date de marché.
--
-- ── RÉVERSIBILITÉ SANS TABLE DE SAUVEGARDE ─────────────────────────────────
-- Chaque trade porte le facteur CUMULÉ qui lui a été appliqué. La valeur
-- d'origine reste donc calculable exactement : `stocké / calibration_factor`.
-- Un trade jamais converti garde 1 et est indiscernable de l'existant.
--
-- C'est aussi ce qui rend les recalibrages successifs corrects : 25k → 50k
-- applique 2 aux trades d'avant ; 50k → 100k applique 2 à tout ce qui précède
-- ce second moment — les plus anciens cumulent 4, ceux saisis entre les deux
-- cumulent 2. Chacun est ramené à la bonne échelle, aucun ne l'est deux fois.

alter table public.trades
  add column if not exists calibration_factor numeric not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trades_calibration_factor_positive'
  ) then
    alter table public.trades
      add constraint trades_calibration_factor_positive check (calibration_factor > 0);
  end if;
end $$;

comment on column public.trades.calibration_factor is
  'Facteur CUMULE reellement applique aux montants de cette ligne par les recalibrages successifs. 1 = jamais converti. La valeur d''origine vaut montant / calibration_factor.';

-- ── L'opération, atomique et sous RLS ──────────────────────────────────────
--
-- `security invoker` : la fonction s'exécute avec les droits de l'appelant,
-- donc les politiques owner-only de `trades` s'appliquent telles quelles. Un
-- utilisateur ne peut convertir que ses propres lignes, même en devinant un
-- identifiant de compte. Le `user_id = auth.uid()` explicite double la garde.
--
-- Une seule instruction UPDATE : soit tous les trades du compte basculent,
-- soit aucun. Un recalibrage à moitié appliqué serait indétectable et
-- indémêlable.
create or replace function public.recalibrate_account_trades(
  p_account_id uuid,
  p_factor numeric,
  p_cutoff timestamptz
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if p_factor is null or p_factor <= 0 then
    raise exception 'calibration factor must be > 0';
  end if;
  if p_account_id is null or p_cutoff is null then
    raise exception 'account and cutoff are required';
  end if;

  -- Facteur neutre : rien à faire, et surtout aucune écriture inutile sur des
  -- milliers de lignes.
  if p_factor = 1 then
    return 0;
  end if;

  update public.trades set
    pnl                = round(pnl * p_factor, 2),
    risk_amount        = round(risk_amount * p_factor, 2),
    mae                = case when mae is null then null else round(mae * p_factor, 2) end,
    mfe                = case when mfe is null then null else round(mfe * p_factor, 2) end,
    slippage           = case when slippage is null then null else round(slippage * p_factor, 2) end,
    calibration_factor = calibration_factor * p_factor
    -- r_multiple, mistakes, setup_quality, confidence, confluences, notes et
    -- horaires ne sont PAS touchés : ratios et comportement ne dépendent pas
    -- du capital.
  where account_id = p_account_id
    and user_id = auth.uid()
    and created_at < p_cutoff;

  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.recalibrate_account_trades(uuid, numeric, timestamptz) from public;
grant execute on function public.recalibrate_account_trades(uuid, numeric, timestamptz) to authenticated;
