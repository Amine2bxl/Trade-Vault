-- Le transfert est indépendant de l'intégration broker : la provenance d'une
-- copie doit exister même si broker_sync n'a pas encore été déployé.
alter table public.trades add column if not exists copied_from text;
create index if not exists trades_copied_from_idx
  on public.trades (account_id, copied_from) where copied_from is not null;

-- Même règle Pro que broker_sync, avec les droits et la RLS de l'appelant.
-- Une copie déjà créée reste éditable après expiration de l'abonnement.
create or replace function public.enforce_copy_pro()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.copied_from is null then return new; end if;
  if exists (select 1 from public.trades where id = new.id) then return new; end if;
  if public.effective_tier(new.user_id) not in ('pro', 'elite') then
    raise exception 'PLAN_LIMIT_PRO: copying trades between accounts requires the Pro plan'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_copy_pro() from public, anon, authenticated;
create or replace trigger trades_enforce_copy_pro before insert on public.trades
  for each row execute function public.enforce_copy_pro();

notify pgrst, 'reload schema';
