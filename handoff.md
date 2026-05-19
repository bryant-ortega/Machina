# Handoff — LosGothsCo Enterprise / Maquina

Hand this file to a fresh Claude conversation so it can pick up where this
one left off without re-discovering the codebase.

## Who & what

- **User**: Chase Ortega — `chase@monarca.systems`, also `kalicorose@gmail.com`.
  On macOS.
- **Company**: LosGothsCo — event/DJ operations.
- **App**: **Maquina** — internal Next.js + Supabase tool that's slowly
  replacing the user's Google Sheets-based workflow (Vendors sheet →
  Master Event Model → Events Budget 2026, glued together with Apps Script).
  Long-term goals: DJ/vendor self-registration, W-9 collection,
  multi-view event management, automated email comms with PDF attachments.
- **Live repo**: <https://github.com/bryant-ortega/Maquina.git>
  Repo root is `~/Documents/Claude/Projects/LosGothsCo Enterprise/`; the
  Next.js app sits inside it at `maquina/`. The `.git` is at the repo root,
  not inside `maquina/` — every `git` command runs from the repo root.

## Stack

- Next.js (App Router, TypeScript, Tailwind v4) inside `maquina/`.
- Supabase: Postgres + Auth + Storage (`w9s` bucket, private). RLS is on
  for every table; admin actions bypass via service-role client.
- DB migrations in `maquina/supabase/migrations/` (currently `0001`
  through `0019`). Recent additions:
  - `0016_phase_17_viewer_role.sql` — adds `'viewer'` role + RLS letting
    viewers SELECT from `events`
  - `0017_phase_17h_vendors.sql` — `vendors` table mirroring `djs`,
    full RLS, reuses the `w9s` storage bucket
  - `0018_add_regions.sql` — five new regions added to `djs` + `vendors`
    CHECK constraints
  - `0019_tbd_dj.sql` — drops NOT NULL on `djs.user_id` and seeds a
    single 'TBD' placeholder DJ row used as the default for new event
    slots
  Schema highlights:
  - `profiles` — one row per auth user, has `role` (`admin` | `dj` | etc.)
  - `djs` — DJ-specific columns, FK to `auth.users.id` via `user_id`
    (ON DELETE CASCADE). Has `w9_status` (`pending` | `on_file`) and
    `w9_storage_path` (relative path inside the `w9s` bucket).
  - `events`, `event_stages`, `event_dj_slots`, `event_budgets`, `venues`.
  - `event_budget_expenses` — per-line items on a budget. Includes
    `payment_status varchar` CHECK IN (`unpaid`,`paid`) (binary, set
    by 0013/0015) and `payment_method varchar` (freeform text after
    0011 dropped the original CHECK). Both editable inline on the
    Final budget only.
  - Trigger `handle_new_user` auto-creates a `profiles` row when an auth
    user is inserted, defaulting role from `user_metadata.role`.
- Hosting auto-deploys from `main` (likely Vercel).

## Key paths to know

