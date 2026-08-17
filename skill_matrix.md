# Training-system — Product handbook

This document is the product and behaviour reference for the **Training-system** web app (production: `training-system-seven`). It covers:

- What the whole platform is for
- Requirements for Skill Matrix (and how other apps fit)
- Design principles and locked decisions
- **Who can do what** for every login role

It is aligned to the current implementation (routes, RLS, UI), not to an older MVP plan.

Related module specs (deeper detail for non–Skill Matrix areas):

- LDR Calendar / Roster: [`ldr_tools_roster_calendar_spec.md`](./ldr_tools_roster_calendar_spec.md)
- Health Checks: [`health_checks_app_v2_spec.md`](./health_checks_app_v2_spec.md)
- SOS / QOS / PPO: [`sos_qos_ppo_observation_systems_spec.md`](./sos_qos_ppo_observation_systems_spec.md)
- Plan 24 / RTT: [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md)
- CL / CIL / Quality checks: [`CL_CIL_Quality_checks.md`](./CL_CIL_Quality_checks.md)
- Defects / deviations / quality fails: [`rtt_dh_deviations_quality_fails_plan.md`](./rtt_dh_deviations_quality_fails_plan.md)
- e-Plan: [`e-plan-requirements.md`](./e-plan-requirements.md)
- Delivery/stack notes: [`plan.md`](./plan.md)

When behaviour changes, update **this file** (Skill Matrix and platform roles) **and** the matching in-app user guide (each hub app has a User Guide in the sidebar footer, or a User Guide tab on Login accounts).

---

## 1. What the app is

Training-system is a **multi-app manufacturing operations workspace** under one login. After sign-in, everyone lands on **App Hub** (`/`) and only sees tiles they are allowed to open.

The original core is **Skill Matrix**: connect **people**, **job roles**, and **skills**, then compare **required level** vs **actual level** so gaps, extras, and target dates are visible.

Later modules share the same auth, people records, and (where relevant) **site → plant → cell** master data:

| Hub tile | What it is for |
|----------|----------------|
| **Skill Matrix** | Capability: who can do what, at what level, with training and assessment |
| **LDR tools** | Leadership roster and calendar, health checks, SOS / QOS / PPO observations |
| **RTT systems** | Plan 24 cell day/shift grid, CL / CIL / Quality checks, deviations, defects, quality fails |
| **DDS Process** | Daily / weekly direction-setting cascade (shift → line → plant → site), P2P, WDS, PDCA, e-plan |
| **Agents** | Apps Team board, road map, KPI cascade, standard work, and other AI helper shells |
| **Problem Solve** | BDE (breakdown elimination) plus placeholder IPS / UPS / etc. tools |
| **BMS Brain** | Business-system process matrix, forums, roles, AI insights |
| **Master data** | Super-admin org tree: sites, plants, cells, areas, equipment, shared people |
| **Login accounts** | Admin: login roles; Super admin: hub section flags |

---

## 2. Requirements

### 2.1 Platform requirements

- One login for all tools. No separate passwords per module.
- Access is **two-layered**:
  1. **Login role** (what you are allowed to administer vs operate)
  2. **Section flags** (which hub tiles you see)
- Email/password auth via Supabase. New registrations default to **operator** with **no hub tiles** until a super admin grants them.
- Client route guards **and** database RLS. UI alone is never the security boundary.
- Shared **master data** is the geographic hierarchy: Site → Plant → Cell → Area → Equipment.
- Scope bar choice (site / plant / cell) is stored in **localStorage per origin** (`localhost` and production do not share it).
- Open registration is allowed; first admin is promoted in the database (or bootstrap script). Passwords are never stored in `localStorage`.

### 2.2 Skill Matrix requirements

The Skill Matrix must:

1. Hold a **roster of people**, optional **team**, and one or more **job roles**.
2. Hold a **skill catalog** grouped into skill groups, with:
   - **Numeric** skills on a fixed 1–4 scale
   - **Certification** skills as yes/no
   - **Plan** skills as staged learning programmes linked to role requirements
