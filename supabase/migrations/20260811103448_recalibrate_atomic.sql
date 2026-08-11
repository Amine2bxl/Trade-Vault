-- ============ RECALIBRAGE : UNE SEULE TRANSACTION ============
--
-- LE DÉFAUT CORRIGÉ ICI, ET COMMENT IL S'EST MANIFESTÉ.
--
-- Le recalibrage se faisait en DEUX appels successifs depuis le client :
--   1. `recalibrate_account_trades(...)` — convertit les trades ;
--   2. un `update` sur `accounts` — écrit le nouveau solde et l'échelle.
--
-- Rien ne liait ces deux écritures. Un compte a donc pu être marqué
-- « recalibré ×2 » alors qu'AUCUN de ses trades n'avait été converti : les
-- montants affichés restaient ceux de l'ancien capital, et le trader voyait
-- des risques de 174 $ sur un compte de 500 000 $.
--
-- Pire, l'état devenait DÉFINITIF. Au second essai, le facteur se calcule
-- depuis le solde courant du compte — déjà passé à 50 000 — donc
-- 50 000 / 50 000 = 1, et la fonction sortait immédiatement sans rien faire.
-- Le compte restait bloqué dans un état où la métadonnée ment sur les données.
--
-- La correction est structurelle : les deux écritures ne font plus qu'une
-- instruction, dans une seule fonction, donc dans une seule transaction. Soit
-- les trades sont convertis ET le compte mis à jour, soit rien ne change. Il
-- devient impossible de reproduire l'incohérence.
--
-- L'ancienne fonction est conservée : elle reste correcte pour une conversion
-- seule, et c'est elle qui sert à réparer les comptes déjà abîmés.

create or replace function public.recalibrate_account(
  p_account_id       uuid,
  p_factor           numeric,
  p_cutoff           timestamptz,
  p_target_balance   numeric,
  p_original_balance numeric,
  p_cumulative       numeric
) returns integer
language plpgsql
security invoker
set search_path to 'public'
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
  -- Un facteur de 1 ne convertit rien ET ne doit rien marquer : écrire la
  -- métadonnée sans conversion est exactement le bug corrigé ici.
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
  where account_id = p_account_id
    and user_id = auth.uid()
    and created_at < p_cutoff;

  get diagnostics n = row_count;

  update public.accounts set
    starting_balance  = p_target_balance,
    calibration_scale = p_cumulative,
    original_balance  = p_original_balance,
    calibrated_at     = p_cutoff
  where id = p_account_id
    and user_id = auth.uid();

  return n;
end
$$;

comment on function public.recalibrate_account is
  'Recalibrage atomique : convertit les trades encodes avant le cutoff ET met a jour le compte, dans une seule transaction. Un facteur de 1 ne fait rien du tout.';
