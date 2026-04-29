#!/usr/bin/env node
/**
 * Seed dev data — Phase 4.
 *
 * Idempotent (safe to re-run):
 *   - Creates 8 DJ auth users + their profiles via the on_auth_user_created trigger.
 *     Existing emails are skipped, not duplicated.
 *   - Upserts venues, djs, events, stages, slots, budgets, expenses, tix tiers
 *     keyed by deterministic UUIDs from the BUILD_PLAN spec.
 *
 * Usage:
 *   node scripts/seed-dev-data.mjs
 *
 * Reads env from machina/.env.local. Requires an existing admin profile
 * (chase@losgoths.co) — events.created_by is set to that profile's id.
 *
 * Service-role key bypasses RLS, so this script can write anywhere.
 * Never run it against production unless that's specifically what you want.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

function loadEnv(path) {
  const text = readFileSync(path, 'utf8')
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = loadEnv(envPath)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = 'chase@losgoths.co'

// ----------------------------------------------------------------------------
// Seed data — UUIDs match the BUILD_PLAN Phase 4 spec.
// ----------------------------------------------------------------------------

const VENUES = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'The Regent',  address: '448 S Main St',   city: 'Los Angeles',   state: 'CA' },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'Music Box',   address: '1337 India St',   city: 'San Diego',     state: 'CA' },
  { id: 'a1000000-0000-0000-0000-000000000003', name: 'DNA Lounge',  address: '375 11th St',     city: 'San Francisco', state: 'CA' },
  { id: 'a1000000-0000-0000-0000-000000000004', name: "Harlow's",    address: '2708 J St',       city: 'Sacramento',    state: 'CA' },
  { id: 'a1000000-0000-0000-0000-000000000005', name: 'Irving Plaza', address: '17 Irving Pl',   city: 'New York',      state: 'NY' },
]

// id, dj_name, government_name (placeholder), email, region, w9_status, rank
const DJS = [
  { id: 'b1000000-0000-0000-0000-000000000001', dj_name: 'Chat Noir',       government_name: 'Seed Record',   email: 'chatnoir@seed.dev',     region: 'SoCal', w9_status: 'pending', rank: 'headliner'    },
  { id: 'b1000000-0000-0000-0000-000000000002', dj_name: 'Sizzle',          government_name: 'Seed Record',   email: 'sizzle@seed.dev',       region: 'SoCal', w9_status: 'pending', rank: 'headliner'    },
  { id: 'b1000000-0000-0000-0000-000000000003', dj_name: 'PALOMO',          government_name: 'Seed Record',   email: 'palomo@seed.dev',       region: 'SoCal', w9_status: 'pending', rank: 'headliner'    },
  { id: 'b1000000-0000-0000-0000-000000000004', dj_name: 'Jinx',            government_name: 'Seed Record',   email: 'jinx@seed.dev',         region: 'SoCal', w9_status: 'on_file', rank: 'main_support' },
  { id: 'b1000000-0000-0000-0000-000000000005', dj_name: 'SoulCab',         government_name: 'Seed Record',   email: 'soulcab@seed.dev',      region: 'SoCal', w9_status: 'pending', rank: 'main_support' },
  { id: 'b1000000-0000-0000-0000-000000000006', dj_name: 'Sulkform',        government_name: 'Seed Record',   email: 'sulkform@seed.dev',     region: 'SoCal', w9_status: 'on_file', rank: 'support'      },
  { id: 'b1000000-0000-0000-0000-000000000007', dj_name: 'ValleyGhoul',     government_name: 'Seed Record',   email: 'valleyghoul@seed.dev',  region: 'NorCal', w9_status: 'pending', rank: 'support'     },
  { id: 'b1000000-0000-0000-0000-000000000008', dj_name: 'LosGothsCo. DJs', government_name: 'Internal House', email: 'lgco.djs@losgoths.co', region: 'SoCal', w9_status: 'on_file', rank: 'open'         },
]

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function findOrCreateDjAuthUser(dj) {
  // Pagination: listUsers returns up to perPage users at a time.
  // 8 DJs total fits in one page; bump if seed grows.
  const { data: page, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) throw new Error(`listUsers: ${listErr.message}`)
  const existing = page.users.find((u) => u.email?.toLowerCase() === dj.email.toLowerCase())
  if (existing) {
    return { authUserId: existing.id, created: false }
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: dj.email,
    email_confirm: true,
    user_metadata: { role: 'dj', display_name: dj.dj_name },
  })
  if (createErr) throw new Error(`createUser ${dj.email}: ${createErr.message}`)
  return { authUserId: created.user.id, created: true }
}

async function getAdminProfileId() {
  const { data: page, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  const adminAuth = page.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  if (!adminAuth) {
    throw new Error(`Admin user ${ADMIN_EMAIL} not found in auth.users — create them first.`)
  }
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', adminAuth.id)
    .maybeSingle()
  if (pErr) throw new Error(`profiles lookup: ${pErr.message}`)
  if (!profile) {
    throw new Error(`No profile row for ${ADMIN_EMAIL} — trigger should have created one.`)
  }
  if (profile.role !== 'admin') {
    throw new Error(`${ADMIN_EMAIL} has role='${profile.role}', expected 'admin'.`)
  }
  return profile.id
}

async function upsert(table, rows, opts = { onConflict: 'id' }) {
  if (!rows.length) return { count: 0 }
  const { error, count } = await supabase
    .from(table)
    .upsert(rows, { onConflict: opts.onConflict, ignoreDuplicates: false, count: 'exact' })
  if (error) throw new Error(`upsert ${table}: ${error.message}`)
  return { count: count ?? rows.length }
}

// ----------------------------------------------------------------------------
// Run
// ----------------------------------------------------------------------------

console.log('--- Phase 4 seed ---\n')

console.log(`[1/7] Resolving admin profile (${ADMIN_EMAIL})...`)
const adminProfileId = await getAdminProfileId()
console.log(`      profiles.id = ${adminProfileId}\n`)

console.log('[2/7] Ensuring 8 DJ auth users + profiles...')
const djAuthIds = {}
for (const dj of DJS) {
  const { authUserId, created } = await findOrCreateDjAuthUser(dj)
  djAuthIds[dj.id] = authUserId
  console.log(`      ${created ? 'created' : 'exists '}  ${dj.email.padEnd(28)} -> ${authUserId}`)
}
console.log()

console.log('[3/7] Upserting venues...')
const venuesResult = await upsert('venues', VENUES)
console.log(`      ${venuesResult.count} rows\n`)

console.log('[4/7] Upserting djs...')
const djsRows = DJS.map((dj) => ({
  id: dj.id,
  user_id: djAuthIds[dj.id],
  dj_name: dj.dj_name,
  government_name: dj.government_name,
  email: dj.email,
  region: dj.region,
  w9_status: dj.w9_status,
  rank: dj.rank,
}))
const djsResult = await upsert('djs', djsRows)
console.log(`      ${djsResult.count} rows\n`)

console.log('[5/7] Upserting events...')
const EVENTS = [
  {
    id: 'c1000000-0000-0000-0000-000000000001',
    year: 2026, date: '2026-04-25', event_id: '20260425-LA',
    weekend_number: 4, weekend_flag: 'good', day_of_week: 'Saturday',
    title: 'Gothicumbia Spring Los Angeles', type: 'club',
    venue_id: 'a1000000-0000-0000-0000-000000000001',
    city: 'Los Angeles', state: 'CA', status: 'confirmed',
    stages: 1, doors_time: '21:00', end_time: '02:00',
    capacity: 1200, bar_included: true, split_pct: 70,
    created_by: adminProfileId,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000002',
    year: 2026, date: '2026-04-11', event_id: '20260411-SD',
    weekend_number: 2, weekend_flag: 'good', day_of_week: 'Saturday',
    title: 'Gothicumbia Spring San Diego', type: 'club',
    venue_id: 'a1000000-0000-0000-0000-000000000002',
    city: 'San Diego', state: 'CA', status: 'confirmed',
    stages: 1, doors_time: '21:00', end_time: '02:00',
    capacity: 600, bar_included: true, split_pct: 70,
    created_by: adminProfileId,
  },
]
const eventsResult = await upsert('events', EVENTS)
console.log(`      ${eventsResult.count} rows\n`)

console.log('[6/7] Upserting stages + dj slots + budget + expenses + tix tiers...')
const STAGES = [
  { id: 'd1000000-0000-0000-0000-000000000001', event_id: EVENTS[0].id, stage_number: 1, stage_name: 'Main Stage' },
  { id: 'd1000000-0000-0000-0000-000000000002', event_id: EVENTS[1].id, stage_number: 1, stage_name: 'Main Stage' },
]
const stagesResult = await upsert('event_stages', STAGES)
console.log(`      stages:    ${stagesResult.count} rows`)

// DJ slots for the LA event. event_dj_slots has no UUID id column we own —
// it uses default gen_random_uuid(), so we upsert on (event_id, stage_id, slot_order)
// composite. To keep it simple + idempotent, delete then insert.
await supabase.from('event_dj_slots').delete().eq('event_id', EVENTS[0].id)
const SLOTS = [
  { event_id: EVENTS[0].id, stage_id: STAGES[0].id, slot_order: 1, dj_id: 'b1000000-0000-0000-0000-000000000008', slot_type: 'open',         rate:   0 },
  { event_id: EVENTS[0].id, stage_id: STAGES[0].id, slot_order: 2, dj_id: 'b1000000-0000-0000-0000-000000000006', slot_type: 'support_1',    rate: 150 },
  { event_id: EVENTS[0].id, stage_id: STAGES[0].id, slot_order: 3, dj_id: 'b1000000-0000-0000-0000-000000000005', slot_type: 'main_support', rate: 300 },
  { event_id: EVENTS[0].id, stage_id: STAGES[0].id, slot_order: 4, dj_id: 'b1000000-0000-0000-0000-000000000002', slot_type: 'headline',     rate: 800 },
  { event_id: EVENTS[0].id, stage_id: STAGES[0].id, slot_order: 5, dj_id: 'b1000000-0000-0000-0000-000000000005', slot_type: 'close',        rate: 200 },
]
const { error: slotErr, count: slotCount } = await supabase
  .from('event_dj_slots')
  .insert(SLOTS, { count: 'exact' })
if (slotErr) throw new Error(`event_dj_slots insert: ${slotErr.message}`)
console.log(`      dj slots:  ${slotCount ?? SLOTS.length} rows`)

const BUDGETS = [
  {
    id: 'e1000000-0000-0000-0000-000000000001',
    event_id: EVENTS[0].id,
    budget_type: 'estimated',
    created_by: adminProfileId,
  },
]
const budgetsResult = await upsert('event_budgets', BUDGETS)
console.log(`      budgets:   ${budgetsResult.count} rows`)

// Expenses also use gen_random_uuid; clean + reinsert for idempotency.
await supabase.from('event_budget_expenses').delete().eq('budget_id', BUDGETS[0].id)
const EXPENSES = [
  { budget_id: BUDGETS[0].id, category: 'djs',         item: 'Opener',             qty: 1, price:   0 },
  { budget_id: BUDGETS[0].id, category: 'djs',         item: 'Support 1',          qty: 1, price: 150 },
  { budget_id: BUDGETS[0].id, category: 'djs',         item: 'Main Support',       qty: 1, price: 300 },
  { budget_id: BUDGETS[0].id, category: 'djs',         item: 'Headliner',          qty: 1, price: 800 },
  { budget_id: BUDGETS[0].id, category: 'djs',         item: 'Closer',             qty: 1, price: 200 },
  { budget_id: BUDGETS[0].id, category: 'digital',     item: 'Flyer',              qty: 1, price: 150 },
  { budget_id: BUDGETS[0].id, category: 'digital',     item: 'IG Ads',             qty: 1, price: 200 },
  { budget_id: BUDGETS[0].id, category: 'consumables', item: 'Balloons',           qty: 1, price:  80 },
  { budget_id: BUDGETS[0].id, category: 'consumables', item: 'Helium Tank',        qty: 1, price: 120 },
  { budget_id: BUDGETS[0].id, category: 'consumables', item: 'Glow Sticks',        qty: 1, price:  60 },
  { budget_id: BUDGETS[0].id, category: 'consumables', item: 'Fog Juice',          qty: 1, price:  40 },
  { budget_id: BUDGETS[0].id, category: 'consumables', item: 'Distilled Water',    qty: 1, price:  10 },
  { budget_id: BUDGETS[0].id, category: 'staff',       item: 'Production Manager', qty: 1, price: 300 },
  { budget_id: BUDGETS[0].id, category: 'staff',       item: 'Photographer 1',     qty: 1, price: 200 },
]
const { error: expErr, count: expCount } = await supabase
  .from('event_budget_expenses')
  .insert(EXPENSES, { count: 'exact' })
if (expErr) throw new Error(`event_budget_expenses insert: ${expErr.message}`)
console.log(`      expenses:  ${expCount ?? EXPENSES.length} rows`)

// Tix tiers — upsert on (budget_id, tier_number) so re-runs are clean.
await supabase.from('event_tix_tiers').delete().eq('budget_id', BUDGETS[0].id)
const TIERS = [
  { budget_id: BUDGETS[0].id, tier_number: 1, price: 15, sold: 200 },
  { budget_id: BUDGETS[0].id, tier_number: 2, price: 20, sold: 300 },
  { budget_id: BUDGETS[0].id, tier_number: 3, price: 25, sold: 150 },
]
const { error: tixErr, count: tixCount } = await supabase
  .from('event_tix_tiers')
  .insert(TIERS, { count: 'exact' })
if (tixErr) throw new Error(`event_tix_tiers insert: ${tixErr.message}`)
console.log(`      tix tiers: ${tixCount ?? TIERS.length} rows\n`)

console.log('[7/7] Done.')
console.log()
console.log('Spot-check in Supabase SQL Editor:')
console.log("  SELECT count(*) FROM venues;             -- expect 5")
console.log("  SELECT count(*) FROM djs;                -- expect 8")
console.log("  SELECT count(*) FROM events;             -- expect 2")
console.log("  SELECT count(*) FROM event_stages;       -- expect 2")
console.log("  SELECT count(*) FROM event_dj_slots;     -- expect 5")
console.log("  SELECT count(*) FROM event_budgets;      -- expect 1")
console.log("  SELECT count(*) FROM event_budget_expenses; -- expect 14")
console.log("  SELECT count(*) FROM event_tix_tiers;    -- expect 3")
