# LosGothsCo — Event Operations Platform

> Internal web application for managing events, DJs, vendors, budgets, and communications for LosGothsCo.

---

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Current State](#current-state)
- [Proposed Architecture](#proposed-architecture)
- [Tech Stack](#tech-stack)
- [Security](#security)
- [Database Schema](#database-schema)
- [Application Features](#application-features)
- [Autocomplete & Typeahead System](#autocomplete--typeahead-system)
- [View Builder System](#view-builder-system)
- [Manual Override System](#manual-override-system)
- [Payment Tracking & Payouts](#payment-tracking--payouts)
- [Automated Emails & PDFs](#automated-emails--pdfs)
- [User Roles & Access](#user-roles--access)
- [Data Migration](#data-migration)
- [Cost Breakdown](#cost-breakdown)
- [Roadmap](#roadmap)
- [Notes on Key Design Decisions](#notes-on-key-design-decisions)

---

## Overview

LosGothsCo is an event production company that books DJs, manages venues, coordinates vendors, and produces club nights, concerts, and festivals. This platform replaces a patchwork of Google Sheets and Apps Script automations with a purpose-built web application that centralizes all operational data and automates key workflows — from DJ onboarding to run-of-show generation to budget reporting.

The platform is built around a **flexible view system**: data is entered once, and admins can create any number of named views — each showing only the fields relevant to a specific audience or workflow. Views can be shared, emailed as PDFs, and edited on a per-event basis without affecting global defaults.

---

## Goals

### Primary Goals

1. **Single source of truth** — All event data, DJ rosters, vendor registrations, and financial projections live in one relational database across all years, rather than across multiple linked spreadsheets split by year.

2. **Streamlined onboarding** — Send a registration link to any DJ or vendor; they fill out a form and complete a magic link verification. No password required.

3. **One-entry event creation** — Fill out a single event intake form and automatically generate all downstream views: month calendar, year calendar, budget estimate, run of show, posting calendar, DJ analytics, and any custom views.

4. **Flexible view builder** — Create, customize, and share named views that surface only the data points relevant to a specific audience. Add or remove fields from any view at any time without touching code.

5. **Manual overrides** — Any auto-calculated or default value can be overridden for a specific event without affecting global settings.

6. **Automated communications** — Trigger emails manually to DJs, advance contacts, and partners with PDF attachments of any view, with the option to add additional attachments before sending.

7. **Financial visibility** — Real-time estimated and final profit/loss per event, including per-partner profit splits. Estimated and final budgets are saved separately and can be compared side by side.

8. **Expense payment tracking** — Every expense line has a payment status. PayPal payments can be triggered directly from the app and automatically marked paid with a transaction ID. Zelle and Venmo payments are marked paid manually.

9. **Limited admin access for partners** — A partner login with full read/write access to operational data (events, views, budgets, DJs, vendors) but blocked from destructive and financial actions: cannot delete events, manage team accounts, or trigger PayPal payouts. See [User Roles & Access](#user-roles--access) for the authoritative role definition.

10. **Smart data entry** — Autocomplete and typeahead on all relevant fields during event creation, and a read-only alphabetical DJ dropdown for slot assignment to prevent accidental duplicate entries.

11. **Security by design** — All sensitive data protected by row-level security, private encrypted storage, rate limiting, input sanitization, and audit logging.

### Secondary Goals

- Replace Google Forms with branded, purpose-built registration forms
- Store W-9 documents securely; automated weekly reminders sent to DJs without a W-9 on file
- Generate a run of show automatically from door time, end time, and booked DJ slots
- Support named stages per event (Main Stage, Additional Room, etc.)
- Provide DJ analytics showing booking frequency and confirmed event percentages by year
- Deduplicate existing DJ records during migration; enforce email uniqueness going forward
- Surface a posting calendar tied to event announce, on-sale, and art due dates, exportable to Apple Calendar, Google Calendar, and any compatible app

---

## Current State

LosGothsCo currently operates across three Google Sheets:

| Sheet | Purpose |
|---|---|
| **LosGothsCo Vendors** | DJ and vendor registry, fed by Google Forms |
| **Master Event Model** | Core event data across 2025–2026, with per-partner profit tabs |
| **Events Budget 2026** | Financial projections pulled from Master Event Model |

**Pain points with the current setup:**
- W-9 uploads not natively supported; stored as Google Drive links, many missing
- No automated W-9 follow-up; manual reminders required
- Duplicate DJ records (e.g. SoulCab ×3, Unholy ×2) with no deduplication mechanism
- Relational data (DJs ↔ Events ↔ Stages ↔ Slots) is fragile across linked sheets
- Year-over-year data split across separate tabs (MASTER 2025, MASTER 2026, etc.)
- No way to override a single value for one event without breaking formulas
- No est. vs. final budget comparison — estimates are overwritten with actuals
- No expense payment tracking — no visibility into what has and hasn't been paid
- No way to send payments through the system
- PDF generation and email automation require brittle Apps Script workarounds
- No access control for partners; profit split calculated manually per tab
- No mechanism to create audience-specific views
- No posting calendar tied to event dates
- No security controls — all data accessible to anyone with the sheet link

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                    │
│                                                         │
│  Next.js App                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Admin      │  │  Public      │  │  API Routes   │  │
│  │  Portal     │  │  Reg Forms   │  │  (PDF + Email)│  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                                    │          │
│  ┌──────▼──────────────────────────────────┐ │          │
│  │         View Builder Engine             │ │          │
│  │  (create views, toggle fields, share)   │ │          │
│  └─────────────────────────────────────────┘ │          │
└────────────────────────┬─────────────────────┼──────────┘
                         │                     │
┌────────────────────────▼─────────────────────▼──────────┐
│                   SUPABASE (Backend)                    │
│                                                         │
│  PostgreSQL Database   Auth    File Storage (Private)   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  profiles │ events │ djs │ venues │ vendors      │   │
│  │  slots  │ tix_tiers │ hospitality │ expenses     │   │
│  │  views  │ view_fields │ event_overrides          │   │
│  │  partners │ posting_calendar │ audit_log         │   │
│  │  event_budgets │ w9_reminders │ expense_payments │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │                              │
┌─────────▼────────┐          ┌──────────▼──────────────┐
│  RESEND (Email)  │          │  PAYPAL PAYOUTS API      │
│                  │          │                          │
│  react-pdf → PDF │          │  Automated payments to   │
│  Vercel Cron for │          │  DJs and vendors with    │
│  W-9 reminders   │          │  PayPal handles on file  │
└──────────────────┘          └─────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Reason | Cost |
|---|---|---|---|
| **Frontend & Routing** | Next.js 16 (App Router) | Full-stack React, API routes built in, Vercel-native | Free |
| **Hosting** | Vercel | Zero-config deploys, free tier covers all internal traffic | Free |
| **Database** | Supabase (PostgreSQL) | Relational DB, real-time, built-in auth, file storage | Free → $25/mo |
| **Authentication** | Supabase Auth | Magic link flow, role-based access | Included |
| **File Storage** | Supabase Storage | W-9 uploads, private encrypted buckets, path-based access | Included |
| **Email Delivery** | Resend | Developer-friendly, reliable deliverability | Free (3k/mo) |
| **Scheduled Jobs** | Vercel Cron | Weekly W-9 reminder emails | Free |
| **PDF Generation** | react-pdf | Server-side PDF rendering from React components | Free (OSS) |
| **Payment Payouts** | PayPal Payouts API | Automated payments to DJs/vendors with PayPal on file | Per-transaction fee |
| **Styling** | Tailwind CSS | Utility-first, fast to build, consistent design | Free (OSS) |
| **Language** | TypeScript | Type safety across frontend and backend | Free (OSS) |

**Projected monthly cost: $0 at launch. Scales to ~$65/mo at high volume.**
**PayPal Payouts: per-transaction fee applies — verify current pricing and business account requirements at time of setup.**

---

## Security

Security is implemented in layers — at the database, server, network, and application levels.

### Layer 1 — Database: Row-Level Security (RLS)

Every table in Supabase has RLS policies enforced at the PostgreSQL engine level. These policies are keyed to the **`anon` key** — the key used by the browser. With RLS in place, the `anon` key can only access rows the authenticated user's role is explicitly permitted to see. A DJ logged in via the `anon` key cannot query other DJs' records, events, or financials — the database refuses the query before it executes.

**Important distinction:** The `service_role` key **bypasses RLS entirely** and has unrestricted access to all data. This key is the most sensitive secret in the system. It is never exposed to the browser, never included in client-side code, and only used inside Vercel serverless API routes that run server-side. If the `service_role` key were compromised, all data would be accessible — which is why it is treated with the same care as a root password and stored exclusively as a server-side environment variable.

Example RLS policies:
- DJs can only read and write their own `djs` row and their own `profiles` row
- Admin and Partner roles can read all event, DJ, and vendor records
- Financial data (budgets, partner splits, pay handles, payments) is restricted to Admin role only for write operations; Partner can read but not trigger payments

### Layer 2 — Authentication: Magic Link + Email Verification

- All users authenticate via **magic link** — a one-time sign-in link sent to their email by Supabase Auth
- No passwords are created or stored anywhere in the system
- Clicking the magic link verifies email ownership and establishes an authenticated session with a signed JWT
- Tokens expire and must be refreshed — no permanent session tokens
- **Email uniqueness** is enforced by Supabase Auth — duplicate registrations with the same email are rejected at the Auth level

### Layer 3 — API Keys: Precise Scope

| Key | Where Used | What It Can Do |
|---|---|---|
| `anon` key | Browser / client-side | Only what RLS policies explicitly permit for the authenticated user |
| `service_role` key | Server-side API routes only | Full database access; bypasses RLS; treated as a root secret |
| PayPal API credentials | Server-side API routes only | Initiate payouts; never exposed client-side |

The security guarantee is not that all keys are safe if leaked — it is that the dangerous key (`service_role`) is architecturally prevented from ever reaching the client.

### Layer 4 — Server-Side Secrets: Environment Variables

All secrets (Supabase URL, both API keys, Resend API key, PayPal client ID and secret) are stored as Vercel environment variables. They are never hardcoded in the codebase, never committed to git, and never bundled into client-side JavaScript.

### Layer 5 — Transport Security: HTTPS

Vercel enforces HTTPS on all routes. All data in transit is encrypted via TLS. No HTTP fallback.

### Layer 6 — File Storage: Private Buckets + On-Demand Signed URLs

- W-9 files are stored in a **private Supabase Storage bucket** using an internal storage path (e.g. `w9s/dj-uuid/w9.pdf`) — never a public URL
- Files are **never publicly accessible** — even knowing the storage path returns a permissions error without a valid signed URL
- **Signed URLs are generated on demand, server-side**, at the moment a file needs to be accessed. They expire after 60 minutes. Signed URLs are never stored in the database — only the storage path is stored
- File type and size are validated **server-side** before any upload is accepted — only PDFs under a defined size limit are allowed
- Malicious file uploads are rejected at the API route level before reaching storage

### Layer 7 — Rate Limiting

- `/register/dj` and `/register/vendor` — max 5 submissions per IP per hour
- `/api/email` — max 20 sends per admin session per hour
- `/api/payments` — max 50 payouts per admin session per hour
- Login / magic link requests — rate limited by Supabase Auth built-in controls

### Layer 8 — Admin Portal Obscurity

Admin portal routes return **404 to unauthenticated users**, not a login page. Bots and crawlers scanning for admin panels find nothing.

### Layer 9 — Input Sanitization

- **SQL injection** — prevented by Supabase's parameterized queries; no raw SQL is ever constructed from user input
- **XSS** — prevented by React's default output escaping; any fields that render HTML use an explicit allowlist sanitizer

### Layer 10 — CSRF Protection

The app uses **SameSite=Strict cookies** for session management. This instructs the browser to never send session cookies on cross-site requests, which is the primary defense against CSRF attacks. Origin header validation provides a secondary layer. Next.js with Supabase's cookie-based Auth implements this pattern by default. Together these are sufficient for this application's threat model.

### Layer 11 — Audit Logging

Every write operation — including all payment events — is logged to the `audit_log` table: who, what action, which record, before/after values, and timestamp. If data is tampered with or an account is compromised, there is a full forensic trail.

### Layer 12 — Dependency Security

GitHub Dependabot is configured for automated CVE scanning of all npm dependencies. Vulnerable packages trigger a pull request with the fix.

### Sensitive Data Protection Summary

| Data | Protections |
|---|---|
| W-9 files | Private bucket, storage path only in DB, on-demand signed URLs (60 min expiry), server-side validation, RLS |
| DJ government names | RLS (admin only for write, partner read) |
| Pay handles | RLS (admin/partner read), server-side only in payment flows, never client-side |
| Payment transaction IDs | RLS (admin only), audit logged |
| Event financials | RLS (admin/partner) |
| Partner profit splits | RLS (admin/partner), excluded from all shared/public views |
| `service_role` key | Server-side env var only, never in client code or git |
| Admin portal | 404 to unauthenticated users, magic link required |
| All traffic | HTTPS / TLS |
| Login | Magic link (no passwords), email uniqueness enforced, Auth rate limiting |
| All writes | Input sanitized, SameSite=Strict + origin validation, audit logged |

### Out of Scope for V1

- **2FA / MFA** — Supabase Auth supports it; optional add-on for V2
- **Penetration testing** — appropriate for financial institutions; not required here
- **SOC 2 compliance** — Supabase is SOC 2 certified; inherited
- **Additional encryption at rest** — Supabase encrypts all data at rest by default

---

## Database Schema

### Notes on FK References

- **`FK → auth.users`** — references Supabase's internal `auth.users` table directly. Used where only the Auth identity is needed (e.g. linking a DJ record to their Auth account).
- **`FK → profiles`** — references the app-level `profiles` table. Used where role, display name, or status is needed alongside the identity.
- A database trigger on `auth.users` INSERT automatically creates a corresponding `profiles` row for every new user.

---

### `profiles`
App-level user profile extending `auth.users`. Created automatically via trigger on new Auth user registration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | Matches `auth.users.id` |
| user_id | uuid | UNIQUE, FK → auth.users, NOT NULL | One profile per Auth account |
| role | varchar | NOT NULL | `admin`, `partner`, `dj`, `vendor` |
| display_name | varchar | NOT NULL | DJ stage name, admin name, etc. |
| status | varchar | NOT NULL, DEFAULT `active` | `active` or `suspended` |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### `events`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| year | int | NOT NULL | Derived from date |
| date | date | NOT NULL | |
| event_id | varchar | UNIQUE, NOT NULL | Created date + city e.g. `20260315-LA` |
| weekend_number | int | NOT NULL, CHECK (1–5) | Weekend # of the month |
| weekend_flag | varchar | NOT NULL | `good` or `warning` |
| day_of_week | varchar | NOT NULL | Derived from date |
| title | varchar | NOT NULL | |
| type | varchar | NOT NULL | `club`, `concert`, `festival` |
| venue_id | uuid | FK → venues, NULLABLE | Left blank if not yet set |
| city | varchar | NOT NULL | |
| state | varchar | NOT NULL | |
| status | varchar | NOT NULL, DEFAULT `tentative` | `tentative` or `confirmed` |
| collab | boolean | NOT NULL, DEFAULT false | |
| stages | int | NOT NULL, DEFAULT 1, CHECK (1–4) | |
| doors_time | time | NOT NULL | |
| end_time | time | NOT NULL | |
| capacity | int | CHECK (> 0) | |
| guarantee | boolean | DEFAULT false | |
| bar_included | boolean | DEFAULT false | |
| rent | numeric | CHECK (>= 0) | |
| split_pct | numeric | CHECK (0–100) | LosGothsCo % of door |
| venue_tix_fee | numeric | CHECK (>= 0) | |
| advance_contact_email | varchar | | |
| advance_contact_phone | varchar | | |
| announce_date | date | | Auto-calculated |
| begin_art_date | date | | Auto-calculated |
| art_due_date | date | | Auto-calculated |
| on_sale_date | date | | Auto-calculated |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| created_by | uuid | FK → profiles | |

---

### `profiles` ← already defined above

---

### `djs`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | UNIQUE, NOT NULL, FK → auth.users | One DJ record per Auth account |
| dj_name | varchar | NOT NULL | Stage name |
| government_name | varchar | NOT NULL | Legal name for W-9/tax |
| phone | varchar | | |
| email | varchar | UNIQUE, NOT NULL | Must match Auth account email |
| pay_method | varchar | CHECK (`zelle`,`venmo`,`paypal`) | |
| pay_handle | varchar | | Zelle number, Venmo handle, or PayPal email |
| region | varchar | NOT NULL | `SoCal`, `NorCal`, `Chicago`, `Arizona`, `Seattle`, `Other` |
| w9_storage_path | varchar | | Internal Supabase Storage path e.g. `w9s/dj-uuid/w9.pdf`; signed URL generated on demand |
| w9_status | varchar | NOT NULL, DEFAULT `pending` | `pending` or `on_file` |
| rank | varchar | | Used to calculate rate |
| registered_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### `w9_reminders`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| dj_id | uuid | UNIQUE, NOT NULL, FK → djs | One reminder record per DJ |
| last_sent_at | timestamptz | | |
| reminder_count | int | NOT NULL, DEFAULT 0, CHECK (>= 0) | |
| stopped_at | timestamptz | | Set when DJ uploads W-9; reminders cease |

---

### `event_stages`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| stage_number | int | NOT NULL, CHECK (1–4) | |
| stage_name | varchar | NOT NULL | e.g. `Main Stage`, `Additional Room` |
| | | UNIQUE (event_id, stage_number) | No duplicate stage numbers per event |

---

### `event_dj_slots`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| stage_id | uuid | NOT NULL, FK → event_stages | |
| slot_order | int | NOT NULL, CHECK (1–6) | |
| dj_id | uuid | NOT NULL, FK → djs | |
| slot_type | varchar | NOT NULL | `open`, `support_1`, `support_2`, `main_support`, `headline`, `close` |
| rate | numeric | CHECK (>= 0) | Auto-calculated from slot_type + DJ rank; overridable |
| start_time | time | | Auto-calculated; overridable |
| end_time | time | | Auto-calculated; overridable |
| | | UNIQUE (event_id, stage_id, slot_order) | No duplicate slot positions per stage per event |

---

### `venues`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar | NOT NULL | |
| address | varchar | | |
| city | varchar | NOT NULL | |
| state | varchar | NOT NULL | |

---

### `vendors`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar | NOT NULL | |
| email | varchar | UNIQUE, NOT NULL | |
| phone | varchar | | |
| type | varchar | | e.g. Robot, 360 Video, Experience |
| pay_method | varchar | CHECK (`zelle`,`venmo`,`paypal`) | |
| pay_handle | varchar | | |
| w9_storage_path | varchar | | Internal Supabase Storage path; signed URL generated on demand |
| w9_status | varchar | NOT NULL, DEFAULT `pending` | `pending` or `on_file` |
| registered_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### `partners`
Company-level owners. Profit split percentages must sum to 100 across all rows — enforced at application level on save and via a Postgres trigger that rejects any update that would cause the sum to deviate from 100.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar | NOT NULL | e.g. `Elvis`, `Chase` |
| user_id | uuid | UNIQUE, NOT NULL, FK → auth.users | |
| profit_split_pct | numeric | NOT NULL, CHECK (> 0 AND <= 100) | All rows must sum to 100; enforced by app + Postgres trigger |

---

### `event_budgets`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| budget_type | varchar | NOT NULL | `estimated` or `final` |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |
| created_by | uuid | NOT NULL, FK → profiles | |
| | | UNIQUE (event_id, budget_type) | Only one estimated and one final budget per event |

---

### `event_budget_expenses`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| budget_id | uuid | NOT NULL, FK → event_budgets | |
| category | varchar | NOT NULL | `digital`, `consumables`, `travel`, `transportation`, `vendors`, `staff`, `djs` |
| item | varchar | NOT NULL | |
| qty | numeric | NOT NULL, DEFAULT 1, CHECK (> 0) | |
| price | numeric | NOT NULL, DEFAULT 0, CHECK (>= 0) | |
| total | numeric | GENERATED (qty × price) | Computed column |
| payment_status | varchar | NOT NULL, DEFAULT `unpaid` | `unpaid`, `partial`, `paid` |
| payment_method | varchar | CHECK (`paypal`,`zelle`,`venmo`,`other`) | Nullable until paid |
| payee_type | varchar | CHECK (`dj`,`vendor`,`other`) | |
| payee_id | uuid | NULLABLE | FK → djs or vendors depending on payee_type |

---

### `expense_payments`
Immutable record of every payment event. Rows are never updated — a new row is written for each payment or failure.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| expense_id | uuid | NOT NULL, FK → event_budget_expenses | |
| payment_method | varchar | NOT NULL, CHECK (`paypal`,`zelle`,`venmo`,`other`) | |
| amount | numeric | NOT NULL, CHECK (> 0) | Must not cause cumulative payments to exceed expense total — enforced at application level |
| paypal_transaction_id | varchar | | Populated automatically for PayPal payouts |
| paypal_batch_id | varchar | | PayPal payout batch reference |
| paid_at | timestamptz | NOT NULL, DEFAULT now() | |
| paid_by | uuid | NOT NULL, FK → profiles | Admin who triggered or recorded the payment |
| note | varchar | | e.g. "Zelle sent to 310-555-0123" |
| status | varchar | NOT NULL | `pending`, `confirmed`, `failed` |

---

### `event_budget_income`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| budget_id | uuid | NOT NULL, FK → event_budgets | |
| income_type | varchar | NOT NULL | `tickets`, `bar`, `merch`, `sponsor`, `vendor` |
| label | varchar | NOT NULL | e.g. `Tier 1`, `Bar Gross`, `Merch Net` |
| value | numeric | NOT NULL, DEFAULT 0, CHECK (>= 0) | |

---

### `event_tix_tiers`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| budget_id | uuid | NOT NULL, FK → event_budgets | |
| tier_number | int | NOT NULL, CHECK (1–8) | |
| price | numeric | NOT NULL, CHECK (>= 0) | Before venue fee |
| sold | int | NOT NULL, DEFAULT 0, CHECK (>= 0) | |
| total | numeric | GENERATED (sold × price) | Computed column |
| | | UNIQUE (budget_id, tier_number) | No duplicate tiers per budget |

---

### `event_hospitality`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| item | varchar | NOT NULL | |
| quantity | int | NOT NULL, CHECK (> 0) | |
| cost | numeric | NOT NULL, CHECK (>= 0) | |

---

### `event_partners`
Event-specific contacts (not the same as company partners).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| name | varchar | NOT NULL | |
| email | varchar | | |
| phone | varchar | | |

---

### `event_vendors`
Junction table linking events to registered vendors.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| event_id | uuid | NOT NULL, FK → events | |
| vendor_id | uuid | NOT NULL, FK → vendors | |
| | | PRIMARY KEY (event_id, vendor_id) | No duplicate vendor per event |

---

### `event_sponsors`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| name | varchar | NOT NULL | |
| income | numeric | NOT NULL, DEFAULT 0, CHECK (>= 0) | |

---

### `views`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar | NOT NULL | |
| description | varchar | | |
| audience | varchar | NOT NULL | `internal`, `designer`, `venue`, `dj`, `partner`, `other` |
| is_system | boolean | NOT NULL, DEFAULT false | System views cannot be deleted |
| created_by | uuid | NOT NULL, FK → profiles | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### `view_fields`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| view_id | uuid | NOT NULL, FK → views | |
| field_key | varchar | NOT NULL | Canonical field identifier |
| label | varchar | NOT NULL | Display label, overridable per view |
| position | int | NOT NULL, CHECK (>= 0) | |
| visible | boolean | NOT NULL, DEFAULT true | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| | | UNIQUE (view_id, field_key) | No duplicate fields per view |

---

### `event_overrides`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| field_key | varchar | NOT NULL | |
| original_value | jsonb | NOT NULL | |
| override_value | jsonb | NOT NULL | |
| override_reason | varchar | | |
| overridden_by | uuid | NOT NULL, FK → profiles | |
| overridden_at | timestamptz | NOT NULL, DEFAULT now() | |
| | | UNIQUE (event_id, field_key) | One active override per field per event |

---

### `event_view_customizations`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| event_id | uuid | NOT NULL, FK → events | |
| view_id | uuid | NOT NULL, FK → views | |
| field_key | varchar | NOT NULL | |
| visible | boolean | | |
| label | varchar | | |
| position | int | CHECK (>= 0) | |
| created_by | uuid | NOT NULL, FK → profiles | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| | | UNIQUE (event_id, view_id, field_key) | One customization per field per view per event |

---

### `audit_log`
Append-only. Rows are never updated or deleted.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | NOT NULL, FK → auth.users | |
| user_role | varchar | NOT NULL | `admin`, `partner`, `dj`, `vendor` |
| action | varchar | NOT NULL | `create`, `edit`, `delete`, `override`, `email_sent`, `file_uploaded`, `payment_initiated`, `payment_confirmed`, `payment_failed` |
| table_name | varchar | NOT NULL | |
| record_id | uuid | | |
| payload | jsonb | | Before/after snapshot of changed fields |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

## Application Features

### DJ Registration Flow

DJ registration is a two-step process. No password is ever created.

1. DJ visits `/register/dj` and fills out the form (W-9 upload optional)
2. On submit, a Supabase Auth account is created and a **magic link** is sent to their email
3. DJ clicks the magic link in their inbox — this verifies their email and establishes their authenticated session
4. DJ is redirected to their profile page where they can upload a W-9 if they did not at registration
5. `profiles` row is auto-created by database trigger with `role: dj`
6. Confirmation email sent via Resend after verification

If a DJ tries to register with an email already in the system, they receive a message: *"This email is already registered. Check your inbox for a magic link or request a new one."* No new account is created.

---

### Public-Facing (No Login Required to Submit Form)

#### `/register/dj` — DJ Registration Form
- DJ Name, Government Name, Phone, Email
- Pay Method (Zelle, Venmo, PayPal) + Pay Handle
- Region dropdown (SoCal, NorCal, Chicago, Arizona, Seattle, Other)
- W-9 upload — optional; stored to private bucket by storage path
- Rate limited: 5 submissions per IP per hour
- On submit: Supabase Auth magic link sent to email for verification

#### `/register/vendor` — Vendor Registration Form
- Business name, contact name, email, phone, vendor type
- Pay Method + Pay Handle
- W-9 upload — optional
- Rate limited: 5 submissions per IP per hour
- Magic link sent for verification

---

### DJ-Authenticated Pages (Magic Link Required)

#### `/dj/upload-w9` — W-9 Upload
- Linked from weekly reminder emails
- On upload: `w9_storage_path` set, `w9_status` → `on_file`, `w9_reminders.stopped_at` set, reminders stop

#### `/dj/profile` — DJ Profile (Read-Only)
- View own registration details
- View W-9 status and upload new W-9

---

### Admin Portal (Admin or Partner Role Required)

Admin portal routes return **404 to unauthenticated users**.

#### `/events/new` — New Event Intake Form
- Date, venue (autocomplete, nullable), title, type, city, state, status (Tentative / Confirmed)
- Auto-calculated dates (all overridable)
- Collab toggle + partner contacts (autocomplete)
- Named stages + DJ slot assignment (alphabetical read-only A–Z dropdown)
- Deal, ticket tiers, capacity, doors, end time, soundchecks
- Hospitality, vendors, sponsors
- Estimated budget auto-created on save

#### `/events/[id]/edit` — Edit Event
- All fields editable by Admin and Partner
- ⚙ Auto / ✏ Override badge system for calculated fields

#### `/djs` — DJ Roster (Admin + Partner)
- Full list sorted A–Z with W-9 status indicators
- Region filter, year filter
- Missing W-9 alert banner when any booked DJ has `w9_status: pending`

#### `/djs/[id]` — DJ Profile (Admin Editable)
- All DJ registration fields are **editable by Admin** through this page
- Changes are audit logged
- W-9 download via on-demand signed URL (60 min expiry)
- Booking history across all years
- Event count and confirmed event % for current year
- Partner role: read-only view

---

### Budget System

#### Two Saved Records Per Event
- **Estimated** — created automatically on event save; editable anytime; never overwritten by final
- **Final** — created via **Actualize Event** after the event; pre-populated from estimated; edited with real actuals

#### Budget View Toggle
- **Est.** / **Final** / **Compare** (side-by-side with Δ variance column per line)

#### Budget Fields

**Expenses** (qty × price = total; payment status per line)
- DJs: Opener, Support 1, Support 2, Main Support, Headliner, Closer
- Digital: Flyer, IG Ads
- Consumables: Balloons, Helium Tank, Glow Sticks, Fog Juice, Distilled Water
- Travel: Hotels, Meals
- Transportation: Fuel per Vehicle, Car Rental, Flights, Tolls
- Vendors: Robot, 360 Video, Experience 1, Experience 2
- Staff: Production Manager, Production Assistant, Videographer 1, Videographer 2, Photographer 1, Photographer 2
- Rent

**Income**
- Ticket tiers 1–8, drop-off, guests, paid attendance, gross tix total, LosGothsCo tix net
- Bar (if included): bar gross (paid attendance × $24 default), LosGothsCo bar (16% default)
- Merch: gross ($0.36 × paid attendance), after fees (−3%), COGS (×35%), seller fee ($120 default), net
- Sponsor income (default $0), Vendor income (default $0)

**Summary**
- Walkout, Est. Income, Est. Profit
- Partner split: name, %, dollar amount per partner

---

## Autocomplete & Typeahead System

### Type 1 — Registry Autocomplete
| Field | Source |
|---|---|
| Venue Name | `venues` table |
| Vendor selection | `vendors` table |
| Sponsor selection | Historical `event_sponsors` |
| Partner contacts | Historical `event_partners` |

### Type 2 — Historical Autocomplete
| Field | Source |
|---|---|
| City | Distinct cities from `events` |
| Hospitality items | Distinct items from `event_hospitality` |
| Expense line item names | Distinct items from `event_budget_expenses` |
| Stage names | Distinct names from `event_stages` |
| Sponsor names | Distinct names from `event_sponsors` |

### DJ Slot Assignment
Sorted A–Z dropdown of all registered DJs. Read-only — prevents accidental duplicate entries during event creation. Legitimate DJ record edits are done through `/djs/[id]` by an Admin.

Suggestions appear after 2+ characters, max 8 results, dismiss on selection or Escape.

---

## View Builder System

### `/views` — View List
System views + custom views. System views cannot be deleted; fields can be toggled. Actions: Edit, Preview, Share / Email, Duplicate, Delete (custom only).

### Field Picker Categories

| Category | Example Fields |
|---|---|
| **Event** | Title, Date, Day, City, State, Venue, Type, Status, Weekend # |
| **Dates** | Announce, Begin Art, Art Due, On Sale |
| **Deal** | Guarantee, Bar Included, Rent, Split %, Venue Tix Fee |
| **Capacity** | Capacity, Doors, End |
| **Stages** | Stage Name, Stage Number |
| **DJ Slots** | Stage, Slot Type, DJ Name, Rate, Start, End |
| **Ticket Tiers** | Tier 1–8 Price, Sold, Total |
| **Financials** | Est. Expenses, Est. Income, Est. Profit, Walkout, Final Profit, Variance |
| **Payment Status** | Expense Item, Amount, Payment Status, Method, Paid At |
| **Partner Splits** | Partner Name, Split %, Partner Amount (admin/partner only) |
| **Hospitality** | Item, Quantity, Cost |
| **Contacts** | Advance Contact Email/Phone, Partner Name/Email/Phone |
| **Vendors** | Vendor Name, Vendor Type |
| **Sponsors** | Sponsor Name, Sponsor Income |
| **Run of Show** | Load-In, Soundcheck, Doors, Opener, Headliner, Closer, etc. |
| **Posting Calendar** | Announce Date, On Sale Date, Art Due Date, Begin Art Date |
| **DJ Analytics** | DJ Name, Region, Event Count, Confirmed Event % |
| **Budget** | Est. Budget, Final Budget, Variance |

### Field Controls
Drag to reorder, toggle visibility, rename label (per view only), remove.

### Per-Event View Customization
Customize any view for one event without affecting the global template. Customized badge + Reset to Default.

---

## Built-In System Views

### Month View — `/views/month`
Toggle confirmed only. Ordered by Weekend #. Date, Day, Title, Venue, City, State, Status.

### Year View — `/views/year`
Year selector. Toggle confirmed only. Jan–Dec.

### Year w/ Profit — `/views/year-profit`
Confirmed events. Est. Profit + per-partner split amounts. Year selector.

### Month w/ Profit — `/views/month-profit`
Month + year selector. Per-partner columns (admin/partner only).

### Posting Calendar — `/views/posting-calendar`
Action dates across all events. Calendar and list view. `.ics` export and webcal subscribe link. Compatible with Apple Calendar, Google Calendar, Outlook, and any standards-compliant calendar app.

### Budget — `/views/budget`
Toggle: Est. / Final / Compare with Δ variance per line. Payment status visible per expense line.

### Run of Show — `/views/runofshow`
Per named stage. All times auto-calculated and overridable per event.

| Slot | Default |
|---|---|
| LosGothsCo Load-In | Doors − 3 hr |
| DJs Load-In | Doors − 1.5 hr |
| Soundcheck Start | Doors − 1 hr |
| Soundcheck End | Doors − 10 min |
| **Doors** | — |
| Opener | Doors |
| Support 1 | Doors + 1 hr |
| Support 2 | Doors + 2 hr |
| Main Support | End − 3 hr |
| Headliner | End − 2 hr |
| Closer | End − 1 hr |
| End / Load-Out | End |
| LosGothsCo Out | End + 30 min |

### DJ Analytics — `/views/dj-analytics`
DJ Name, Region, Events Booked, Confirmed Event %. Year selector.

---

## Manual Override System

### What Can Be Overridden
| Field | Auto Source |
|---|---|
| DJ Rate | Slot type × DJ rank lookup |
| Soundcheck times | Doors − 1 hr / Doors − 10 min |
| Run of Show slot times | Doors and End calculations |
| Announce / Art / On Sale dates | Event type and announce date |
| Bar per-head rate | Global default ($24) |
| LosGothsCo bar % | Global default (16%) |
| Merch per-head rate | Global default ($0.36) |
| Merch seller fee | Global default ($120) |
| Paid attendance estimate | Global default (500) |
| Any expense qty or price | User-entered |
| Deductions | Default $0 |
| Sponsor / Vendor income | Default $0 |

### Override Audit Log — `/settings/overrides`
Full log: field, original → override, reason, who, when.

---

## Payment Tracking & Payouts

Every expense line item has a payment status. Payments can be made through the app via PayPal or marked manually for any other method.

### Payment Status Per Expense Line

| Status | Meaning |
|---|---|
| `unpaid` | Default; no payment made |
| `partial` | Deposit or partial amount paid; balance outstanding |
| `paid` | Fully paid |

### PayPal Payouts (Automated)

For expense lines linked to a DJ or vendor with a PayPal handle on file:

1. Admin clicks **Pay via PayPal**
2. Confirmation modal: payee name, PayPal handle, amount
3. Admin confirms
4. App calls PayPal Payouts API server-side using server-only credentials
5. PayPal processes and returns a transaction ID
6. `payment_status` automatically updates; `expense_payments` record created with transaction ID, timestamp, and admin ID
7. Audit logged

On failure: `payment_status` remains `unpaid`; failure reason logged to `expense_payments` with `status: failed`; admin shown error.

**Setup required:** PayPal Business account and Payouts API access (separate application to PayPal). Verify current pricing, fee structure, and approval process directly with PayPal at time of setup.

### Manual Payment Marking (Zelle, Venmo, Other)

1. Admin clicks **Mark as Paid**
2. Modal: payment method, amount, date, optional note (e.g. "Zelle sent to 310-555-0123")
3. `payment_status` updates to `paid` or `partial`; `expense_payments` record created
4. Audit logged

### Why Zelle and Venmo Cannot Be Automated
- **Zelle** — No developer API. Bank-to-bank only. Cannot be integrated programmatically.
- **Venmo** — Consumer product only. No public API for sending payments.

Both are external-only. Manual mark-paid is the only option.

### Payment Overage Protection
Application logic prevents cumulative payments from exceeding the expense line total before any payment is submitted. The check runs server-side before calling PayPal or writing a manual payment record.

### `/events/[id]/payments` — Payment Summary Page
All expense lines grouped by category. Payment status per line. Pay via PayPal / Mark as Paid buttons. Summary totals: paid, outstanding, partial. Filter by status. Exportable as PDF.

---

## Automated Emails & PDFs

| Trigger | Recipients | Attachment | Notes |
|---|---|---|---|
| DJ registered + verified | DJ (self) | Registration confirmation PDF | Sent after magic link verification |
| Vendor registered + verified | Vendor (self) | Registration confirmation PDF | Sent after magic link verification |
| W-9 reminder (weekly Vercel Cron) | DJs with `w9_status: pending` | None | Link to `/dj/upload-w9`; stops automatically on upload |
| Manual trigger | Any email | Any view as PDF | Compose modal with preview; option to add additional file before sending |

### Manual Email Compose Modal
Recipient(s), subject, message, PDF preview of selected view. **+ Add Attachment** for additional file. Rate limited to 20 sends per admin session per hour.

---

## User Roles & Access

This table is the authoritative definition of role capabilities. Goal #9 describes Partner as "limited admin" — this table defines what that means precisely.

| Capability | Admin | Partner | DJ |
|---|---|---|---|
| Create / edit events | ✅ | ✅ | ❌ |
| Delete events | ✅ | ❌ | ❌ |
| View all events and views | ✅ | ✅ | ❌ |
| Create / edit custom views | ✅ | ✅ | ❌ |
| View budget (est. + final) | ✅ | ✅ | ❌ |
| View partner profit splits | ✅ | ✅ (own split) | ❌ |
| Trigger PayPal payouts | ✅ | ❌ | ❌ |
| Mark expenses paid manually | ✅ | ❌ | ❌ |
| View payment history | ✅ | ✅ | ❌ |
| Edit DJ profiles | ✅ | ❌ | ❌ |
| View DJ roster | ✅ | ✅ | ❌ |
| Manage team / invite users | ✅ | ❌ | ❌ |
| Configure partner splits | ✅ | ❌ | ❌ |
| Trigger manual emails | ✅ | ✅ | ❌ |
| Upload W-9 | ❌ | ❌ | ✅ (own only) |
| View own DJ profile | ❌ | ❌ | ✅ |

- Auth via Supabase Auth magic link; no passwords
- Email verification required before account is active
- RLS enforced at database level for all roles
- Partner invited via `/settings/team`; access revocable at any time
- Partner split % configured at `/settings/partners` by Admin only

---

## Data Migration

1. **Phase 1 — DJ Registry**
   - Resolve duplicates manually before migration
   - Import to `djs` table; `w9_storage_path` populated by re-uploading files from Google Drive to Supabase private Storage
   - `w9_status` set based on successful file migration
   - `profiles` row created for each DJ (role: dj)

2. **Phase 2 — Event Data**
   - Export MASTER 2025 + MASTER 2026 → single `events` table
   - Map slot columns → `event_dj_slots`; venues → `venues`

3. **Phase 3 — Budget Data**
   - Export Events Budget 2026 → `event_budgets` (type: `estimated`) + line item tables
   - All migrated expense lines default to `payment_status: unpaid`
   - Map partner rows → `partners` table

4. **Phase 4 — Deprecation**
   - Deprecate Apps Script; Google Sheets become read-only archive

---

## Cost Breakdown

| Service | Free Tier | Paid Plan |
|---|---|---|
| Supabase | 500MB DB, 1GB storage, 50k MAU | $25/mo |
| Vercel | Unlimited projects, 100GB bandwidth | $20/mo |
| Resend | 3,000 emails/month | $20/mo |
| PayPal Payouts | N/A | Per-transaction — verify at setup |
| **Total (excl. PayPal)** | **$0/month** | **~$65/month** |

---

## Roadmap

### Phase 1 — Foundation
- [ ] Initialize Next.js + Supabase project
- [ ] Configure RLS policies on all tables
- [ ] Configure Supabase Storage private bucket (path-based, no stored signed URLs)
- [ ] `profiles` table + auto-create trigger on `auth.users` insert
- [ ] Postgres trigger to validate `partners.profit_split_pct` sum = 100
- [ ] Configure Dependabot
- [ ] DJ registration form (W-9 optional, email unique, rate limited, magic link flow)
- [ ] Vendor registration form (pay method + handle, magic link flow)
- [ ] `/dj/upload-w9` and `/dj/profile` authenticated pages
- [ ] Supabase Auth with Admin and Partner roles
- [ ] Partner invite flow at `/settings/team`
- [ ] Partner profit split at `/settings/partners`

### Phase 2 — Event Management
- [ ] Event intake form with autocomplete and DJ alphabetical dropdown
- [ ] Named stage support with composite unique constraint
- [ ] Event status: Tentative / Confirmed
- [ ] Per-event edit with override system (⚙ Auto / ✏ Override)
- [ ] Estimated budget auto-created on event save
- [ ] Month View and Year View (multi-year, year selector)

### Phase 3 — Budget System
- [ ] Full budget view with income/expense lines and partner split
- [ ] Payment status field per expense line
- [ ] Actualize Event → Final budget record (UNIQUE constraint enforces one per event)
- [ ] Budget toggle: Est. / Final / Compare with Δ variance
- [ ] Year w/ Profit and Month w/ Profit with partner columns

### Phase 4 — Payment Tracking & Payouts
- [ ] PayPal Business account + Payouts API setup (verify requirements at time of build)
- [ ] PayPal Payouts server-side integration with overage protection
- [ ] Manual Mark as Paid flow
- [ ] Payment history panel per expense line
- [ ] `/events/[id]/payments` summary page with PDF export
- [ ] Payment events in audit log

### Phase 5 — DJ Management
- [ ] DJ roster with W-9 status indicators
- [ ] `/djs/[id]` admin-editable DJ profile with audit logging
- [ ] Vercel Cron weekly W-9 reminders; auto-stop on upload

### Phase 6 — View Builder
- [ ] View list with system + custom views
- [ ] Field Picker with all categories
- [ ] Per-event view customization
- [ ] View sharing: email compose modal with PDF preview and additional attachment option

### Phase 7 — Operations Views
- [ ] Run of Show (named stages, Doors row, per-event overrides)
- [ ] Posting Calendar with `.ics` export and webcal subscribe link
- [ ] DJ Analytics with year selector

### Phase 8 — Automation & Security Hardening
- [ ] react-pdf templates for all view types
- [ ] Resend email with rate limiting
- [ ] Audit log across all write and payment operations
- [ ] Input sanitization on all user-submitted fields
- [ ] SameSite=Strict cookie configuration + origin header validation
- [ ] Admin portal 404 for unauthenticated users
- [ ] Override audit log at `/settings/overrides`

### Phase 9 — Polish & Migration
- [ ] Import historical data (2025 + 2026)
- [ ] W-9 file migration: re-upload from Google Drive to Supabase Storage; store paths
- [ ] All migrated expense lines set to `payment_status: unpaid`
- [ ] End-to-end testing
- [ ] Deprecate Google Sheets / Apps Script

### Phase 10 — V2 (Future)
- [ ] 2FA / MFA for admin accounts
- [ ] Vendor scoped logins

---

## Repository Structure (Planned)

```
losgoths-app/
├── app/
│   ├── (admin)/
│   │   ├── events/
│   │   │   ├── new/
│   │   │   ├── [id]/
│   │   │   │   ├── edit/
│   │   │   │   ├── budget/
│   │   │   │   ├── payments/
│   │   │   │   ├── runofshow/
│   │   │   │   └── views/[view_id]/
│   │   ├── views/
│   │   │   ├── new/
│   │   │   ├── [id]/edit/
│   │   │   ├── month/
│   │   │   ├── year/
│   │   │   ├── year-profit/
│   │   │   ├── month-profit/
│   │   │   ├── budget/
│   │   │   ├── runofshow/
│   │   │   ├── posting-calendar/
│   │   │   └── dj-analytics/
│   │   ├── djs/
│   │   │   └── [id]/
│   │   ├── vendors/
│   │   └── settings/
│   │       ├── team/
│   │       ├── partners/
│   │       └── overrides/
│   ├── dj/
│   │   ├── profile/
│   │   └── upload-w9/
│   ├── register/
│   │   ├── dj/
│   │   └── vendor/
│   └── api/
│       ├── email/
│       ├── pdf/
│       ├── payments/
│       │   └── paypal/
│       └── cron/
│           └── w9-reminders/
├── components/
│   ├── autocomplete/
│   ├── view-builder/
│   ├── override/
│   ├── budget/
│   ├── payments/
│   └── pdf-templates/
├── lib/
│   ├── supabase/
│   ├── overrides/
│   ├── paypal/
│   └── calendar/
├── types/
└── README.md
```

---

## Notes on Key Design Decisions

- **Magic link authentication — no passwords.** All users (admin, partner, DJ) authenticate via a one-time magic link sent to their email. This eliminates password management and naturally enforces email ownership verification. No passwords are stored anywhere in the system.
- **DJ registration is public but account-gated.** The form is public-facing, but submitting it creates a Supabase Auth account. Email uniqueness is enforced at the Auth level — duplicate submissions are rejected before any data is written.
- **DJ records are editable by Admins.** The read-only DJ dropdown in event creation prevents accidental duplicate entries during booking. Legitimate edits to DJ records are done through the `/djs/[id]` admin page, where changes are audit logged.
- **W-9 storage paths, not signed URLs, are stored in the database.** `w9_storage_path` stores the internal object path. Signed URLs are generated on demand at read time and expire after 60 minutes. This means a leaked or stale URL cannot be used to access files.
- **`service_role` key bypasses all RLS.** It is treated as a root secret and lives only in server-side environment variables. The `anon` key is safe to use in the browser because RLS limits it — not because all keys are safe.
- **Partner is a limited admin role, not a full admin.** Partners have full read/write on operational data but cannot delete events, manage team accounts, trigger PayPal payouts, or configure partner splits. The role table in [User Roles & Access](#user-roles--access) is the authoritative definition.
- **`partners.profit_split_pct` is enforced at two levels.** Application-level validation checks the sum before any save. A Postgres trigger rejects any update that causes the sum to deviate from 100, providing a database-level guarantee.
- **Estimated and final budgets are always preserved.** A UNIQUE constraint on `(event_id, budget_type)` ensures only one of each exists per event. Neither overwrites the other. The Compare view tracks variance over time to improve future estimates.
- **Payment overage is prevented server-side.** Before any payment is recorded (PayPal or manual), the server checks that cumulative payments do not exceed the expense line total.
- **All years in one `events` table.** Filtered by year selector. No separate structures per year.
- **Posting calendar uses `.ics`.** Universal format — no proprietary integration required. Works with Apple Calendar, Google Calendar, Outlook, and any standards-compliant app.
- **Admin portal returns 404 to unauthenticated users.** No login page is exposed to bots or crawlers.
- **PayPal requires a Business account and Payouts API approval.** Verify current pricing, fee structure, and approval requirements directly with PayPal at time of setup.

---

*LosGothsCo Event Operations Platform — Internal Documentation*
*Last updated: April 2026*