3. Store **role skill requirements** (what a job role needs) separately from **person skills** (what a person currently has).
4. For each person × skill, show **required vs actual** and classify the gap (critical / minor / meets / exceeds / extra / N/A).
5. Allow **extra skills** (tracked even if not required by current roles).
6. Support **target dates** (`due_date`) for closing gaps, with operational views (overdue, next 7/30 days, no date). Due dates are **workflow discipline**, not a hard system gate — the UI does not force “gap ⇒ date required”.
7. Restrict **operators** to a read-only **My skills** view of their linked person.
8. Allow **assessors** (and admins) to edit skill records for people, run Matrix / Dashboard / Report.
9. Allow **admins** to configure catalog, training, assessment, teams, people, and (with Login accounts) login roles.
10. Support **operator self-training L1 → L2** when a training pack and quiz exist.
11. Support **assessor-led progression** (including L2 → 3) with assessment checklists / progression events for reporting.
12. Support **wide-screen matrix first** (dense grid, filters as chips, search). Target laptop and up.

### 2.3 Other app requirements (summary)

These are owned in more detail by the linked specs. In product terms:

- **LDR:** Plan leadership activities by week; assign people; RAG; cell vs site workspaces. Cell-created activities stay on that cell; site activities can also appear at cell. Health checks and observations are cell-level, template-driven, immutable after submit.
- **Plan 24 / RTT:** One **cell**, one **date**, one **shift**. Time × roster-role grid of scheduled and ad-hoc checks. Anyone with RTT access can execute Plan 24; **roster templates and schedules** are admin. Fail paths: CL → Deviation, CIL → Defect, Quality → Quality Fail.
- **DDS:** Meeting cascade. Admin configures KPIs / P2P / triggers / recognition / losses / WDS; floor uses Plan 24 and meetings. e-Plan is currently **localStorage** (not yet in Postgres).
- **Defect / deviation / quality-fail boards:** Shared board UX; **type catalogues are super-admin only**.
- **BMS Brain:** Extra governance layer (`viewer` / `editor` / `admin`) on top of hub access.

---

## 3. Key design principles

1. **One login, many apps.** Extra tools are **section flags**, not extra login roles.
2. **Least surprise, least privilege for Skill Matrix operators.** Operators consume their own skills; they do not browse other people’s matrix.
3. **Anyone granted an operational app can execute it.** Plan 24, health checks, DDS meetings, and similar floor work are **not** locked to assessors. Admin configures; operators/assessors with the tile can run the tool.
4. **Catalog vs execution.** Templates, types, skill catalogs, KPI catalogs = admin (or super admin). Completing a check, recording a score, filling a meeting = anyone with section access.
5. **Required level is role-driven.** A person’s requirement for a skill is the **maximum** across all assigned job roles. Changing roles changes the picture without rewriting history of actual scores.
6. **Colours are the operational language.** Same RAG / gap colours should mean the same thing wherever they appear (matrix cells, dashboard, HC RAG, roster RAG).
7. **Submitted records are history.** Health checks and observations: draft then **immutable submit**. Plan 24 uses **soft-delete with comment**, not silent rewrite.
8. **Conflicts warn, they do not block** on LDR roster (same person on two activities in one day) so coordinators can record reality.
9. **Site vs cell scoping is real data isolation** in LDR (separate workspaces). Skill Matrix itself is **org-wide**, not site-scoped.
10. **Specs and in-app user guides stay aligned** when behaviour changes.
11. **Desktop / tablet first** for dense grids (matrix, Plan 24, roster).
12. **English** as the product language.

---

## 4. Locked product decisions

These are decisions already reflected in code. Do not reverse them without an explicit product change.

