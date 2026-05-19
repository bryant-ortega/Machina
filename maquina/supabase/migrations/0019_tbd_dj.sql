-- Migration 0019 — TBD placeholder DJ.
--
-- Lets the admin create events whose DJ slots aren't assigned to a real
-- DJ yet. We seed a single "TBD" row in `djs` that the new-event form
-- defaults to, so every slot still has a valid `dj_id` FK without
-- requiring a real auth user.
--
-- Steps:
--   1. Drop the NOT NULL on djs.user_id so the TBD row can have no
--      linked auth user. (UNIQUE on user_id stays — Postgres treats
--      multiple NULLs as distinct under standard UNIQUE, so this is
--      compatible with future system rows.)
--   2. Insert one TBD row, idempotent on the email.
--
-- Apply via the Supabase SQL Editor.

ALTER TABLE djs ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO djs (dj_name, government_name, email, region, w9_status)
VALUES ('TBD', 'TBD', 'tbd@maquina.local', 'Other', 'on_file')
ON CONFLICT (email) DO NOTHING;
