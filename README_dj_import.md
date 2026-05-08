# DJ import — Los Goths Co Vendors → Maquina

Snapshot taken **2026-05-07** from the **DJs from Form** tab of the *Los Goths Co Vendors* sheet.

## Files

- `los_goths_djs_import.csv` — 48 DJs (43 form-submitted + 5 manual entries: Sulkform, LosGothsCo. DJs, Jose Shuton, Soltera, TECHGRL).
- `los_goths_djs_import.sql` — idempotent INSERT … ON CONFLICT (stage_name) DO UPDATE.
- `build_dj_import.py` — source data + generator if you ever need to regenerate.

## Columns produced

`stage_name`, `legal_name`, `email`, `phone` (original format), `phone_e164` (normalized to +1XXXXXXXXXX), `pay_method`, `location` (SoCal / NorCal / Seattle / Arizona / Chicago), `w9_url`, `form_submitted_at`, `edit_response_url`, `source` (`form` or `manual`).

## Apply via Supabase Dashboard (no credentials needed)

1. Supabase → **Table editor** → `djs` → **Insert** → **Import data from CSV**.
2. Pick `los_goths_djs_import.csv`. Map columns if the names differ.

## Apply via SQL editor

Open the SQL file, paste into Supabase **SQL editor**, run. If your `djs` table uses different column names, find/replace them at the top of the INSERT statement before running.

## Notes

- `Phobik`, `1201770`, and `Pictureplane` use `https://drive.google.com/file/d/.../view` form for the W9; everyone else uses `https://drive.google.com/open?id=...`. Both resolve.
- `Black Lipstick` and `JeezyRogue` did not upload a W9 — `w9_url` is empty.
- `LosGothsCo. DJs` is the in-house catch-all entry; legal_name is empty.
- Phones are kept in original form for audit; `phone_e164` is the cleaned version for the app.
