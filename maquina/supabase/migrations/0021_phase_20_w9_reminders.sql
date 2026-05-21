-- Migration 0021 — Phase 20: W-9 reminder tracking.
--
-- One row per recipient (DJ or vendor) that we've sent W-9 reminders
-- to. The weekly cron (src/app/api/cron/w9-reminders/route.ts) reads
-- last_sent_at to throttle to one reminder per 7 days, increments
-- reminder_count on each send, and sets stopped_at once the W-9 lands.
--
-- DEVIATION FROM BUILD_PLAN: the plan specced a dj-only table
-- (dj_id UNIQUE NOT NULL). We generalize to cover vendors too — the
-- handoff explicitly calls for the vendor W-9 reminder flow now that
-- vendors exist. A single table with an XOR target (exactly one of
-- dj_id / vendor_id set) keeps the cron query and RLS simple while
-- avoiding two near-identical tables.
--
-- Apply via the Supabase SQL Editor, then run the NOTIFY at the bottom.

CREATE TABLE IF NOT EXISTS w9_reminders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_id          uuid        REFERENCES djs(id) ON DELETE CASCADE,
  vendor_id      uuid        REFERENCES vendors(id) ON DELETE CASCADE,
  last_sent_at   timestamptz,
  reminder_count int         NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  stopped_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Exactly one target. Either a DJ reminder or a vendor reminder,
  -- never both, never neither.
  CONSTRAINT w9_reminders_one_target CHECK (
    (dj_id IS NOT NULL AND vendor_id IS NULL) OR
    (dj_id IS NULL AND vendor_id IS NOT NULL)
  )
);

-- One reminder row per DJ and per vendor. Partial unique indexes
-- (rather than table-level UNIQUE) so the NULL side of each target
-- doesn't collide across rows.
CREATE UNIQUE INDEX IF NOT EXISTS w9_reminders_dj_uniq
  ON w9_reminders (dj_id) WHERE dj_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS w9_reminders_vendor_uniq
  ON w9_reminders (vendor_id) WHERE vendor_id IS NOT NULL;

ALTER TABLE w9_reminders ENABLE ROW LEVEL SECURITY;

-- Admin-only. The cron uses the service-role client, which bypasses
-- RLS, so it doesn't need a policy. No other role ever touches this.
DROP POLICY IF EXISTS "w9_reminders_all_admin" ON w9_reminders;
CREATE POLICY "w9_reminders_all_admin" ON w9_reminders
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
