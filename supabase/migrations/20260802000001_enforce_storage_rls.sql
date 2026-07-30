-- Ensure clean, non-duplicated RLS policies on the trade-screenshots storage bucket.
-- Multiple migrations created overlapping policies; this replaces them all with
-- a single set that scopes every object access to the owning user's folder.

drop policy if exists "Users can read own screenshots" on storage.objects;
drop policy if exists "Users can upload own screenshots" on storage.objects;
drop policy if exists "Users can update own screenshots" on storage.objects;
drop policy if exists "Users can delete own screenshots" on storage.objects;
drop policy if exists "Users can view own screenshots" on storage.objects;

create policy "Users can read own screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
