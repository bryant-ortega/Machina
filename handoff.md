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
  through `0015`). Schema highlights:
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

1. **Phase 18 (slim) — inline payment tracking on Final budget.** The
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

2. **qty=0 → "remove on save" in the budget form.** Setting an
   expense row's qty to 0 (or blank) marks it for deletion: the row
   instantly fades + strikes-through with a "Will be removed on save"
   tooltip; the actual delete happens on Save. Existing rows get
   diffed-deleted server-side; new rows are filtered out before
   payload build. The Zod validator also rejects `qty <= 0` as a
   defense-in-depth — it shouldn't fire from the UI but catches
   bypasses with a clean inline error instead of the raw Postgres
   constraint message. See `budget-form.tsx` (`keptExpenses`,
   `willBeRemoved`) and `actions.ts` (`z.number().positive(...)`).

3. **Events index polish.**
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

4. **`payment_method` is now freeform text.** Migration `0011`
   dropped the original `('paypal','zelle','venmo','other')` CHECK
   constraint. Cash, check #1234, ACH, etc. all work. Column stays
   nullable — empty stored as NULL.

5. **DJ registration — orphan-account recovery (commit `5ad1096`).**
   When an auth user exists for an email but the `djs` row was deleted,
   re-submitting the registration form with the matching password now
   reclaims the account (re-inserts the `djs` row + fixes the `profiles`
   row). Wrong password → friendly amber error with reset/different-email
   options. Wrong role (e.g. existing admin user) → red error refusing to
   overwrite. See `src/app/register/dj/actions.ts` (`reclaimOrphanAccount`,
   `isEmailExistsError`) and the matching UI states in `registration-form.tsx`.

6. **Register page copy (commit `45498f5`).** Removed stale "we'll email a
   magic link" line — flow has been password-based for a while.

7. **Admin W-9 upload (commit `44b0c8b`).** New `uploadDjW9` server
   action + `<W9UploadButton>` client component, wired into the admin DJ
   detail page header. Writes to `w9s/{dj_user_id}/w9.pdf`, sets
   `w9_storage_path` + flips `w9_status` to `on_file`. Shows as "Upload W-9"
   when pending, "Replace W-9" when on file. Handles wrong type / too
   large / no linked user_id / etc.

8. **Admin nav polish (commits `248b232`, `34f7156`).** Desktop sidebar:
   skull-triangle logo + "Maquina" header, character face image above
   the nav, no "LosGothsCo Enterprise" subtext. Mobile top bar: hamburger
   + small logo + "Maquina". Mobile drawer: face image above nav (smaller
   than desktop), `overflow-y-auto` on nav so signout stays anchored.

9. **Login page.** Two-column layout on `sm+` (`goth-makima.webp` on the
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

- **BUILD_PLAN status.** Phases 0–17 plus a slim Phase 18 (inline
  Paid+Method on Final budget) are shipped. Remaining build-plan
  phases:
  - **Phase 19 — PayPal Payouts.** Needs Chase to set up a PayPal
    Business account + Payouts API approval + add `PAYPAL_CLIENT_ID`
    / `PAYPAL_CLIENT_SECRET` / `PAYPAL_MODE` to Vercel env vars
    before the code can be wired up.
  - **Phase 20 — Automated Emails + W-9 reminders.** Needs Chase to
    sign up at resend.com and add `RESEND_API_KEY` to Vercel before
    the code can be wired up. Includes a Vercel cron at
    `src/app/api/cron/w9-reminders/route.ts` (Mondays 9am).
- **Vendors / DJs self-registration form parity.** User wants a single
  form covering both vendors and DJs (currently only DJ flow exists).
  Schema for vendors not in the codebase yet.
- **New-event form with multiple "views".** User wants to enter event
  info once and generate different views/exports from it. Some views
  already exist under `(admin)/views/*` (month, year, posting calendar,
  DJ analytics). Centralized new-event form not yet started.
- **Automated emails with PDF attachments.** Hinted at by an existing
  "ROS email" feature in older commits (`19ae627`, `b1b1ccd`,
  `3b7e023`). User wants this expanded to more communication types
  (covered by Phase 20 above).
- **`(collab)` route group** exists but wasn't touched this session.
- **Migration consolidation / cleanup.** 15 migrations in the tree
  (0001–0015); review before adding new schema. Migration 0014 was
  deleted as part of the Phase 18 revert.

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

— end of handoff
