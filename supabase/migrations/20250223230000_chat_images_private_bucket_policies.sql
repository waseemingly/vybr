-- Allow authenticated users to read (download) from storage when buckets are PRIVATE.
-- App uses supabase.storage.download() or StorageImage component for viewing.
-- After applying, set each bucket to Private in Dashboard: Storage → bucket → Edit → Private.

-- Chat images (E2E encrypted; app uses authenticated download)
CREATE POLICY "Authenticated read individual-chat-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'individual-chat-images');

CREATE POLICY "Authenticated read group-chat-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'group-chat-images');

-- Group avatars, event posters, profile-pictures (app uses StorageImage / authenticated download)
CREATE POLICY "Authenticated read group-avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'group-avatars');

CREATE POLICY "Authenticated read event_posters"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event_posters');

CREATE POLICY "Authenticated read profile-pictures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-pictures');
