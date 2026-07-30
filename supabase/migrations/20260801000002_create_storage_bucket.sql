-- Create the trade-screenshots Storage bucket (used but never defined in SQL).
-- The RLS policies already exist on storage.objects — this creates the bucket
-- itself so a fresh environment can upload screenshots.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5 * 1024 * 1024, -- 5 MB per file
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