| Decision | What we chose | Why |
|----------|----------------|-----|
| Login roles | `super_admin`, `admin`, `assessor`, `operator` | Operator/assessor/admin maps to Skill Matrix; super admin owns hub flags and master data |
| Legacy `user` | Treated as **operator** | Old profiles row; not a live role |
| **Accessor** | **Does not exist** | Closest match is **Assessor**. Do not invent a fourth Skill Matrix role |
| Job roles vs login roles | Job roles (`roles` / `person_roles`) are **catalog** (Packing 1, Team lead…) | They drive skill requirements and some Plan 24 columns, not hub access |
| New signup default | `operator`, all `can_access_*` = false | Super admin must grant tiles |
| `isAdmin` | `admin` **or** `super_admin` | Super admin inherits every admin screen |
| Hub home | `/` is always App Hub | Skill Matrix is `/matrix`, not `/` |
| Operator Skill Matrix | Redirect Matrix / Dashboard / Report → `/my-skills`, read-only | Operators must not score others |
| Required level | Max across job roles | Multi-skilled people keep the highest bar |
| Numeric scale | 1 No knowledge → 2 Theory → 3 Practical → 4 Expert/Trainer | Fixed, used everywhere |
| Certification | Required ≥ 1 = Yes required; actual ≥ 1 = Yes | Stored as numbers, treated as binary |
| Extra skills | `person_skills.is_extra` | Track skills outside role requirements |
| Due dates | Display + filter; no hard “must set date” | Workflow, not validation |
| L1 → L2 training | Operator can pass quiz; only if actual is still 1 | Self-serve theory step |
| L2 → 3 | Assessor / admin + progression events | Practical sign-off is not a self-quiz |
| Plan 24 v1 | No read-only RTT user; anyone with RTT access can run the grid | Shop-floor speed; D31 in Plan 24 spec |
| Plan 24 complete without all sub-tasks | **Admin override only** | D24 |
| HC / observations | Cell only; submit is final; admin-only delete of submitted records | Audit trail |
| LDR cell vs site | Cell-created activities/assignments stay on **that cell**; site-created activities can appear on cells | Leadership planning vs local execution |
| DH type catalogues | Super admin only | Governance of defect/deviation/quality-fail types |
| e-Plan v1 storage | `localStorage`, not Supabase | Fast prototype; not shared across browsers/devices |
| BMS Brain | Extra `bms_brain_role`; platform admin overrides | Process documentation has its own editors |
| Production URL | `https://training-system-seven.vercel.app` | Do not confuse with legacy `training-system.vercel.app` |

---

## 5. Roles and who can do what

### 5.1 Name mapping (read this first)

People often say **user**, **accessor**, or **assessor**. In this app:

| Everyday name | In the product | Notes |
|---------------|----------------|--------|
| **User** | **Operator** | Legacy DB value `user` is mapped to operator in the client |
| **Accessor** | **Assessor** (if they meant “assess skills”) | There is no accessor role, flag, or RLS policy |
| **Assessor** | `profiles.role = 'assessor'` | Edit skill scores; no catalog Admin |
| **Operator** | `profiles.role = 'operator'` | Skill Matrix: My skills read-only |
| **Admin** | `admin` | Full catalog + admin screens in granted apps |
| **Super admin** | `super_admin` | Admin + section flags + master data + DH type catalogues |

Job titles on the roster (Team lead, Packing 1, …) are **not** login roles.

### 5.2 Two independent switches

```
Login role          what you can administer and whether Skill Matrix is read-only
Section flags       which App Hub tiles you even see
```

Example: an **operator** with `can_access_rtt_systems` **can run Plan 24**. An **assessor** without that flag **cannot**.

App Hub tiles: Skill Matrix, LDR tools, RTT systems, Agents, DDS Process, Problem Solve, BMS Brain.  
Extra tiles: **Login accounts** (`isAdmin`), **Master data** (`isSuperAdmin`).

If no tiles are granted, Hub shows “contact an admin”.

### 5.3 Capability matrix (Skill Matrix)

| Capability | Operator | Assessor | Admin | Super admin |
|------------|----------|----------|-------|-------------|
| Open `/matrix`, `/dashboard`, `/report` | No (redirect to My skills) | Yes | Yes | Yes |
| Open `/my-skills` | Yes, **own person, read-only** | Yes; **any person** | Yes; any person | Yes |
| Edit actual level / due dates / extra skills | No in UI | Yes, any person | Yes | Yes |
| L1→2 training quiz (own linked person, actual = 1) | Yes | Yes | Yes | Yes |
| L2→3 / certification assessment | No | Yes | Yes | Yes |
| Admin catalog (`/admin`) | No | No | Yes | Yes |
| Skill Matrix User Guide (`/user-guide`) | Yes | Yes | Yes | Yes |
| Login accounts | No | No | Yes (cannot mint super_admin or change section flags) | Yes |
| Hub **Section access** flags | No | No | No | **Yes only** |
| Master data tree | No | No | No | **Yes only** |

