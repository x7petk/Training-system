# Health Checks App (HC) — Version 2 — Specification

**Status:** v2.2 — implementation-aligned (see §16–§17); HC UI + report trends + roster integration shipped in app  
**Placement:** New section under **LDR tools** (same app shell / navigation pattern as Calendar, Roster, Admin)  
**Location model:** Must use existing **Master data** hierarchy only — `master_sites` → `master_plants` → `master_cells` (same IDs and semantics as LDR scope). Health checks are **completed at cell level only** (a submitted record always references one `master_cells.id`).

**Reference:** Legacy Power Apps “Health Checks” UI (Fonterra example) informed layout expectations; **v2 replaces table-style rows with card-based question UI** and adds live scoring, **Create Action** as a non-functional placeholder button, and immutable submitted records.

---

## 1. Overview

The Health Checks (HC) app is used to:

- Validate execution of standards at **cell level**
- Surface gaps in process, safety, quality, and leadership
- Provide a **system health signal** (scores, RAG, trends) — not only a passive checklist

Principles:

- HC is **executed at cell scope only** (Site + Plant + Cell must be selected to start or filter a run)
- Content is driven by **standardised templates** (versioned, one active template per type)
- Submitted runs are **immutable** (snapshot of template + answers; no edit after submit)
- **Operators / assessors** complete checks; **admins** maintain types and templates (questions, flags); **HC Report** is available to all LDR users; RAG rules are **global** (§8)

---

## 2. App Structure (within LDR tools)

### 2.1 Navigation tabs

| Group | Tab | Purpose |
|--------|-----|---------|
| **Admin** | HC Types | CRUD categories (Safety, Quality, Process, Leadership, DDS, …) |
| **Admin** | HC Templates | Template versions, questions, thresholds, activation rules |
| **Main** | Health Checks | Start new HC, complete in-progress, open submitted (read-only) |
| **Main** | HC Report | Filtered analytics only — **no export** in v2 (see §10) |

**Visibility:** Anyone who can access **LDR tools** sees **Health Checks** and **HC Report**. Tabs under **Admin** (HC Types, HC Templates) are **admin / super_admin only** — all other HC settings and configuration live under those admin routes over time.

**Note:** Exact route paths TBD (e.g. `/ldr-tools/health-checks`, `/ldr-tools/health-checks/report`, `/ldr-tools/health-checks/admin/...`). Must reuse `SectionAccessRoute(section="ldr")` and align admin gating with existing **Admin / super_admin** patterns.

---

## 3. Roles & Permissions

| Capability | Admin / Super admin | Anyone with LDR access |
|------------|---------------------|-------------------------|
| HC Types & Templates (Admin tab) | Yes | No |
| Define questions, order, critical flags, help text; optional `threshold_score` for future use | Yes | No |
| Start & complete HC at cell | Yes | Yes |
| Save draft / resume before submit | Yes | Yes |
| Open submitted HC (read-only) | Yes | Yes |
| HC Report (filters & views) | Yes | Yes |

**Hard rules**

- Submitted HC **cannot** be edited (answers, comments, score frozen)
- Templates **cannot** be changed by operators; template changes create new versions / deactivate old
- **RAG bands** are **global** (not per-template) — see §8; `threshold_score` on template is optional for future use (e.g. reporting) and does **not** drive RAG in v2

**Open (minor):** Map “Admin” to `profiles.role` (`admin`, `super_admin`) exactly as elsewhere in LDR.

---

## 4. Core Concepts

### 4.1 HC Type (category)

Represents a **category** of health check, e.g. Safety, Quality, Process, Leadership, DDS.

**Fields (conceptual):**

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `name` | Display name |
| `description` | Optional |
| `active` | Soft-disable |
| `sort_order` | Display order in pickers |

### 4.2 HC Template

- Belongs to exactly one **HC Type**
- Holds an **ordered** list of questions
- **Version controlled**; **at most one active template per HC Type**
- Older versions remain stored for audit and for records that referenced them

**Fields (conceptual):**

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `hc_type_id` | FK → HC Type |
| `name` | e.g. “DDS v3 — 2026 Q2” |
| `version` | Integer or semver string (product decision) |
| `description` | Optional |
| `active` | Only one `active=true` per `hc_type_id` |
| `threshold_score` | Optional numeric field for future reporting / “target line”; **RAG in v2 uses fixed global bands** (§8), not this field |
| `created_at` / `updated_at` | Audit |

