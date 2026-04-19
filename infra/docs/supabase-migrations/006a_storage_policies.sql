-- ============================================================
-- 006a_storage_policies.sql
-- Storage bucket + RLS for community-media
-- Run AFTER bucket exists. Create with:
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('community-media','community-media', true)
--   ON CONFLICT (id) DO NOTHING;
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media','community-media', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (we want fast CDN reads on public videos)
DROP POLICY IF EXISTS "community_media_public_read" ON storage.objects;
CREATE POLICY "community_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-media');

-- Only authenticated users can upload, into a folder prefixed by their auth.uid()
DROP POLICY IF EXISTS "community_media_authenticated_insert" ON storage.objects;
CREATE POLICY "community_media_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'community-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role bypasses RLS — worker can write transcoded variants & thumbnails.

-- Owners can delete their own uploads
DROP POLICY IF EXISTS "community_media_owner_delete" ON storage.objects;
CREATE POLICY "community_media_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'community-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
