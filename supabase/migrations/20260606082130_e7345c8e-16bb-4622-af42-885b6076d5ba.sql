-- Idempotence (voir 20260607165855) : politiques recréées par une migration
-- ultérieure. Un rejeu complet — donc toute branche de preview — échouait ici.

DROP POLICY IF EXISTS "Users can read own screenshots" ON storage.objects;
CREATE POLICY "Users can read own screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can upload own screenshots" ON storage.objects;
CREATE POLICY "Users can upload own screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update own screenshots" ON storage.objects;
CREATE POLICY "Users can update own screenshots" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can delete own screenshots" ON storage.objects;
CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