### 4.3 Template question

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `template_id` | FK |
| `question_text` | Shown on card |
| `expected_standard` | Distinct visual block on card |
| `sort_order` | Order within template |
| `active` | Allow retiring questions in new versions |
| `is_critical` | Shown on card (badge); **does not** change RAG or block submit in v2 (see §9) |
| `help_text` | Optional expandable help |

### 4.4 HC Record (submitted run)

A **single completed instance** of a check at a **cell**, at a point in time, bound to a **template snapshot**.

**Immutability:** On submit, persist:

- Template id + version (or snapshot JSON)
- Copy of each question’s `question_text` and `expected_standard` on answers (see §7)

---

## 5. Admin Module

### 5.1 HC Types management

- List, create, edit, deactivate
- Used in “New HC” type picker

### 5.2 HC Templates management

- Create new version from type
- Edit draft template until published?
- **Activate** template → automatically **deactivate** previous active for that type (enforce in app + DB constraint if possible)

### 5.3 Questions editor

- Reorder (drag or move up/down)
- Set critical flag, help text
- Preview card layout (optional nice-to-have)

---

## 6. Health Checks module — user flow

1. User opens **Health Checks** → **New HC**
2. Select **Site** → **Plant** → **Cell** (master data pickers; cell required)
3. Select **HC Type**
4. System loads the **single active template** for that type
5. User answers each question on **cards** (see §6.2)
6. **Live score** updates (§6.4)
7. **Save draft** (optional) or **Submit** → validate rules (§6.5) → on submit, record locked **read-only**

**Drafts:** **Allowed** — user may save in-progress answers and resume later; draft rows are not immutable until submit.

---

## 6.2 UI design (critical)

### Layout

- **Card per question** (no wide table of rows like legacy Power Apps)
- Clear separation: **Question** vs **Expected standard** (typography / panel)

### Question card contents

1. **Question** (title)
2. **Expected standard** (secondary block)
3. **PASS / FAIL** — large toggle pair  
   - Default: **neither** selected  
   - PASS: green selected state  
   - FAIL: red selected state  
4. **Comment**  
   - Optional when PASS  
   - **Required when FAIL** (block submit otherwise)  
   - Placeholder: `Required if FAIL – describe issue or action`
5. **Critical** indicator — e.g. badge 🔴 or “Critical” label when `is_critical`
6. **+ Create Action** — **per question**, visible when FAIL; **v2: non-functional** (no stub form, no backend write) — button only for future linking (§9)

### Live score (mandatory)

- Fixed area **top-right** while completing  
- Example: `Score: 75% (6/8)`  
- Formula: `(pass_count / total_questions) × 100` where each question counts equally (see §6.4)

---

## 6.3 Input behaviour

| Rule | Behaviour |
|------|-----------|
| PASS | `score_value = 1`; comment optional |
| FAIL | `score_value = 0`; comment **required** |
| Unanswered | Treated as incomplete; **cannot submit** |
| Critical + FAIL | **No** extra validation in v2; `is_critical` is display-only for RAG/submit (§9) |

---

## 6.4 Score logic

- Each question: **PASS = 1**, **FAIL = 0**
- **Score %** = `ceil(100 * passes / total_active_questions)` — **always round up** to integer percent (e.g. 6/8 → 75%)
- **Live** recalculation on every answer change

---

## 6.5 Submission rules

Before submit, enforce:

- Site, Plant, Cell selected (`master_site_id`, `master_plant_id`, `master_cell_id` or equivalent FKs)
- HC Type selected
- **Every** question has PASS or FAIL
- Every FAIL has non-empty comment
- **No** action workflow, **no** Create Action completion required (§9)

**Duplicate policy (implemented):** At most **one submitted** HC per **(completer `completed_by_user_id`, `hc_type_id`, `master_cell_id`, scheduled day)**. Scheduled day is `ldr_assignments.assignment_date` when `ldr_assignment_id` is set (roster path); otherwise the **UTC calendar date** of `completed_at` is used. Drafts do not count. Another user may still submit for the same cell/type/day; the same user may submit on a **different** scheduled day or cell or type.

**Roster integration (implemented):** Optional `ldr_assignment_id` on `hc_records`. **Complete HC** from the roster passes assignment id and **completion date** (scheduled day). On submit, server trigger may set assignment `rag_status` (HC amber → roster yellow) and **append** plain newline-separated comments (overall + per-question comments) to `ldr_assignments.comment`. Activity/type must match; client fallback exists if schema lags.

After submit:

- Record and answers **read-only**
- Optional `overall_comment` on record (product decision)

