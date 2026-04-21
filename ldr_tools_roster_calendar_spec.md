# LDR Tools: Roster & Calendar Spec (Current Production State)

## Status

Implemented and live in production at:
- `https://training-system-seven.vercel.app`

Current flow is refresh-on-save (no realtime subscriptions yet).

---

## 1) Product Context

LDR is a separate section inside the app, alongside Skill Matrix and RTT systems.

**RTT (Plan 24)** — production planning grid per cell — is documented in [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md) (different nav area from LDR; same app and Supabase project). Engineering notes and migration pointers: **§10a** in that file.

Access gates:
- `SectionAccessRoute(section="ldr")` controls LDR entry.
- LDR Admin tab is admin/super-admin only via `LdrAdminRoute`.

---

## 2) Navigation & Routes

Inside `LDR tools`:
- `Calendar` -> `/ldr-tools/calendar`
- `Roster` -> `/ldr-tools/roster`
- `LDR checks` nav group:
  - `Health Checks` -> `/ldr-tools/health-checks`
  - `SOS` -> `/ldr-tools/sos`
  - `QOS` -> `/ldr-tools/qos`
  - `PPO` -> `/ldr-tools/ppo`
- `Reports` nav group:
  - `HC Report` -> `/ldr-tools/health-checks/report`
  - `SOS Report` -> `/ldr-tools/sos/report`
  - `QOS Report` -> `/ldr-tools/qos/report`
  - `PPO Report` -> `/ldr-tools/ppo/report`
- Footer links:
  - `User Guide` -> `/ldr-tools/user-guide`
  - `Admin` (admin/super-admin) -> `/ldr-tools/admin` (shown below User Guide)

UI notes:
- Intro/description text was intentionally removed from page headers for Calendar, Roster, and LDR Admin.
- LDR scope bar shows controls only (no extra "LDR scope" summary badge).

---

## 3) Scope Model (Site/Cell)

Scope is selected in `LdrScopeFilterBar`:
- Site mode: Site selector
- Cell mode: Site + Plant + Cell selectors

Resolved workspace logic:
- Site scope resolves site workspace (`ldr_ensure_workspace_site`).
- Cell scope resolves cell workspace (`ldr_ensure_workspace_cell`).
- In cell scope, site-level activities can still be displayed in roster (visibility toggles in Admin > Activities).

---

## 4) Calendar Module

Purpose:
- Weekly planning of LDR events.

Core behavior:
- 7-day week board (`Mon` to `Sun`)
- All-day events with date spans
- Drag-and-drop event move with date delta recalculation
- Edit/create modal with title, dates, color, notes
- 3-week compact preview below main board

Data:
- `ldr_events` (`title`, `start_date`, `end_date`, `color`, `notes`, `workspace_id`)

Performance/UI:
- Route is lazy-loaded
- Drag handlers and callbacks are memoized to reduce rerenders

---

## 5) Roster Module

Purpose:
- Assign people to activities by day and track status/progress.

Grid behavior:
- Rows = activities
- Columns = week days
- Cell click opens assignment modal for that activity/day
- Assignment chips show avatar + compact location tag + conflict highlight

Assignment modal behavior:
- Existing assignment rows allow:
  - one-click RAG buttons (`none/green/yellow/red`)
  - one-click Cell buttons
  - comment edit
  - remove assignment
- New assignment form is structured as:
  1) Person
  2) Cell (site scope only)
  3) RAG
  4) Comment

Conflict logic:
- Same person on multiple activities for the same date shows warning.
- Warning is non-blocking.

Drag-and-drop:
- Assignment chip can be moved to another day/activity.
- Move preserves person, RAG, comment.

Data:
- `ldr_assignments` (`ldr_person_id`, `activity_id`, `assignment_date`, `rag_status`, `comment`, optional `master_cell_id`)

Legacy fallback:
- If `master_cell_id` column is missing, app falls back to `ldr_location_id` name mapping.

---

## 6) LDR Admin Module

Tabs:
- `People`
- `Activities`
- `Cells`

### 6.1 People
- Dedicated LDR roster table (`ldr_people`), manually managed in LDR Admin.
- Add/edit/remove people.
- Person fields include first/last name, initials, status, avatar variant, optional cell.
- Avatar variants now use **solid colour** placeholders (no gradients), reused in roster chips.

### 6.2 Activities
- Add/edit/delete activity names
- Manual ordering (up/down controls)
- In cell scope: select which site-level activities are visible in cell roster
  - persisted in `localStorage` per cell workspace + site workspace key

### 6.3 Cells
- Read-only list of site cells from master data for current site scope.

---

## 7) Master Data Integration

Master data hierarchy now exists and is managed in app:
- Sites
- Plants
- Cells

New pages (super-admin):
- `/master-data/structure`
- `/master-data/people`

These feed LDR scope selection and LDR cell labels.

---

## 8) User Guide

New LDR guide page:
- `/ldr-tools/user-guide`
- Linked from LDR sidebar footer.
- Explains practical run flow for LDR apps:
  - set scope
  - plan in calendar
  - execute in roster
  - maintain in admin
- Includes current nav grouping notes (LDR checks + Reports) and sticky action bar behaviour on record pages.

---

## 9) Technical Notes

- LDR routes are lazy-loaded with `Suspense` fallback in `LdrToolsLayout`.
- Added Vitest coverage for:
  - `ldrWeekUtils`
  - `types` helper (`isMissingMasterCellColumnError`)
- LDR avatars are memoized and use solid fill variants.
- Roster -> HC/Obs return scope is stashed/restored so users return to the same site/cell scope after completing a record.
- HC/Obs record pages use a fixed bottom action dock (autosave state, submit, delete) aligned to the sidebar width state.
- HC/Obs roster prefill now uses in-memory master-cell joins for legacy location matching (avoids an extra `master_cells` round-trip on each deep-link open).

---

## 10) Verification Snapshot (2026-04-13)

LDR-focused checks executed on `web/`:
- `npm run test` -> pass (`10/10`)
- `npm run lint` -> pass
- `npm run build` -> pass

Bug/perf fixes made during this pass:
- Fixed observation new-page roster prefill race in React Strict Mode (same robust pattern as HC).
- Added observation fallback prefill by `assignmentId` when `masterCellId` is empty.
- Reduced roster modal row rendering overhead by memoizing people lookups (`Map` instead of repeated `.find()` per row).

---

## 11) Deploy Rule (Operational)

Production deployment target is:
- Vercel project: `training-system-seven`
- Scope: `mikhails-projects-de0149d2`
- Primary URL: `https://training-system-seven.vercel.app`

If users report "old production":
- verify they are using `training-system-seven.vercel.app`
- do not assume legacy `training-system.vercel.app` points to current app