**Staff** in the UI means “not operator”: assessor, admin, super admin.

**Self-edit exception:** non-operator staff whose login is linked to a `people` row may edit **their own** person in Matrix. Operators cannot.

### 5.4 Capability matrix (other apps, once the tile is granted)

“Operational user” here means operator **or** assessor (or admin) with that hub flag.

| Area | Operational user | Admin (`admin` / `super_admin`) | Super admin only |
|------|------------------|----------------------------------|------------------|
| LDR Calendar / Roster | Use, assign, RAG | Same + LDR Admin (people, activities, HC/OS types & templates) | — |
| Create LDR activity in **Cell** scope | (via Admin Activities while cell selected) | Cell-only; must not appear on Site | — |
| LDR Health Check / SOS / QOS / PPO | Create draft, complete, submit | Same; **delete submitted records**; configure types/templates | — |
| Plan 24 grid | Create / move / complete / ad-hoc / soft-delete | Same + **roster + schedules**; complete without all sub-tasks | — |
| RTT List view, DH, Deviations, Quality Fails | Day-to-day board work | RTT Admin templates/schedules | **Type catalogues** |
| DDS meetings, P2P, WDS, PDCA, e-plan actions | Use | DDS Admin catalogs | — |
| Apps Team / agent tools | Use if Agents flag on | Same | — |
| Problem Solve BDE | Records / reports | BDE catalogs | — |
| BMS Brain | Per `bms_brain_role` (viewer/editor/admin); platform admin overrides | Full | — |

### 5.5 Super admin

- Everything an admin can do.
- **Only** person who can toggle hub **Section access**.
- **Only** person who can assign/demote `super_admin`.
- **Only** writer of `master_sites` / `plants` / `cells` / `areas` / `equipment` (others with LDR/RTT access can **read** so scope bars work).
- **Only** editor of DH / deviation / quality-fail **type** catalogues.

### 5.6 Admin

- Login accounts: set Operator / Assessor / Admin (not super admin, not section flags).
- Skill Matrix: full catalog, training packs/standards/questions, assessment checklists, teams, people, all scoring.
- Each granted operational app: day-to-day **plus** that app’s Admin screen.
- LDR: delete submitted HC/observation records; configure types/templates.
- RTT: Plan 24 roster roles/shifts; check family templates and schedules; admin override on incomplete sub-tasks.
- DDS / Problem Solve: catalogs.
- BMS Brain: catalogs and processes (overrides `bms_brain_role`).

### 5.7 Assessor

- Typical tile: Skill Matrix (unless super admin granted more).
- Matrix, Dashboard, Report, My skills.
- Edit **anyone’s** `person_skills` (RLS `person_skills_write_assessor`).
- Training / assessment writes allowed with admin.
- **Cannot** open Skill Matrix Admin, Login accounts, or any `…/admin` screen.
- In LDR / RTT / DDS, if granted the tile: **same floor rights as an operator**, not a special “assessor” mode.

### 5.8 Operator (“user”)

- Skill Matrix: **My skills only**, **read-only** (`readOnly = isOperator`). RLS may still allow own-row writes; **the UI does not expose them**.
- Can take **L1→2 training** when actual = 1 and pack + quiz exist (pass writes 1→2).
- Other granted sections: **full operational use** (Plan 24, complete HC, DDS, raise defects). There is **no** Plan 24 read-only user in v1.
- Cannot see Skill Matrix Admin, Login accounts, or catalog admin. User Guide is available so operators can learn My skills and training.

### 5.9 BMS Brain extra layer

Only if the BMS Brain tile is on:

| `bms_brain_role` | View | Edit processes | Admin catalog |
|------------------|------|----------------|---------------|
| viewer | Yes | No | No |
| editor | Yes | Yes | No |
| admin | Yes | Yes | Yes |
| Platform admin / super admin | Yes | Yes | Yes |

---

## 6. Auth, routes, and guards