```
maquina/
  src/app/
    layout.tsx                      # root html/body, dark-mode-aware bg
    globals.css                     # Tailwind + a few global tweaks
    login/page.tsx                  # /login (image + form)
    register/dj/                    # public DJ self-registration
      page.tsx
      registration-form.tsx
      actions.ts                    # has orphan-account reclaim path
    dj/upload-w9/                   # DJ uploads their own W-9
    (admin)/                        # admin route group, gated in layout
      layout.tsx                    # sidebar / mobile drawer / brand
      _mobile-nav.tsx
      djs/[id]/                     # admin DJ detail page
        page.tsx
        edit-form.tsx               # form for djs row fields
        actions.ts                  # updateDj + uploadDjW9
        w9-download.tsx
        w9-upload.tsx               # admin uploads W-9 on DJ's behalf
      events/page.tsx               # event list (sorted asc by date)
      events/[id]/edit/             # event edit form
      events/[id]/budget/           # budget page (estimated/final/compare)
        page.tsx                    # routes by ?view=, passes isFinal
        budget-form.tsx             # editable form, paid+method inline
        budget-compare.tsx          # read-only side-by-side
        actions.ts                  # updateBudget + actualizeEvent
        view-toolbar.tsx
    api/storage/signed-url/route.ts # POST { storagePath } -> { signedUrl }
    (admin)/views/[id]/page.tsx         # Phase 17f custom-view renderer
    register/vendor/                     # public vendor self-registration
      page.tsx
      registration-form.tsx
      actions.ts
    vendor/                              # post-registration vendor surface
      upload-w9/
      profile/
    viewer/                              # Phase 17g viewer-role chrome
      layout.tsx                         # minimal shell, no admin nav
      year/page.tsx                      # only page a viewer can see
  public/brand/
    losgoths-skull-triangle-transparent.png   # main logo (no-spaces copy)
    goth-makima.webp                          # login screen image
    maquina-cropped-face.webp                 # sidebar character image
    inverted-losgoths-logo.png
    losgoths-wordmark-nowhite.png
    gothicumbia-logo.png
  supabase/migrations/*.sql         # source of truth for schema + RLS
```

## What's done in this conversation (newest first)

> The entries below 17e are from the *previous* session and are kept here
> for context — Claude in the current session shipped everything from
> Phase 17f down through the DJ-fraction column and MΛQUIИΛ wordmark.

1. **DJ-fraction column on events / month / year.** New
   `src/components/dj-fraction.tsx` exports `fetchSlotCounts(supabase,
   eventIds)` (one round-trip join `event_dj_slots → djs(dj_name)`,
   rolls up to `Map<event_id, { filled, total }>`) and a
   `<DjFractionBadge filled total />` pill — yellow when `filled <
   total`, green when `filled === total > 0`, gray `—` when no slots.
   Column appended to the *right* of the desktop tables on `/events`,
   `/views/month`, `/views/year`; mobile cards on `/events` and
   `/views/month` get a stacked badge next to the Status pill. Year
   view has no separate mobile card path (the table just scrolls).
   `colSpan` on empty-state rows bumped from 7 to 8 in each file.

2. **TBD placeholder DJ.** Migration 0019 drops NOT NULL on
   `djs.user_id` (UNIQUE stays — Postgres NULLs are distinct under
   standard UNIQUE) and inserts one row with `dj_name='TBD'`,
   `email='tbd@maquina.local'`, region `'Other'`, `w9_status='on_file'`.
   `new-event-form.tsx` and `edit-event-form.tsx` both compute
   `const tbdDjId = djs.find((d) => d.dj_name === 'TBD')?.id ?? ''` and
   use it as the default `dj_id` for every newly-added slot. Existing
   client validation `if (slots.some((s) => !s.dj_id))` still fires,
   but it now passes because TBD is a real id. Events with all-TBD
   lineups save cleanly and the DJ-fraction column shows them as 0/N
   yellow.

3. **Five new regions.** Migration 0018 drops + re-adds the region
   CHECK constraint on both `djs` and `vendors` to include `'New York'`,
   `'Portland'`, `'Texas'`, `'Central Cal'`, `'Las Vegas'` (existing
   six unchanged). Every region zod enum + dropdown array updated in
   DJ registration, vendor registration, admin DJ edit form, admin DJ
   index. New entries appended after the existing six so existing rows
   don't get reshuffled in the admin UI.

4. **Required fields on registration.** Phone, pay method, and pay
   handle are required on both DJ and vendor registration. The
   `pay_method` dropdown defaults to Zelle on form mount (no more
   "—" placeholder option). Pay handle label reads "Pay handle
   (@name, or phone number)". Client + server zod schemas both
   enforce. DB columns remain nullable for back-compat with older
   rows; new registrations can't write nulls.

