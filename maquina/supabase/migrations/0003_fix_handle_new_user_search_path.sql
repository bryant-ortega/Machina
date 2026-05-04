-- ============================================================================
-- Migration 0003: Fix handle_new_user() — pin search_path + schema-qualify
-- ============================================================================
-- The original function (in 0001) had no SET search_path. SECURITY DEFINER
-- functions inherit the caller's search_path, and Supabase's auth backend
-- (supabase_auth_admin) runs without `public` on the search_path. Result:
-- the unqualified `INSERT INTO profiles ...` fails with "relation does not
-- exist", which surfaces in the Dashboard as
-- "Database error saving new user".
--
-- Fix: explicitly SET search_path = public, pg_temp on the function and
-- fully qualify the table reference.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'dj'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger definition is unchanged, but recreating it keeps the migration
-- idempotent if anyone re-runs from a fresh DB without 0001 applied.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