- Auth: Supabase email/password; `profiles` row created on signup.
- Session: Supabase client refresh token (not passwords in localStorage).

| Guard | Rule |
|-------|------|
| `ProtectedRoute` | Signed in |
| `GuestRoute` | Login / register only when logged out |
| `HomeRoute` | `/` → App Hub |
| `SkillMatrixAccessRoute` | `can_access_skill_matrix` |
| `StaffRoute` | Operators → `/my-skills` |
| `AdminRoute` | `isAdmin` (`/admin`) |
| `SectionAccessRoute` | Matching `can_access_*` (BMS Brain also requires admin) |
| App `…/admin` routes | `isAdmin` |
| `LoginAccountsAccessRoute` | `isAdmin` |
| `SuperAdminRoute` | Master data |

RLS helpers include `is_app_admin()`, `is_app_super_admin()`, `is_app_assessor()`, plus per-app `can_access_*` checks. Non-super-admins cannot change section flags (`profiles_protect_section_access`). Non-admins cannot escalate `role`; only super admin can mint `super_admin`.

---

## 7. Skill Matrix — pages and routes

Operators with Skill Matrix access still only land on My skills from Matrix/Dashboard/Report.

- **`/`**: App Hub (not the matrix)
- **`/matrix`**: Skill matrix grid (staff)
- **`/my-skills`**: My skills (operators: own, read-only; staff: pick people)
- **`/dashboard`**: Due-date dashboard (staff)
- **`/report`**: Training / assessment report (staff)
- **`/admin`**: Catalog, training, organisation (admin)
- **`/user-guide`**: Skill Matrix User Guide (anyone with the Skill Matrix tile)

---

## 8. Skill Matrix — data model

Main tables:

- **`people`** — `display_name`, `team_id`, `user_id` (optional login link)
- **`teams`**
- **`roles`** / **`person_roles`** — job roles, not login roles
- **`skill_groups`** / **`skills`** — `kind`: `numeric` | `certification` | `plan`
- **`role_skill_requirements`** — `role_id`, `skill_id`, `required_level`
- **`person_skills`** — `person_id`, `skill_id`, `actual_level`, `is_extra`, `due_date`
- **`person_skill_plans`** / **`person_skill_plan_stages`** — enrolment and stage progress for `kind = plan`
- **`skill_training_packs`**, **`skill_training_questions`**, **`skill_training_standards`**, **`skill_training_attempts`**
- **`skill_progression_events`** — L2→3 (if migration applied)
- **`skill_assessment_*`** — assessor checklists / sign-off
- **`profiles`** — login `role` + `can_access_*`

Plan enrolment is **synced to current roles**: a person is enrolled in a plan only if some assigned role has a requirement for that plan skill with `required_level >= 1` (triggers). After enrolment changes, `person_skills` rows for plan-only knowledge that are no longer tied to any enrolled plan stage are **removed**, unless `is_extra` or still required by a role (see `20260424230000_cleanup_orphan_plan_knowledge_person_skills.sql`).

---

## 9. Skill types and levels

### Numeric (`kind = numeric`)

- **1** = No knowledge  
- **2** = Theoretical understanding  
- **3** = Practical capability  
- **4** = Expert / Trainer  

### Certification (`kind = certification`)

- Required: `required_level >= 1` → Yes required  
- Actual: `actual_level >= 1` → Yes, else No  

### Plan (`kind = plan`)

Staged programme. Enrolment follows role requirements. Progress is per stage, not a single 1–4 cell in the same way as numeric skills.

---

## 10. How required level is calculated

People may have **multiple job roles**.

For each skill, required level = **maximum** `required_level` across all assigned roles.

If no assigned role requires the skill, required is **empty** (not required).

---

## 11. Gap / colour classification

Each person-skill cell is one of: **Critical gap** (red), **Minor gap** (amber), **Meets** (green), **Exceeds** (teal), **Extra skill** (blue), **N/A** (neutral).

### Numeric

Let \( \Delta = actual - required \).

- **N/A**: no required and no actual  
- **Extra**: `is_extra` **or** has actual while not required  
- **Critical**: actual missing **or** \( \Delta \le -2 \)  
- **Minor**: \( \Delta = -1 \)  
- **Meets**: \( \Delta = 0 \)  
- **Exceeds**: \( \Delta \ge 1 \)  