5. **Phase 17h — vendor self-registration.** New `vendors` table
   (mirrors `djs` — `company_name`, `contact_name`, `region`,
   `pay_method`, `pay_handle`, `phone`, `email`, W-9 fields). Public
   form at `/register/vendor`, post-registration flow:
   `/vendor/upload-w9` → `/vendor/profile`. Same orphan-account /
   wrong-role / wrong-password recovery branches as the DJ flow.
   Reuses the existing `w9s` storage bucket — paths are
   `{vendor_user_id}/w9.pdf`, and migration 0004's `w9_upload_own`
   policy already allows any authenticated user to write to their own
   folder. Vendors get role `'vendor'` in `profiles`; login + root +
   admin layout + middleware all route them to `/vendor/profile`
   (or `/vendor/upload-w9` if W-9 isn't on file). No admin index
   page for vendors yet — RLS gives admins full read but there's no
   UI to manage the roster yet.

6. **Phase 17g — viewer role.** Migration 0016 adds `'viewer'` to the
   profiles role CHECK and an `events_select_viewer` RLS policy so a
   viewer's SSR client can read events. New route group at
   `src/app/viewer/` with a slim layout (brand row + sign-out, no
   admin sidebar). `/viewer/year` renders the same data as
   `(admin)/views/year` but strips per-row links to `/events/[id]/edit`
   (viewers can't see that). Login + root + `(admin)` layout +
   middleware route the `viewer` role to `/viewer/year`. Creating a
   viewer: Supabase Studio → Auth → Add user (auto-confirm on), then
   Table Editor → profiles → change `role` to `'viewer'`. Note the
   admin layout used to bounce all non-admins to `/dj/profile`; it
   now role-routes correctly (viewer→/viewer/year, collab→/collab/events,
   vendor→/vendor/profile, default→/dj/profile).

7. **Phase 17f — custom view renderer.** `/views/[id]/page.tsx`
   loads the view + its visible `view_fields` in `position` order.
   Conditionally pulls `event_dj_slots` (with `djs(dj_name)`) only if
   `dj_count` or `headliner_name` is visible; conditionally pulls
   estimated budgets + expenses + tiers (then runs `computeBudget` from
   `lib/budget.ts`) only if any financial field is visible. Renders a
   table per the view's visible fields formatted by each field's
   `kind` (currency via `formatUSD`, dates as `Mar 15, 2026`, times as
   `9:00 PM`, booleans as ✓/—, etc.). The `title` column links to
   `/events/[id]/edit`. System views (`is_system=true`) render the
   same way but skip the "Edit fields" button. Per-event customization
   (Phase 17 spec) and CSV export were deliberately skipped from this
   slice — flag for future work.

8. **MΛQUIИΛ wordmark.** Replaced every visible "Maquina" header text
   with the stylized `MΛQUIИΛ` across `(admin)/layout.tsx` (desktop
   sidebar + mobile drawer), `(admin)/_mobile-nav.tsx`,
   `collab/layout.tsx`, and `viewer/layout.tsx`. Login page wordmark
   was already MΛQUIИΛ; just bumped its size from `text-xs` to
   `text-2xl` (literal 2×) per Chase's request. `alt="Maquina"`
   attributes on brand images stay plain ASCII for screen readers.

9. **PostgREST schema-cache gotcha (recurring).** Every time you paste
   a migration into the Supabase SQL Editor that creates or alters a
   table, follow it with `NOTIFY pgrst, 'reload schema';` in the same
   editor. Without that, PostgREST keeps serving "Could not find the
   table 'public.X' in the schema cache" errors for a few minutes
   until it auto-refreshes. We hit this twice in this session — once
   on `views` (Phase 17d's tables that were never actually applied),
   once on `vendors`. Add the NOTIFY line to your migration apply
   checklist.

10. **Phase 18 (slim) — inline payment tracking on Final budget.** The
   actualized (final) budget's expense table now exposes a `Paid`
   dropdown (binary `unpaid` / `paid` — no `partial`) and a freeform
   `Method` text input on each row. Estimated budget UI is unchanged.
   The `Method` field is disabled while `Paid` = unpaid, and gets
   cleared when you flip back to unpaid. Each category header in the
   Final view shows "$X paid / $Y total" so progress is scannable.
   See `src/app/(admin)/events/[id]/budget/budget-form.tsx`
   (`PaymentStatus`, `selectClass`, the Paid + Method `<td>`s),
   `actions.ts` (`payment_status`, `payment_method` in the Zod schema
   and update/insert), and `page.tsx` (selects + passes both columns).

   *Detour we backed out of:* a heavier ledger architecture
   (`expense_payments` table + separate `/events/[id]/payments` page +
   `addExpensePayment`/`deleteExpensePayment` actions + overage
   validation + `lib/expense-payments.ts` helpers) was built and then
   reverted because the inline approach matches Chase's actual
   workflow ("when I actualize a budget I am making payments and
   marking them as paid"). Migration `0015_revert_phase_18_ledger.sql`
   drops the `expense_payments` table and re-asserts the
   `unpaid`/`paid` CHECK on `event_budget_expenses.payment_status`.
   If a future task genuinely needs a multi-payment-per-line ledger
   with history, that experiment is in the git log — don't re-invent
   it from scratch.

11. **qty=0 → "remove on save" in the budget form.** Setting an
   expense row's qty to 0 (or blank) marks it for deletion: the row
   instantly fades + strikes-through with a "Will be removed on save"
   tooltip; the actual delete happens on Save. Existing rows get
   diffed-deleted server-side; new rows are filtered out before
   payload build. The Zod validator also rejects `qty <= 0` as a
   defense-in-depth — it shouldn't fire from the UI but catches
   bypasses with a clean inline error instead of the raw Postgres
   constraint message. See `budget-form.tsx` (`keptExpenses`,
   `willBeRemoved`) and `actions.ts` (`z.number().positive(...)`).

12. **Events index polish.**
   - Sort: strict ascending by date (soonest → latest). The previous
     past-vs-future bucketing is gone — status / past / future have
     no effect on order.
   - Replaced the `Event ID` column with a `Day` column showing the
     full weekday name (Saturday, Friday, etc.) derived from
     `events.date`. `event_id` is still in the DB and used elsewhere,
     just hidden from the list.
   - Removed the `Type` and `Stages` columns. SELECT trimmed too.
   - Mobile card swaps the event_id chip for the day-of-week.
   See `src/app/(admin)/events/page.tsx`.

13. **`payment_method` is now freeform text.** Migration `0011`
   dropped the original `('paypal','zelle','venmo','other')` CHECK
   constraint. Cash, check #1234, ACH, etc. all work. Column stays
   nullable — empty stored as NULL.

14. **DJ registration — orphan-account recovery (commit `5ad1096`).**
   When an auth user exists for an email but the `djs` row was deleted,
   re-submitting the registration form with the matching password now
   reclaims the account (re-inserts the `djs` row + fixes the `profiles`
   row). Wrong password → friendly amber error with reset/different-email
   options. Wrong role (e.g. existing admin user) → red error refusing to
   overwrite. See `src/app/register/dj/actions.ts` (`reclaimOrphanAccount`,
   `isEmailExistsError`) and the matching UI states in `registration-form.tsx`.

15. **Register page copy (commit `45498f5`).** Removed stale "we'll email a
   magic link" line — flow has been password-based for a while.

16. **Admin W-9 upload (commit `44b0c8b`).** New `uploadDjW9` server
   action + `<W9UploadButton>` client component, wired into the admin DJ
   detail page header. Writes to `w9s/{dj_user_id}/w9.pdf`, sets
   `w9_storage_path` + flips `w9_status` to `on_file`. Shows as "Upload W-9"
   when pending, "Replace W-9" when on file. Handles wrong type / too
   large / no linked user_id / etc.

17. **Admin nav polish (commits `248b232`, `34f7156`).** Desktop sidebar:
   skull-triangle logo + "Maquina" header, character face image above
   the nav, no "LosGothsCo Enterprise" subtext. Mobile top bar: hamburger
   + small logo + "Maquina". Mobile drawer: face image above nav (smaller
   than desktop), `overflow-y-auto` on nav so signout stays anchored.

18. **Login page.** Two-column layout on `sm+` (`goth-makima.webp` on the
   left, sign-in form on the right) and stacked on mobile. Wordmark says
   just "Maquina". Login form now reads from FormData(form) at submit time
   so autofill works without the "type a space then backspace" dance, and
   the button only disables while a submit is in-flight (native `required`
   handles empty values).

## Conventions / quirks learned

- **Image filenames with spaces.** User sometimes drops in files with
  spaces; we keep a no-spaces copy alongside the original and reference
  the clean name (`maquina-cropped-face.webp`,
  `losgoths-skull-triangle-transparent.png`). Originals usually still
  sit in `public/brand/` — they're cosmetic-only and can be deleted any
  time.
- **Image optimization.** The `goth-makima.webp` is a 900×1329 WebP at
  quality 90 (~241 KB), down from a 3.97 MB PNG. Use the same approach
  for any new large images: resize to ~2× display size, WebP, q90.
- **macOS `.DS_Store` files** show up in `public/brand/` — harmless,
  already in or could go in `.gitignore` if not.
- **Service-role client pattern.** Admin writes that touch Storage and
  multiple tables use `createClient(URL, SERVICE_ROLE_KEY, ...)` directly
  instead of the SSR client. RLS is bypassed, so the action manually
  enforces invariants (role check, user_id match) on the server.
- **Two-layer auth check on admin actions.** Every admin server action
  re-checks `profile.role === 'admin'` server-side, even though the
  `(admin)` layout already gates the route — defence in depth, also
  flagged inline in JSDoc on each action.
- **W-9 storage path is always `{dj_user_id}/w9.pdf`** in the `w9s`
  bucket. Both the DJ self-upload and the new admin upload agree on this.
- **DJ delete leaves an orphan auth user.** Now handled by the
  reclaim flow above; if it ever needs a true cleanup, the user does it
  manually in Supabase Studio → Authentication → Users (permanent
  deletions of accounts aren't something Claude is allowed to automate).
- **Migrations run manually in Supabase SQL Editor.** Chase pastes the
  SQL from each new migration file into the dashboard's SQL Editor and
  clicks Run. There's no `supabase db push` workflow in use. Always
  give him the exact SQL to paste alongside the file commit, and call
  out the order if multiple migrations need to apply in sequence.
- **Budget form quirks.** (a) qty is stored as a string in form state
  and coerced at compute/save time to dodge `<input type=number>` →
  NaN bugs. (b) qty=0 means "delete this row" — the row stays visible
  (faded + strikethrough) until save, then gets diffed-deleted. (c)
  the DB CHECK is `qty > 0` strict, so the Zod validator matches with
  `.positive()`. (d) `payment_method` is disabled while `payment_status
  = 'unpaid'` and gets cleared when flipping back to unpaid so we
  don't carry stale text.
- **Phase 18 ledger experiment was reverted.** Migrations 0012, 0013,
  0014 (backfill, deleted) were the heavier ledger approach. 0013 is
  still in the tree because it's harmless (it just tightens the
  payment_status CHECK to binary, which the slim approach also wants).
  0015 drops the `expense_payments` table and re-asserts the same
  binary CHECK. Net effect on the live DB after running everything:
  same as if only 0011 + 0015 had ever existed.

## Open / likely-next items

- **BUILD_PLAN status.** Phases 0–18 (slim) shipped previously; this
  session shipped 17f (renderer), 17g (viewer role), 17h (vendor
  self-registration), the TBD DJ pipeline, the DJ-fraction column,
  five new regions, required pay fields, and the MΛQUIИΛ wordmark.
  Remaining build-plan phases:
  - **Phase 20 — Automated Emails + W-9 reminders.** Needs Chase to
    sign up at resend.com and add `RESEND_API_KEY` to Vercel before
    the code can be wired up. Includes a Vercel cron at
    `src/app/api/cron/w9-reminders/route.ts` (Mondays 9am). Should
    also cover the vendor W-9 reminder flow now that vendors exist.
- **Admin index/detail for vendors.** Parallel to `/(admin)/djs` +
  `/(admin)/djs/[id]`. The `vendors` table + RLS exist; only the UI
  is missing. Easy next slice.
- **Single registration form covering DJs + vendors.** Right now
  they're two parallel pages (`/register/dj`, `/register/vendor`).
  Handoff item from prior session, still open.
- **Per-event customization + CSV export on custom view renderer
  (Phase 17 spec leftovers).** Renderer at `/views/[id]/page.tsx`
  deliberately ships without these. The data model in 0010
  (`event_view_customizations`) already supports it; just need the UI.
- **Per-user view sharing.** Chase mentioned this when we were
  speccing the viewer role. Path A (viewer role locked to one page)
  is what we built. Path B (per-view, per-recipient access via a
  `view_shares` table) is sketched in a chat reply earlier this
  session — punt to a future phase, ideally bundled with Resend so
  email invites work for non-account recipients.
- **Hide TBD from DJ listings / DJ analytics?** The placeholder row
  currently shows up in `/djs`, `/views/dj-analytics`, etc. like a
  real DJ. Either filter it out per-page or add a `kind = 'system'`
  column on `djs`. Worth doing once you see it in the UI.
- **`(collab)` route group** still untouched in this session.
- **Migration consolidation / cleanup.** 19 migrations in the tree
  (0001–0019, with 0014 deleted). Worth a review before adding more
  schema.

## Operational details

- **Push flow** (from repo root):
  ```
  git add <files>
  git commit -m "..."
  git push
  ```
- **Local dev**: from `maquina/`, `npm run dev`. Env vars in
  `.env.local` (already configured for the user's Supabase project).
- **Type check**: from `maquina/`, `npx tsc --noEmit`. Last full run
  during this session was clean.
- **Lint**: from `maquina/`, `npm run lint` (eslint, no args). Was
  clean at end of session.
- **Production build sanity**: `npm run build` from `maquina/` works
  when the network can reach `fonts.googleapis.com` (Geist + Geist
  Mono via `next/font/google`). Don't be alarmed if a sandboxed
  build step fails on the font fetch — Vercel can reach Google so
  the deployed build is fine.
- **Build deploys** on push to `main`. Live URL not stated by the user
  in this chat — check the hosting dashboard if needed.

## Things to be careful of

- Don't push automatically without explicit user consent. The user
  has run all the `git push` commands themselves in this session except
  one (which they explicitly authorized).
- Don't delete files / DB rows / auth users without explicit user
  consent — Claude isn't supposed to do permanent deletions even with
  permission, but cleanup actions (like removing the duplicate
  `maquina cropped face.webp` with the space) are fine when explicitly
  asked.
- The repo is named `Maquina` on GitHub but the org/user is
  `bryant-ortega`. The local working tree is on `main` and tracks
  `origin/main`. The user pushes to `main` directly — no PR review flow
  in use yet.
- **Always remind Chase to `git push` after `git commit`.** This came
  up in the current session — he committed, asked why the change
  wasn't visible, and the answer was "Vercel only deploys what's on
  origin." If you give him an `add/commit/push` block, keep all three
  commands together.
- **Always pair migrations with `NOTIFY pgrst, 'reload schema';`.**
  Without it, PostgREST's schema cache stays stale and `supabase.from('newtable')` calls fail with "Could not find the table in the schema
  cache" — confusing because the table actually exists. We hit this on
  views (Phase 17d) and again on vendors (Phase 17h).

— end of handoff
