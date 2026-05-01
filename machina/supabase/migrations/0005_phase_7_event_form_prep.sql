-- ============================================================================
-- Migration 0005: Phase 7 prep — rent category + venue dedup index
-- ============================================================================
-- 1. event_budget_expenses currently CHECKs category IN
--    ('digital','consumables','travel','transportation','vendors','staff','djs').
--    The default expense template for new events includes a 'rent' line
--    (separate from events.rent which captures venue rent on the event row).
--    Extend the constraint to allow 'rent'.
--
-- 2. The /events/new form has a "find-or-create venue" path: as the admin
--    types a venue name, we autocomplete from existing venues filtered by
--    the event's city, and on save we case/whitespace-normalize the name
--    before deciding insert vs reuse. To make that race-safe (two admins
--    submitting the same new venue at the same time) we add a UNIQUE INDEX
--    on (lower(trim(name)), city, state). Same name + city + state ⇒ same
--    row, regardless of casing or surrounding whitespace.
--
--    City + state are part of the key because two real venues can share a
--    name in different cities ("The Echo" — LA vs NYC).
--
--    No data backfill is needed; existing seed venues all have distinct
--    (name, city, state) tuples.
-- ============================================================================


-- 1. Extend event_budget_expenses category enum -----------------------------
ALTER TABLE event_budget_expenses
  DROP CONSTRAINT event_budget_expenses_category_check;

ALTER TABLE event_budget_expenses
  ADD CONSTRAINT event_budget_expenses_category_check
  CHECK (category IN (
    'digital',
    'consumables',
    'travel',
    'transportation',
    'vendors',
    'staff',
    'djs',
    'rent'
  ));


-- 2. Venue dedup unique index ----------------------------------------------
-- Functional unique index. Postgres permits index expressions but a UNIQUE
-- CONSTRAINT cannot reference functions, so we use CREATE UNIQUE INDEX.
CREATE UNIQUE INDEX IF NOT EXISTS venues_normalized_unique
  ON venues (lower(btrim(name)), lower(btrim(city)), lower(btrim(state)));
