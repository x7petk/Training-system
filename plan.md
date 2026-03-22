# Skill Matrix App — Implementation Plan (Supabase)

This document turns the product goals into ordered work. Domain rules and entities live in [`skill_matrix.md`](./skill_matrix.md).

---

## Stack (locked)

| Layer | Choice |
|--------|--------|
| UI | React + Vite + TypeScript |
| Styling / UX | Tailwind CSS + Radix UI (or shadcn/ui) — accessible, fast to build polished layouts |
| Data grid | TanStack Table (keyboard nav, dense matrix-friendly) |
| Backend | **Supabase** (Postgres, Auth, Row Level Security, optional Storage later) |
| Local dev | `npm run dev` → localhost |
| Production | Host static app on **Vercel** or **Netlify** (connect GitHub repo); Supabase URL/keys via host env vars |

---

## What to do next (in order)

### 1. Supabase projects

1. Create **[Supabase](https://supabase.com)** account.
2. Create **two** projects (recommended): `skill-matrix-dev` and `skill-matrix-prod` — same schema, different data and keys.
3. In each project: **Settings → API** — copy `Project URL` and `anon` `public` key (for the browser client).

### 2. Repo hygiene for secrets

1. Add `.env.local` (Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — **never commit**.
2. Add `.env.example` with empty placeholders — **commit** so others know what to set.
3. Ensure `.gitignore` includes `.env`, `.env.local`, `.env.*.local`.

### 3. Scaffold the frontend (first code milestone)

1. In this repo (or a subfolder like `app/` if you prefer): `npm create vite@latest` → React + TypeScript.
2. Add Tailwind + a component base (Radix/shadcn).
3. Add `@supabase/supabase-js`, small `src/lib/supabase.ts` that reads `import.meta.env.VITE_*`.
4. Add React Router: routes for `/register`, `/login`, `/` (matrix, protected), `/admin` (protected + admin role).

### 4. Supabase Auth (before matrix data)

1. Enable **Email** provider (Supabase Auth settings).
2. Decide **sign-up policy**: open registration vs invite-only (if invite-only, hide public register or gate it).
3. Implement register + login + logout; **session persistence** = Supabase client default (refresh token) — do **not** store passwords in `localStorage`.
4. Optional: email confirmation toggle in Supabase — if on, UX copy must say “check your email”.

### 5. Profiles and admin role

1. Create `profiles` table: `id` (UUID, FK to `auth.users`), `display_name`, `role` (`user` | `admin`), timestamps.
2. Trigger or Edge Function: on `auth.users` insert → insert `profiles` row (default `role = 'user'`).
3. First admin: manually set `role = 'admin'` in SQL Table Editor for your user once, or seed SQL in repo `supabase/seed.sql`.
4. RLS: users read own profile; admins read/update all profiles (policies in SQL).

### 6. Core domain tables (MVP)

Align with `skill_matrix.md` §2 — minimal first slice:

- `skill_groups`, `skills`
- `roles`, `role_skill_requirements` (role_id, skill_id, required_level, …)
- `people` (can link `user_id` nullable for employees without login)
- `person_skills` (person_id, skill_id, actual_level, due_date optional)

Add RLS: authenticated users read what policy allows; only admins (or defined roles) manage catalog and requirements; people may update **own** `person_skills` if you want self-service.

### 7. Matrix UI

1. Main view: grid (e.g. people × skills or roles × skills) with gap coloring (critical / minor / met / exceed) per spec.
2. Filters: start with **role**, **team** (add org tables when ready), **skill group** — prefer chips + one panel, ⌘K for jump/filter later.
3. Empty/loading/error states; responsive down to laptop (spec targets wide screen first).

### 8. Admin UI

1. User list: search, disable access (if you add flags), set `admin`, trigger password reset email.
2. CRUD for skills, roles, requirements (phase as needed).
3. Guard `/admin` on client **and** enforce via RLS on server.

### 9. Deploy production

1. Push to GitHub (`Training-system`).
2. Vercel/Netlify: import repo, set **Production** env vars to **prod** Supabase URL + anon key.
3. Supabase **Auth → URL configuration**: add production site URL and redirect URLs.
4. Optional: Preview deployments use **dev** Supabase keys (separate env in host for previews).

### 10. Hardening

1. Review all RLS policies (use Supabase “RLS advisor” / tests).
2. Rate limiting / CAPTCHA on auth if exposed publicly (later).
3. Backups: Supabase project backups (paid tier) or logical exports for prod.

---

## Phase summary

| Phase | Deliverable |
|-------|-------------|
| P0 | Vite app, env wiring, Router shell, theme |
| P1 | Supabase Auth: register, login, session, protected routes |
| P2 | `profiles` + admin role + RLS |
| P3 | Domain tables + RLS + seed data for demo |
| P4 | Matrix grid + basic filters + gap styling |
| P5 | Admin: users + catalog/requirements management |
| P6 | Prod deploy + Auth redirect URLs + env split dev/prod |

---

## Immediate action (today)

1. Create **dev** Supabase project and copy URL + anon key.
2. Scaffold **Vite + React + TS** in the repo and commit.
3. Add `.env.local` and verify the app builds with `import.meta.env.VITE_SUPABASE_URL` defined.

When those three are done, the next coding task is **Auth screens + Supabase client session**.

---

## References

- Product / data rules: [`skill_matrix.md`](./skill_matrix.md)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
