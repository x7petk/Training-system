Skill Matrix

## Overview (current product behaviour)

The **Skill Matrix** is a workforce capability tool that connects:

- **People** (roster)
- **Job roles** (assigned to people)
- **Skills** (numeric 1–4 or certification yes/no)

It compares **required level** (from roles) vs **actual level** (recorded per person) and highlights:

- **Critical gaps** / **minor gaps**
- **Meets** / **exceeds**
- **Extra skills** (tracked but not required by the person’s roles)
- **Target dates** (due dates) for closing gaps

This document is intentionally aligned to the app’s current implementation (pages, permissions, logic, and data).

---

## Pages and routes

- **`/`**: Skill matrix (same as `MatrixPage`); operators are redirected to **`/my-skills`**
- **`/my-skills`**: “My skills” detail view (and skill editor for permitted users)
- **`/dashboard`**: Due-date dashboard (staff-only; operators are redirected to **`/my-skills`**)
- **`/report`**: Training/assessment report (staff-only; operators are redirected to **`/my-skills`**)
- **`/admin`**: Admin tools (admin-only)
- **`/user-guide`**: User Guide (admin-only)

---

## Roles and permissions (what each user can do)

The app uses three effective access levels:

- **Operator**
  - Uses **My skills** in **read-only** mode.
  - Is redirected away from Matrix/Dashboard/Report to **`/my-skills`**.
- **Assessor**
  - Can use **Matrix**, **Dashboard**, **Report**.
  - Can manage/edit skill records for **any person** in **My skills**.
- **Admin**
  - Same as assessor for day-to-day matrix/training operations.
  - Plus access to **Admin** and **User Guide**.

Editing in Matrix is allowed for:

- **Admin** and **assessor** (any person)
- **Non-operator staff** for **their own** person record (when their login is linked to a person)

---

## Core data model (as used by the app)

The UI reads/writes these main records (Supabase tables):

- **`people`**
  - `display_name`, `team_id`, `user_id` (optional link to login)
- **`teams`**
- **`roles`**
- **`person_roles`** (join table: person ↔ role)
- **`skill_groups`**
- **`skills`**
  - `kind`: `numeric` or `certification`
- **`role_skill_requirements`**
  - `role_id`, `skill_id`, `required_level`
- **`person_skills`**
  - `person_id`, `skill_id`, `actual_level`, `is_extra`, `due_date`

Training / reporting tables used by current functionality:

- **`skill_training_packs`** (per skill: attachments + pass score)
- **`skill_training_questions`** (per skill: quiz questions/options)
- **`skill_training_standards`** (per skill: rich “standard pages” + image placements)
- **`skill_training_attempts`** (records quiz attempts; report uses **passed attempts**)
- **`skill_progression_events`** (optional; report reads L2→3 events if this migration exists)
- **`profiles`** (login role: operator/assessor/admin; used to find assessors list)

---

## Skill types and levels (current rules)

### Numeric skills (`kind = numeric`)

Fixed scale used throughout:

- **1** = No knowledge
- **2** = Theoretical understanding
- **3** = Practical capability
- **4** = Expert / Trainer

### Certification skills (`kind = certification`)

Stored as a number but treated as binary:

- **Required**: `required_level >= 1` means “Yes required”
- **Actual**: `actual_level >= 1` means “Yes”; otherwise “No”

---

## How “required level” is calculated for a person

People can have **multiple job roles**.

For each skill, the person’s **required level** is:

- the **maximum required level** across all their assigned roles for that skill

If none of the person’s roles require a skill, required is **empty** (not required).

---

## Gap / colour classification (current logic)

The app classifies each person-skill cell into one of:

- **Critical gap** (red)
- **Minor gap** (amber)
- **Meets** (green)
- **Exceeds** (teal)
- **Extra skill** (blue)
- **N/A** (neutral)

### Numeric skill gap

Let \( \Delta = actual - required \).

- **N/A**: no required and no actual
- **Extra**: marked `is_extra` OR has actual while not required
- **Critical**: actual missing OR \( \Delta \le -2 \)
- **Minor**: \( \Delta = -1 \)
- **Meets**: \( \Delta = 0 \)
- **Exceeds**: \( \Delta \ge 1 \)

### Certification skill gap

If required is “Yes” (`required_level >= 1`):

- **Critical**: actual is missing/No (`actual_level < 1`)
- **Meets**: actual is Yes (`actual_level >= 1`)