**Delete (implemented):** Only **app admin** (`is_app_admin`) may delete `hc_records` (draft or submitted). Operators cannot delete.

---

## 6.6 Completed HC list

**Columns (suggested):**

| Column | Source |
|--------|--------|
| Date | `completed_at` |
| HC Type | Type name |
| Site / Plant / Cell | Resolved from master IDs |
| Completed by | `completed_by_name` (and user id) |
| Score | Percent |
| Status (RAG) | Computed at submit (§8) |

**Actions:** Open → **read-only** detail view (same card layout, disabled controls)

---

## 7. Data model (logical)

### 7.1 HC Record

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `hc_type_id` | FK |
| `template_id` | FK — template used |
| `master_site_id` | FK → `master_sites` |
| `master_plant_id` | FK → `master_plants` |
| `master_cell_id` | FK → `master_cells` — **required** |
| `workspace_id` | Optional: link to `ldr_ensure_workspace_cell` result for RLS — TBD |
| `completed_by_user_id` | FK → auth user |
| `completed_by_name` | Denormalised display |
| `operator_name` | **Free text** (legacy “Operator”); not linked to people directory in v2 |
| `completed_at` | timestamptz; null while draft |
| `score` | 0–100 |
| `status` | `green` \| `amber` \| `red` (or enum) — set at submit from §8 |
| `overall_comment` | Optional |
| `created_at` | Always; draft vs submitted distinguished by `completed_at` / `submitted_at` if split |

### 7.2 HC Answer (line items)

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `hc_record_id` | FK |
| `template_question_id` | FK (historical id) |
| `question_text_snapshot` | Text at submit |
| `expected_standard_snapshot` | Text at submit |
| `answer` | `pass` \| `fail` |
| `score_value` | 1 or 0 |
| `comment` | Text |
| `action_created` | Reserved for future; **v2:** unused (button does not persist) |
| `action_reference` | Reserved for future DDS/IPS integration |

---

## 8. Status logic (RAG)

RAG uses **fixed global bands** on the **integer score %** (after §6.4 rounding):

| Status | Rule (on computed %) |
|--------|----------------------|
| **Green** | Score **strictly greater than 80** (`> 80`) |
| **Amber** | Score **from 60 through 80 inclusive** (`60 ≤ score ≤ 80`) |
| **Red** | Score **strictly below 60** (`< 60`) |

- **Critical FAIL** does **not** override RAG — status follows **percentage only** in v2.
- **Frozen at submit:** Persist `status` (and `score`) on the record at submit; later template changes do not rewrite historical rows.

---

## 9. Action integration (v2 scope)

### 9.1 UI

- **Create Action** appears **on the question card** when the answer is **FAIL** (same placement as legacy intent)
- **v2 behaviour:** Control is a **button only** — no navigation, no modal, no API, no `action_created` updates; wire-up deferred

### 9.2 Validation

- **No** requirement to create or complete an action before submit (critical or otherwise)

### 9.3 Future

- Integrate with DDS Actions, IPS, DH; then persist flags / external references on answers

---

## 10. HC Report module

### 10.1 Filters (implemented)

- **Date range** (`completed_at`, UTC day boundaries on range inputs)
- **Site / Plant / Cell** — **not** used on HC Report: the scope bar is **hidden** on `/ldr-tools/health-checks/report`, and queries do **not** filter by master site/plant/cell (all rows visible under RLS for LDR users)
- **HC Type** (optional)
- **Completed by** (optional); completer dropdown is populated from the same date/scope/type filters (separate capped query) so it stays usable when the table is filtered to one person

### 10.2 Views (implemented in UI)

| View | Metrics |
|------|---------|
| Summary | Total completed, average score, score-band split (&gt;80 / 60–80 / &lt;60), RAG counts (green/amber/red) |
| RAG distribution | Stacked bar + legend (percent of rows per RAG) |
| By week | Monday-week buckets (local calendar, same helper as roster): bar height = completion **volume**; label shows **avg score** that week; scrollable row + text list |
| By type | Count and average score per HC Type (sorted by count) |
| By completer | Count and average score per completer (scrollable table) |
| Records | Flat list with Open link (same columns as before) |

**Export:** **Not in v2** — no CSV/PDF.

**Access:** Same as **Health Checks** main module — everyone with LDR access; **not** hidden behind Admin tab.

**Implementation note:** Client aggregates up to **500** detail rows + **800** rows for completer distinct scan under current filters; for very large tenants, move aggregates to Supabase RPC / SQL views.

---

## 11. Alignment with existing codebase

