# LDR Tools: Roster & Calendar App Spec (Aligned to Current Setup)

## Status

Implemented in app (LDR tools routes + Supabase migration `20260409100000_ldr_tools.sql`). Refresh-on-save MVP; no realtime subscriptions yet.

---

## 1) Product Context in Current App

This module belongs to the existing **LDR tools** section in the app hub.

Current top-level app areas:
- `Skill Matrix`
- `LDR tools`
- `RTT systems`
- `Login accounts` (admin/super admin)

Current app-level roles and access:
- `super_admin`, `admin`, `assessor`, `operator` in `profiles.role`
- Section flags in `profiles`:
  - `can_access_skill_matrix`
  - `can_access_ldr_tools`
  - `can_access_rtt_systems`

Access routes already in place:
- LDR pages are gated by `SectionAccessRoute(section="ldr")`
- Login accounts are admin-only
- Section access management is super-admin-only

---

## 2) Goal

Build a tablet-first **Roster & Calendar** experience inside **LDR tools** for weekly planning and daily assignment management.

Two modules:
1. **Calendar** (site events planning)
2. **Roster** (leadership activity assignment)

Future-ready for BMS hierarchy extension (`Site -> Plant -> Cell`).

---

## 3) UX Principles (Kept)

- One-page first experience
- Drag-and-drop interactions
- Fast edit flows (minimal modal depth)
- Real-time behavior (live updates where practical)
- Tablet-first, mobile-friendly
- Warning-based validation (non-blocking conflicts)

---

## 4) Permission Model (Mapped to Existing Logic)

### 4.1 App Access Gate

Only users with `can_access_ldr_tools = true` can open this module.

### 4.2 In-Module Permissions (confirmed)

- **Super admin / Admin**
  - See `Calendar`, `Roster`, and `Admin` tab (inside LDR tools)
  - Create/edit/delete people, activities, events
  - Assign people, edit RAG/comments, move assignments
- **Assessor / Operator**
  - See `Calendar` and `Roster`
  - Edit assignments (people, RAG, comments)
  - Move assignments by drag-and-drop
  - Can create/edit calendar events
  - No access to LDR Admin tab

This preserves: assessor = same as operator in LDR tools.

### 4.3 Site Master Permissions (confirmed)

- `sites` master data exists from MVP start.
- `sites` management is **super admin only**.
- MVP seed contains exactly 2 sites.

---

## 5) Navigation in LDR Tools

Inside `LDR tools`, use top tabs:
- `Calendar`
- `Roster`
- `Admin` (visible only to admin/super admin)

Existing LDR routes currently:
- `/ldr-tools/roster`
- `/ldr-tools/calendar`

Planned extension:
- `/ldr-tools/admin` (new, guarded by admin role)

---

## 6) Calendar Module

### 6.1 Purpose

Plan and visualize site-level events in a weekly format.

### 6.2 Weekly Layout

Header:
- Current week label (example: `Week 12 | 18-24 Mar`)
- Previous/next week controls
- Week selector
- Site filter (default: all)

Grid:
- 7 columns (`Mon` to `Sun`)
- All-day events only
- Multi-day events span date columns
- Overlaps allowed

### 6.3 Event Model

Fields:
- `title`
- `site`
- `start_date`
- `end_date`
- `color`
- `notes`

### 6.4 Interactions

- Tap/click event -> edit modal (save/delete)
- Drag-and-drop event across days -> auto-update dates

Permissions:
- Operator/assessor/admin/super admin can create/edit events
- Admin/super admin can also manage event master data from LDR Admin

### 6.5 Forward View

Under main week grid:
- 3-week preview (read-only, compact)

---

## 7) Roster Module

### 7.1 Purpose

Assign leadership activities by day and track:
- Responsible people
- RAG status
- Comments

### 7.2 Weekly Layout

Header:
- Current week label
- Previous/next week controls
- Week selector

Grid:
- Rows = activities
- Columns = `Mon` to `Sun`
- Cell = `(activity + date)`

### 7.3 Activity Source

