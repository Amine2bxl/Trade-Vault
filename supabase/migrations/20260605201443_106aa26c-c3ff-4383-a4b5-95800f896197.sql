create policy "Users can view own screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);