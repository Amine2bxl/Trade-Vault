-- Idempotence (voir 20260607165855) : ces politiques sont recréées par une
-- migration ultérieure. Un rejeu complet — c'est-à-dire toute branche de
-- preview — échouait sur « policy already exists ».
drop policy if exists "Users can view own screenshots" on storage.objects;
create policy "Users can view own screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own screenshots" on storage.objects;
create policy "Users can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own screenshots" on storage.objects;
create policy "Users can update own screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own screenshots" on storage.objects;
create policy "Users can delete own screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);