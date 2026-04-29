-- ============================================================================
-- Migration 0004: Phase 5 — Storage RLS for the `w9s` bucket
-- ============================================================================
-- BUILD_PLAN.md Phase 5 calls for two policies on storage.objects:
--
--   1. w9_upload_own   — authenticated users can INSERT into w9s/{their_uid}/...
--   2. w9_read_admin   — admins can SELECT any object in the w9s bucket
--
-- The bucket itself ('w9s', private) is created via the Supabase Dashboard
-- in Phase 5.1. This migration only handles RLS so the rules are versioned.
--
-- Notes:
--   * `storage.objects` ships with RLS already enabled by Supabase. We just
--     add policies; we don't ALTER TABLE.
--   * `storage.foldername(name)` returns the path segments as a text[]; index
--     [1] is the first segment (the user-id folder).
--   * `auth.uid()` returns uuid; cast to text to compare.
--   * `get_my_role()` was created in 0002 and is SECURITY DEFINER, so it
--     reads the caller's profile row even though storage.objects is in a
--     different schema.
--   * DJs intentionally cannot SELECT their own W-9 directly. They go through
--     /api/storage/signed-url, which authorizes the request server-side using
--     the service role. This keeps the bucket truly private — no RLS path
--     hands a DJ a public URL by mistake.
--   * Re-running is safe: `DROP POLICY IF EXISTS` first, then create.
-- ============================================================================

DROP POLICY IF EXISTS "w9_upload_own"  ON storage.objects;
DROP POLICY IF EXISTS "w9_read_admin"  ON storage.objects;

CREATE POLICY "w9_upload_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'w9s'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "w9_read_admin" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'w9s'
    AND public.get_my_role() = 'admin'
  );

-- DJs sometimes need to overwrite their own W-9 (replace a bad scan, etc).
-- Allow UPDATE on their own folder. DELETE stays admin-only via the absence
-- of a DJ delete policy — `storage.objects` is RLS-locked by default.
DROP POLICY IF EXISTS "w9_update_own" ON storage.objects;

CREATE POLICY "w9_update_own" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'w9s'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'w9s'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
