# Training-system

Workforce **Skill Matrix** spec lives in [`skill_matrix.md`](./skill_matrix.md). Delivery plan: [`plan.md`](./plan.md).

## Product docs map

Use this section as the source of truth for where to update docs when behaviour changes.

### Skill Matrix

- Product/spec reference: [`skill_matrix.md`](./skill_matrix.md)
- In-app user guide source: [`web/src/pages/UserGuidePage.tsx`](./web/src/pages/UserGuidePage.tsx) (`/user-guide`)

### RTT systems

- Plan 24 spec + implementation notes: [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md)
- DH/Deviations/Quality plan: [`rtt_dh_deviations_quality_fails_plan.md`](./rtt_dh_deviations_quality_fails_plan.md)
- CL/CIL/Quality checks requirements: [`CL_CIL_Quality_checks.md`](./CL_CIL_Quality_checks.md)
- In-app user guide source: [`web/src/pages/RttSystemsUserGuidePage.tsx`](./web/src/pages/RttSystemsUserGuidePage.tsx) (`/rtt-systems/user-guide`)

### LDR tools

- Roster/Calendar/Checks spec: [`ldr_tools_roster_calendar_spec.md`](./ldr_tools_roster_calendar_spec.md)
- In-app user guide source: [`web/src/pages/LdrToolsUserGuidePage.tsx`](./web/src/pages/LdrToolsUserGuidePage.tsx) (`/ldr-tools/user-guide`)

### Doc maintenance rule

When behaviour changes in a module, update both:
- the module spec (`*.md`)
- the corresponding in-app user guide page (`web/src/pages/*UserGuidePage.tsx`)

## Web app (`web/`)

Stack: Vite, React, TypeScript, Tailwind v4, Supabase Auth.

### Local setup

**Env:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key). Put them in **`web/.env.local`** and/or the **repository root** `.env.local` / `.env` (same folder as the root `package.json`). Vite merges **root first, then `web/`**, so keys in `web/.env.local` win; root-only files are now picked up so localhost matches production when you use the same Supabase project as Vercel.

**Parity checklist:** Same Supabase URL/key as production · same **signed-in user** (RLS) · same **site / plant / cell** in the scope bar (scope is stored in `localStorage` per origin, so `localhost` and `*.vercel.app` do not share it).

#### Option A — automated (recommended)

From the **repo root** (not `web/`):

1. Create a **Personal Access Token**: [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) → **Access Tokens**.
2. Copy your **database password**: Project **Settings → Database** (Postgres password).
3. Either **export** the variables in your shell, or copy [`.env.supabase.example`](./.env.supabase.example) to **`.env.supabase`** in the repo root (gitignored) and fill in values — `npm run supabase:bootstrap` loads that file automatically.

```bash
npm install
export SUPABASE_ACCESS_TOKEN="sbp_..."        # your PAT
export SUPABASE_DB_PASSWORD="..."             # database password
npm run supabase:bootstrap
```

After pulling new migrations, apply them to the linked project:

```bash
npm run supabase:push
```

(`supabase:bootstrap` now uses `db push` for migrations; `supabase:push` is link + push only.)

### RTT — Plan 24

**Plan 24** (production cell day/shift grid, checks, rosters) is specified in [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md). It uses the **same Supabase project** as Skill Matrix and LDR tools. After schema changes land in `supabase/migrations/`, run **`npm run supabase:push`** from the repo root so RTT behaviour (materialised checks, suppressions, etc.) matches the deployed web app.

This updates **Auth URL / redirect allow list** for `http://localhost:5173`, **links** the CLI to project `uhwbvwlneenvkldccehq`, and applies [`supabase/migrations/20250323000000_profiles.sql`](./supabase/migrations/20250323000000_profiles.sql).

4. Start the app, **register** (e.g. `x7petk@gmail.com`), then promote admin:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
export SUPABASE_DB_PASSWORD="..."
# optional: export BOOTSTRAP_ADMIN_EMAIL="x7petk@gmail.com"
npm run supabase:bootstrap:promote
```

#### Option B — manual (dashboard)

1. **SQL Editor**: run [`supabase/migrations/20250323000000_profiles.sql`](./supabase/migrations/20250323000000_profiles.sql).
2. **Authentication → URL configuration**: Site URL and redirect allow list → `http://localhost:5173`.
3. After signup, run the `update public.profiles set role = 'admin' …` statement from the migration comment (by email).

#### Run the UI

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). After migration + admin promotion, **Admin** appears in the sidebar for `role = admin`.

### Production

Build: `cd web && npm run build`. Deploy the `web/dist` output (e.g. Vercel/Netlify) and set the same `VITE_*` env vars there; update Supabase redirect URLs for the live domain.

### Web CI (lint, test, build)

GitHub Actions runs **`web/`** `lint`, `test`, and `build` on every push and pull request to `main` (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

From the **repo root** (same commands CI uses, without `cd web`):

```bash
npm run web:ci
```

Or from `web/`:

```bash
npm run test
npm run lint
npm run build
```

These are the baseline gates used after web changes (Skill Matrix, LDR tools, RTT systems, user guides).
