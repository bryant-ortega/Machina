-- ============================================================================
-- Migration 0006: Phase 7 — add 'resident' slot type
-- ============================================================================
-- event_dj_slots.slot_type CHECK currently allows only the original six:
-- open, support_1, support_2, main_support, headline, close. Chase asked for
-- a seventh type 'resident' (default rate $300) for in-house DJs that play
-- recurring nights. This migration extends the CHECK constraint accordingly.
--
-- The constraint was created inline by Postgres so it has the auto name
-- event_dj_slots_slot_type_check.
-- ============================================================================

ALTER TABLE event_dj_slots
  DROP CONSTRAINT event_dj_slots_slot_type_check;

ALTER TABLE event_dj_slots
  ADD CONSTRAINT event_dj_slots_slot_type_check
  CHECK (slot_type IN (
    'open',
    'support_1',
    'support_2',
    'main_support',
    'headline',
    'close',
    'resident'
  ));