If required is “No” (or skill not required): it will be treated as **N/A** unless tracked as **Extra**.

---

## Due dates (target dates)

The system stores a per-person, per-skill **`due_date`** (shown as “Target”).

Current behaviour:

- Due dates are **displayed and filtered** (Dashboard + My skills tiles).
- A “No target date” bucket highlights skills that are **gaps** (critical/minor) but **have no due date set**.
- The app does **not** enforce an automatic rule like “gap ⇒ due date required” in the UI; it’s treated as a workflow discipline.

---

## Extra skills

Extra skills are represented by `person_skills.is_extra = true` and are:

- **Not required** by the person’s current roles
- **Tracked anyway** (shows as “Extra skill” in matrix/legends)

In **My skills**, extra skills are:

- shown under **“Extra skills tracked”**
- added via **“Add extra”** (select any skill that isn’t required and isn’t already tracked)

---

## Matrix (home page) behaviour

The matrix is a wide grid:

- **Rows**: people
- **Columns**: skills (grouped by Skill Group)
- **Cells**: required/actual + gap class (colour)

Current filters/search:

- Filter **people** by name (search)
- Filter **skills** by name (search)
- Filter by **job role** (chips)
- Filter by **team** (chips)
- Filter by **skill group** (chips)
- Reset all filters

Legend colours match the gap logic above.

---

## My skills behaviour

My skills supports two main usage patterns:

- **Operator**: read-only view of their own linked person record
- **Admin/assessor** (and permitted staff for self): edit skills and due dates using the skill editor

Key behaviours:

- Splits into **Required for your roles** vs **Extra skills tracked**
- Filters include:
  - gap type (critical/minor/meet/exceed/extra/na)
  - skill group
  - (for admin/assessor) roster filters: person, team, role
- Due-date quick tiles:
  - **Overdue**
  - **Next 7 days**
  - **Next 30 days**
  - **No target date** (gaps with no due date)

---

## Training (Level 1 → 2) behaviour

For some numeric skills, the app supports **operator-friendly training**:

- Training is available when:
  - skill is **numeric**
  - the person’s **actual level is 1**
  - a **training pack** exists for the skill
  - the skill has **quiz questions**

Training flow:

- Shows training material (standards pages and/or downloadable document)
- User completes quiz
- On submit:
  - records an attempt in **`skill_training_attempts`**
  - if **passed**, updates **`person_skills.actual_level` from 1 → 2** (only when it is still 1)

---

## Dashboard (staff-only)

Dashboard focuses on **targets (due dates)**:

- Tiles for **Overdue**, **Next 7 days**, **Next 30 days**, **No target date**
- “Overdue” table
- “Coming due” table
- A 12-week / 12-month bar chart of due dates (clickable buckets)

---

## Report (staff-only)

Report combines:

- **Training completions**: L1 → 2 based on **passed attempts** (`skill_training_attempts`)
- **Assessments / promotions**: L2 → 3 based on **`skill_progression_events`** (if the DB migration exists)
- Role-based gap summaries using the current matrix state

Notes:

- If `skill_progression_events` is missing, the page shows a note that migrations are needed and L2→3 charts won’t populate.
- L2→3 events are not backfilled automatically; they appear after the migration and new 2→3 updates.

---

## Admin setup (what an admin configures today)

Admin is split into sections:

- **Catalog**
  - Skill groups
  - Skills (numeric/certification)
  - Job roles
  - Role skill requirements
- **Training**
  - Skill training packs/questions/standards
- **Organization**
  - Teams
  - People (roster, roles, link logins)
- **Access**
  - Login accounts (operator/assessor/admin)

---

## Related: RTT (Plan 24)

**Plan 24** — the RTT **cell day / shift** planning grid (checks, rosters, scheduled vs ad-hoc events) — is specified in [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md). It reuses **People** master data and site → plant → cell scope patterns aligned with this matrix where applicable.

---

## User Guide

There is an admin-only **User Guide** page at **`/user-guide`**. It is the day-to-day operating reference for admins, assessors, and team leads.

Current guide coverage is aligned to implemented behaviour:

- Role access expectations (operator vs assessor vs admin)
- Matrix usage patterns and filter workflow
- My skills workflow (required vs extra skills and target-date priorities)
- Training and assessor flow (including L1→2 training gating and progression-event reporting dependencies)
- Dashboard / Matrix / Report usage guidance for operational vs leadership review
