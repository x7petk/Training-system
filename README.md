# Training-system

Workforce **Skill Matrix** spec lives in [`skill_matrix.md`](./skill_matrix.md). Delivery plan: [`plan.md`](./plan.md).

## Web app (`web/`)

Stack: Vite, React, TypeScript, Tailwind v4, Supabase Auth.

### Local setup

**Env (already done if you followed earlier steps):** `web/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key).

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