### Certification

If required is Yes:

- **Critical** if actual is missing/No  
- **Meets** if actual is Yes  

If not required: **N/A** unless tracked as Extra.

---

## 12. Due dates (targets)

Stored per person per skill as `due_date` (UI: “Target”).

- Shown and filtered on Dashboard and My skills tiles: **Overdue**, **Next 7 days**, **Next 30 days**, **No target date**.
- “No target date” is gaps (critical/minor) with no due date.
- The app does **not** auto-require a date when a gap appears.

---

## 13. Extra skills

`person_skills.is_extra = true`:

- Not required by current roles  
- Still tracked (Extra skill colour)  

In My skills: section **“Extra skills tracked”**, added via **“Add extra”** (skill not required and not already tracked).

---

## 14. Matrix behaviour

Wide grid: **rows = people**, **columns = skills** (by skill group), **cells = required/actual + colour**.

Filters: person search, skill search, job-role chips, team chips, skill-group chips, reset.

Legend matches §11.

---

## 15. My skills behaviour

- **Operator:** own linked person, read-only.  
- **Assessor / admin:** any person; own person editable when login is linked.  

Splits **Required for your roles** vs **Extra skills tracked**. Filters: gap type, skill group; staff also get person / team / role. Due-date tiles as in §12.

---

## 16. Training (Level 1 → 2)

Available when:

- skill is **numeric**
- person’s **actual level is 1**
- a **training pack** exists
- the skill has **quiz questions**

Flow: standards and/or downloadable pack → quiz → attempt stored in `skill_training_attempts`. **Pass** sets actual 1 → 2 **only if still 1**.

Higher steps and certifications: assessor workflow, not this quiz.

---

## 17. Dashboard (staff)

Focus: **targets**. Tiles for overdue / 7 / 30 / no date; overdue table; coming-due table; 12-week / 12-month bar chart (clickable buckets).

---

## 18. Report (staff)

- **Training completions:** L1 → 2 from **passed** `skill_training_attempts`  
- **Assessments / promotions:** L2 → 3 from `skill_progression_events` if present  
- Role-based gap summaries from current matrix state  

If `skill_progression_events` is missing, the page notes that and L2→3 charts stay empty. Events are not backfilled.

---

## 19. Admin setup (Skill Matrix)

Admin sections today:

- **Catalog** — skill groups, skills (numeric / certification / plan), job roles, role skill requirements  
- **Training** — packs, questions, standards  
- **Organisation** — teams, people (roster, roles, link logins)  
- **Access** — on **Login accounts** (not inside `/admin`): operator / assessor / admin  

Recommended setup order (also in User Guide):

1. Skill groups  
2. Skills  
3. Job roles  
4. Role skill requirements  
5. People, teams, link logins, assign job roles  
6. Training packs for L1→2; assessor sign-off for higher / certifications  

---

## 20. Other apps — short behaviour notes

### 20.1 Scoping

| App | Scope |
|-----|--------|
| Skill Matrix | Org-wide people / teams / skills |
| LDR Calendar / Roster | **Site or Cell** workspace (`ldr_ensure_workspace_site` / `_cell`) |
| LDR HC / observations | **Cell required** (separate filter so roster site-scope does not bleed in) |
| Plan 24 / most RTT / Shift DDS / WDS | **Cell + date + shift** required |
| Site / Plant DDS, site PDCA | Site (and plant) from the same RTT/DDS bar |
| BMS Brain / most Agents | No site–plant–cell bar |

Default demo cell in some flows: Darfield Powder. LDR and Plan 24 people lists relate to shared `people` plus LDR-specific `ldr_people` overlay (status, avatar) in LDR Admin.

### 20.2 LDR tools

- Calendar: week of all-day events.  
- Roster: people × activities × days; RAG and comments; complete HC / SOS / QOS / PPO from an assignment when templates exist.  
- **Cell vs site:** activities created in Cell belong to that cell workspace only (not Site). Site activities can be shown on a cell roster. Assignments made in Cell scope stay in the **cell** workspace even if the activity originated as a site activity.  
- Admin: LDR people, activities, site-activity visibility on cell, HC/OS types and templates.  