- **Site / Plant / Cell:** `master_sites`, `master_plants`, `master_cells` (same as LDR scope bar and Master data admin)
- **No parallel hierarchy** for HC
- **LDR tools shell:** Reuse `LdrToolsLayout` / `AppSectionLayout` patterns; add nav items for Health Checks + Report + Admin sub-routes
- **Auth:** `useAuth` / `profiles` for role and `can_access_ldr_tools`
- **RLS (v2.1):** HC records and report aggregates are visible to **everyone who has LDR access** (same gate as the section), not narrowed by site/plant/cell membership in this phase — refine later if needed

---

## 12. API / implementation shape

This app uses **Supabase** (PostgREST), not a separate REST server. “Endpoints” map to:

- Tables with **RLS** policies
- Optional **RPC** functions for reports and “activate template” transactions

Suggested tables (names indicative):

- `hc_types`
- `hc_templates`
- `hc_template_questions`
- `hc_records`
- `hc_answers`
- (future) `hc_actions` or link to external action id

---

## 13. UX principles

- One primary flow per screen; minimal depth
- Large touch targets (tablet-first, same as LDR roster/calendar intent)
- Strong visual hierarchy: question vs standard vs actions
- Fast PASS/FAIL toggles; live score always visible while completing
- Mobile-friendly stacked cards

---

## 14. Future enhancements

- Photo attachments per question
- Auto DDS trigger on critical fail
- Notifications / reminders
- Recurring scheduled HC
- Heatmaps by cell
- AI insight / benchmarking across sites

---

## 15. Build notes (for implementation)

- [ ] Use master data IDs only for location
- [ ] Enforce read-only UI after `completed_at` set
- [ ] Snapshot question text on answers at submit
- [ ] Card-based question list component
- [ ] Live score in header during completion
- [ ] Per-question Create Action button (FAIL only); no-op until integration
- [ ] DB constraint: at most one active template per `hc_type_id`
- [x] Duplicate submit guard per §6.5 (scheduled day + completer + cell + type); DB trigger + UI pre-check
- [ ] RLS: users see records for cells/sites they’re allowed to (policy TBD)

---

## 16. Locked product decisions (v2.2)

| Topic | Decision |
|--------|-----------|
| RAG bands | **Green** if score **> 80**; **amber** if **60 ≤ score ≤ 80**; **red** if **< 60**. Critical FAIL does **not** force red. |
| Rounding | **Round up** (`ceil`) to integer %. |
| Drafts | **Allow** save and resume before submit. |
| Duplicates | **One submitted** HC per **same completer + cell + type + scheduled day** (assignment date when linked; else UTC day of `completed_at`). See §6.5. |
| Operator | `operator_name` optional; roster **Complete HC** flow prefills **completion date** instead of requiring operator on the new-HC form. |
| Create Action | **Button only** in v2 — no actions pipeline, no validation before submit. |
| HC Report | **Everyone** with LDR access (same as main HC). **No** LDR scope bar on report route; filters: date, type, completer (no site/plant/cell filter). Trends: summary, RAG bar, weekly volume/avg, by type, by completer. |
| Export | **None** in v2. |
| Visibility | All LDR users see Health Checks + HC Report; **Admin** tab (types/templates/settings) **admin/super_admin only**. |
| RLS | **All** users with `can_access_ldr_tools` can read HC data used by main + report (not admin screens). |
| HC delete | **Admin only** (`is_app_admin`); operators cannot delete records. |
| Roster feedback | On submit with valid `ldr_assignment_id`, update assignment **RAG** and **append** comment lines from HC (plain text, one comment per line). |

**Still TBD (non-blocking for first build):** `workspace_id` on `hc_records` for future stricter RLS — optional until assignments model is required.

---

## 17. Changelog

- **v2.2:** HC Report — compact filters (date / type / completer); **scope bar hidden** on report route and **no** site/plant/cell query filter (RLS-wide). **RAG distribution**, **weekly trends** (Mon-week volume + avg), **by completer**, expanded summary bands; completer filter fed by dedicated query.
- **v2.2:** Roster **Complete HC** — `completionDate` query param; optional `ldr_assignment_id`; submit syncs RAG + comments to assignment; duplicate rule uses **scheduled assignment day** when linked.
- **v2.2:** HC delete — **admin-only** (DB policy + UI).
- **v2.1:** Stakeholder answers incorporated; open-question section replaced by §16.
- **v2.1:** Initial duplicate policy discussion (superseded by v2.2 scheduled-day + completer rule in §6.5 / §16).