Activities are managed in LDR Admin and rendered dynamically in Roster.

### 7.4 Cell States

Collapsed cell:
- Person chips (multi-person allowed)
- RAG indicator (green/yellow/red)
- Warning icon for conflicts

Expanded popup:
- Add/remove people
- Set RAG
- Add/edit comment

### 7.5 Assignment Record Logic

One record per `(activity_id, date, ldr_person_id)`.

Multiple people assigned to one activity/day means multiple rows.

### 7.6 Conflict Logic

Trigger: same person assigned to multiple activities on same date.

Behavior:
- Show warning indicator
- Do not block save

### 7.7 Drag-and-Drop

Supported:
- Move person assignment between days
- Move person assignment between activities

On move:
- Update `activity_id` and/or `date`
- Preserve `rag_status` and `comment`

---

## 8) LDR Admin Module (In-Module)

Visible only to admin/super admin.

### 8.1 People

Source linkage (confirmed):
- `ldr_people` is a dedicated LDR table
- Each `ldr_people` row references one existing row from main `people`
- LDR selection list is sourced from main `people`
- Only main people with linked login (`people.user_id` present) can be selected
- Therefore all LDR people are login-linked by rule

Fields:
- `name`
- `site`
- `status` (`available`, `leave`, `training`, `travel`, `sick`, `off_site`)

Actions:
- Add, edit, delete

### 8.2 Activities

Simple master list:
- `activity_name`

Actions:
- Add, edit, delete

### 8.3 Events

Same structure as calendar events:
- `title`, `site`, `start_date`, `end_date`, `color`, `notes`

Actions:
- Add, edit, delete

Note:
- Operators and assessors can create/edit events from Calendar UI
- Admin/super admin can do the same and also have Admin tab access

---

## 9) Data Model (LDR namespace, updated)

Confirmed structure direction:

- `ldr_sites`
  - `id`, `code`, `name`, `is_active`, timestamps
  - seeded with 2 MVP rows
  - editable by super admin only
- `ldr_people`
  - `id`, `person_id` (FK -> `people.id`, unique), `site_id` (FK -> `ldr_sites.id`), `status`, timestamps
  - no duplicate person data; base name/login stays in main `people`
- `ldr_activities`
  - `id`, `name`, timestamps
- `ldr_events`
  - `id`, `title`, `site_id` (FK -> `ldr_sites.id`), `start_date`, `end_date`, `color`, `notes`, timestamps
- `ldr_assignments`
  - `id`, `ldr_person_id`, `activity_id`, `date`, `rag_status`, `comment`, timestamps
  - `rag_status` enum/text constrained to `green|yellow|red`
  - audit fields included (see below)

Audit fields (confirmed for MVP):
- `created_at`, `created_by`
- `updated_at`, `updated_by`

Recommended unique constraint:
- `unique (ldr_person_id, activity_id, date)` on assignments

Conflict detection query:
- same `ldr_person_id` with count > 1 on same `date` across different activities

---

## 10) UI Rules

- Large touch targets
- Outlook-like clean weekly grid
- Visual (color) first communication
- Minimal text density
- Fast edit: target max two taps/clicks for common updates

---

## 11) Mobile Behavior

- Vertical scrolling enabled
- Compact row/cell density
- Tap-to-expand for cell details
- Optional horizontal day scrolling if width constrained

---

## 12) MVP Scope (Strict)

Include:
- Calendar weekly grid + 3-week preview
- Roster assignment grid
- LDR Admin (people, activities, events)
- Drag-and-drop
- Conflict warnings (non-blocking)
- RAG + comments

Exclude:
- Recurrence rules
- Shift logic
- Plant/cell hierarchy
- Auto-RAG logic

---

## 13) Remaining Decisions Before Build

1. **Realtime level (confirmed)**:
   - MVP uses **refresh-on-save** (no live subscriptions in MVP)
   - Realtime subscriptions can be added in phase 2
2. **Skill Matrix integration depth** (deferred): MVP has roster conflict warnings only; no capability-based suggestions yet.