### 20.3 RTT / Plan 24

- Time axis from shift windows; night as one continuous window.  
- Overlaps allowed (stacked). Same person in multiple roles: warn, do not block.  
- Soft-delete with comment; ~1 year retention (spec).  
- Check families share an engine, **separate tables**; colours: Checks dark blue, CL green, CIL teal, Quality purple.  
- List view unifies families. Area / Equipment from master data.  

### 20.4 DDS Process

- Cascade: Shift → Line → Plant → Site. Leadership enables; line adds value.  
- P2P: people-to-process audits. Triggers: safety/quality scorecards. WDS: weekly KPI columns vs targets.  
- e-Plan: one-page improvement actions, cell-owned, **localStorage** in v1.  
- PDCA: site or cell boards.  

### 20.5 Agents, Problem Solve, BMS Brain

- Apps Team: ticket kanban (intake → design → build → test → deploy).  
- Other agent routes may be placeholders.  
- BDE: breakdown records, codes, photos, actions, reports. Other problem-solve routes may be placeholders.  
- BMS Brain: process matrix, versioned diagrams, AI insights, catalogs for roles / forums / systems.  

---

## 21. Domain data (platform, high level)

| Domain | Main storage |
|--------|----------------|
| Auth | `auth.users`, `profiles` (`role`, `can_access_*`, `bms_brain_role`) |
| Skill Matrix | People, teams, job roles, skills, requirements, person_skills, plans, training, assessments |
| Master data | `master_sites` → `master_plants` → `master_cells` → `master_areas` → `master_equipment` |
| LDR | `ldr_workspaces`, `ldr_people`, `ldr_activities`, `ldr_events`, `ldr_assignments` |
| HC / OS | `hc_*`, `sos_*`, `qos_*`, `ppo_*`, `obs_system_activity_links` |
| Plan 24 | `plan24_rosters`, roles/shifts, events, tasks, check templates/schedules |
| RTT issues | `dh_*`, `deviation_*`, `quality_fail_*` |
| DDS | KPI groups/KPIs, P2P, triggers, recognition, top losses, WDS, PDCA |
| e-Plan | `localStorage` (`rtt-systems.eplan.*`) |
| BDE | `bde_records` and related |
| BMS Brain | roles, forums, systems, processes, versions |
| Apps Team | tickets / messages (Edge Function + DB) |

Catalog writes generally `is_app_admin()`. Skill scores: admin + assessor (+ RLS own person). LDR/RTT operational writes: matching `can_access_*`. Master structure writes: super admin.

---

## 22. In-app guides

Every hub area has a User Guide written for people who run the work (not only admins). Common sections: why the app exists, design principles, value, detailed functionality, design, process, colour coding, connections to Master data and other apps, and who can do what.

| Guide | Who | Route |
|-------|-----|--------|
| Skill Matrix | Anyone with the Skill Matrix tile | `/user-guide` |
| LDR tools | LDR tile | `/ldr-tools/user-guide` |
| RTT systems | RTT tile | `/rtt-systems/user-guide` |
| Agents | Agents tile | `/agents/user-guide` |
| DDS Process | DDS tile | `/dds-process/user-guide` |
| Problem Solve | Problem Solve tile | `/problem-solve/user-guide` |
| BMS Brain | BMS Brain tile (or platform admin) | `/bms-brain/user-guide` |
| Master data | Super admin | `/master-data/user-guide` |
| Login accounts | Admin / super admin | `/login-accounts?tab=guide` |

Keep the matching page under `web/src/pages/` aligned when behaviour changes.

---

## 23. Non-goals / out of scope (current)

- No **accessor** role (use assessor).  
- No Skill Matrix **site/plant/cell** filter (org-wide).  
- No Plan 24 **read-only** login in v1.  
- e-Plan **not** yet synced to Postgres or Plan 24 events.  
- Observation / HC **v2 reports have no export**.  
- Several Agents and Problem Solve tiles are **placeholders**.  
- My Plan (`/rtt-systems/my-plan`) is not wired.  
