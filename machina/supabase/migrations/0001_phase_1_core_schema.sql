-- ============================================================================
-- Phase 1 — Core Database Schema
-- ============================================================================
-- 10 tables + 1 auth trigger.
-- Source of truth: BUILD_PLAN.md → Phase 1.
-- Run order matters: tables reference each other via foreign keys.
--
-- This file is the canonical, version-controlled record of the schema. The
-- BUILD_PLAN instructs running these blocks one at a time in the Supabase
-- SQL Editor, which is what we did during the initial build. This file
-- exists so the schema can be reproduced from scratch (e.g. for staging,
-- a coworker's machine, or after a project reset).
--
-- RLS policies live in 0002_phase_2_rls.sql (next phase).
-- ============================================================================


-- 1. PROFILES ----------------------------------------------------------------
-- App-level user profile extending auth.users. One row per Auth account.
-- Auto-created via trigger when a new auth.users row is inserted.

CREATE TABLE profiles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         varchar     NOT NULL CHECK (role IN ('admin', 'partner', 'dj', 'vendor')),
  display_name varchar     NOT NULL,
  status       varchar     NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Trigger function: auto-create a profile row on new Auth user.
-- Reads the role and display_name from raw_user_meta_data set at signup;
-- defaults to 'dj' / email if not provided.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'dj'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 2. VENUES ------------------------------------------------------------------
CREATE TABLE venues (
  id      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name    varchar NOT NULL,
  address varchar,
  city    varchar NOT NULL,
  state   varchar NOT NULL
);


-- 3. DJS ---------------------------------------------------------------------
CREATE TABLE djs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dj_name         varchar     NOT NULL,
  government_name varchar     NOT NULL,
  phone           varchar,
  email           varchar     UNIQUE NOT NULL,
  pay_method      varchar     CHECK (pay_method IN ('zelle', 'venmo', 'paypal')),
  pay_handle      varchar,
  region          varchar     NOT NULL CHECK (region IN ('SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other')),
  w9_storage_path varchar,
  w9_status       varchar     NOT NULL DEFAULT 'pending' CHECK (w9_status IN ('pending', 'on_file')),
  rank            varchar,
  registered_at   timestamptz NOT NULL DEFAULT now()
);


-- 4. EVENTS ------------------------------------------------------------------
CREATE TABLE events (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  year                   int         NOT NULL,
  date                   date        NOT NULL,
  event_id               varchar     UNIQUE NOT NULL,
  weekend_number         int         NOT NULL CHECK (weekend_number BETWEEN 1 AND 5),
  weekend_flag           varchar     NOT NULL CHECK (weekend_flag IN ('good', 'warning')),
  day_of_week            varchar     NOT NULL,
  title                  varchar     NOT NULL,
  type                   varchar     NOT NULL CHECK (type IN ('club', 'concert', 'festival')),
  venue_id               uuid        REFERENCES venues(id),
  city                   varchar     NOT NULL,
  state                  varchar     NOT NULL,
  status                 varchar     NOT NULL DEFAULT 'tentative' CHECK (status IN ('tentative', 'confirmed')),
  collab                 boolean     NOT NULL DEFAULT false,
  stages                 int         NOT NULL DEFAULT 1 CHECK (stages BETWEEN 1 AND 4),
  doors_time             time        NOT NULL,
  end_time               time        NOT NULL,
  capacity               int         CHECK (capacity > 0),
  guarantee              boolean     DEFAULT false,
  bar_included           boolean     DEFAULT false,
  rent                   numeric     CHECK (rent >= 0),
  split_pct              numeric     CHECK (split_pct BETWEEN 0 AND 100),
  venue_tix_fee          numeric     CHECK (venue_tix_fee >= 0),
  advance_contact_email  varchar,
  advance_contact_phone  varchar,
  announce_date          date,
  begin_art_date         date,
  art_due_date           date,
  on_sale_date           date,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid        REFERENCES profiles(id)
);


-- 5. EVENT_STAGES ------------------------------------------------------------
CREATE TABLE event_stages (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_number int     NOT NULL CHECK (stage_number BETWEEN 1 AND 4),
  stage_name   varchar NOT NULL,
  UNIQUE (event_id, stage_number)
);


-- 6. EVENT_DJ_SLOTS ----------------------------------------------------------
CREATE TABLE event_dj_slots (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_id   uuid    NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
  slot_order int     NOT NULL CHECK (slot_order BETWEEN 1 AND 6),
  dj_id      uuid    NOT NULL REFERENCES djs(id),
  slot_type  varchar NOT NULL CHECK (slot_type IN ('open', 'support_1', 'support_2', 'main_support', 'headline', 'close')),
  rate       numeric CHECK (rate >= 0),
  start_time time,
  end_time   time,
  UNIQUE (event_id, stage_id, slot_order)
);


-- 7. EVENT_BUDGETS -----------------------------------------------------------
CREATE TABLE event_budgets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  budget_type varchar     NOT NULL CHECK (budget_type IN ('estimated', 'final')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  UNIQUE (event_id, budget_type)
);


-- 8. EVENT_BUDGET_EXPENSES ---------------------------------------------------
CREATE TABLE event_budget_expenses (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id      uuid    NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  category       varchar NOT NULL CHECK (category IN ('digital', 'consumables', 'travel', 'transportation', 'vendors', 'staff', 'djs')),
  item           varchar NOT NULL,
  qty            numeric NOT NULL DEFAULT 1 CHECK (qty > 0),
  price          numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  total          numeric GENERATED ALWAYS AS (qty * price) STORED,
  payment_status varchar NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_method varchar CHECK (payment_method IN ('paypal', 'zelle', 'venmo', 'other')),
  payee_type     varchar CHECK (payee_type IN ('dj', 'vendor', 'other')),
  payee_id       uuid
);


-- 9. EVENT_BUDGET_INCOME -----------------------------------------------------
CREATE TABLE event_budget_income (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   uuid    NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  income_type varchar NOT NULL CHECK (income_type IN ('tickets', 'bar', 'merch', 'sponsor', 'vendor')),
  label       varchar NOT NULL,
  value       numeric NOT NULL DEFAULT 0 CHECK (value >= 0)
);


-- 10. EVENT_TIX_TIERS --------------------------------------------------------
CREATE TABLE event_tix_tiers (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   uuid    NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  tier_number int     NOT NULL CHECK (tier_number BETWEEN 1 AND 8),
  price       numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  sold        int     NOT NULL DEFAULT 0 CHECK (sold >= 0),
  total       numeric GENERATED ALWAYS AS (sold * price) STORED,
  UNIQUE (budget_id, tier_number)
);
