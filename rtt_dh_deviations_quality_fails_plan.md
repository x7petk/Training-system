# RTT: Defect Handling (DH), Deviations, and Quality Fails — Concept & Development Plan

**Status:** **Defect Handling (DH) v1 implemented** in repo (DB + RTT UI); Deviations and Quality Fails remain planned.  
**Related:** [`plan_24_rtt_planning.md`](./plan_24_rtt_planning.md) (Plan 24 will surface DH later).  
**Guidance:** External “BMS Accelerator” style DH notes remain **high-level intent** only.

---

## 0. Locked decisions (2026 — product answers)

| Topic | Decision |
|--------|----------|
| **Delivery order** | **Defect Handling first** — ship and fine-tune DH; then build **Deviations** and **Quality Fails** using the same patterns. |
| **Separation** | **Separate systems** — separate storage, nav entries, and type catalogues per product when each ships. |
| **DH defect types (canonical seven)** | Safety, Quality, Base Condition, Source of Contamination, Hard to Reach, Minor, Unnecessary items — seeded in DB; **super admin only** may add/edit/deactivate/reorder types (**RTT Admin → DH defect types** tab). RTT users only see **active** types when logging defects. |
| **Deviations / Quality fails** | **Not built yet**; prior “single type each” idea still applies when those modules start. |
| **Location / asset** | **Any level** in v1 — optional free-text **location summary** on each defect (no mandatory equipment FK). |
| **CL / CIL / Quality in Plan 24** | **Built later**; no check-linked auto flows until then. |
| **Creation from checks** | **Manual only for now** — defects created from **Defect Handling** screen; optional `plan24_events` link field **deferred**. |
| **Navigation** | DH under **RTT systems** → **Defect Handling**; type admin only on **DH defect types** tab (super admin). |
| **IPS / standards** | **Out of scope for now**. |

**Storage direction (engineering):** **Option A** — separate table families (`dh_*` shipped; `deviation_*` / `quality_fail_*` later). Migration: `20260423100000_dh_defect_handling.sql`.

---

## 1. Product intent (three parallel tracks)

| System | Primary link (v1 concept) | Typical trigger |
|--------|---------------------------|-----------------|
| **Defect Handling (DH)** | **CIL** (and standards / IPS as follow-ons) | Failed CIL check, manual, audit, P2P, etc. |
| **Deviations** | **CL** | Failed CL check, manual, … |
| **Quality Fails** | **Quality checks** | Failed quality check, manual, … |

**Shared idea:** Operators and leaders can **raise** a record **manually** from a dedicated app in v1; later, **Plan 24** will add CL / CIL / quality check types and optional “raise from check” flows. Each record has a **lifecycle**, **ownership**, and **classification**. **IPS / standards links are deferred** (see **§0**).

**Principle (from DH guidance, paraphrased):** A raised item should drive **ownership** and **action**, not sit unowned.

---

## 2. Scope boundaries

### In scope (phased)

- Creation, listing, filtering, detail view, status transitions, ownership, due dates, comments, attachments (as engineering can deliver incrementally).
- **Source typing:** manual vs linked check (CL / CIL / Quality) vs other sources named in your roadmap.
- **Admin:** configurable types/categories (with sensible defaults), possibly priorities, mandatory fields policy.
- **Reporting:** counts, open vs closed, basic cycle time (when timestamps exist).
- **Plan 24 (later):** surfacing open items as tasks / tiles; raising from check completion UI.

### Explicitly deferred unless you reprioritise

- AI / predictive / automated root cause (per DH “Phase 1 excluded” style list).
- Full parity with every BMS field on day one.

---

## 3. Conceptual alignment (high level)

### 3.1 Defect Handling (DH)

**Implemented (v1):** tables `dh_defect_types`, `dh_defects`; UI `Defect Handling` + super-admin **DH defect types**; lifecycle `open | in_progress | resolved | closed`; priorities `low | medium | high | critical`; soft **archive** via `deleted_at`.

External reference document summarised (vision beyond v1):

- **Purpose:** Structured identification, ownership, resolution; link to checks, IPS, standards; reporting.
- **Defect types (this product):** the **seven** names in **§0** (not the older BMS examples list).
- **Lifecycle (example):** OPEN → IN PROGRESS → RESOLVED → CLOSED (with “verified before close” rule in guidance).
- **Creation sources (BMS vision):** Manual, failed checks, audits, P2P, system — **v1 in this repo:** **manual** only; other sources later.
- **Integrations (BMS vision):** Checks, standards, IPS, PftD — **v1 in this repo:** **none** of IPS/standards; Plan 24 surfacing **later**.

**This repo:** Location can be **any level** (**§0**); map optional area/line/equipment to free text and/or future master data under site → plant → cell.

### 3.2 Deviations (CL-linked)

Same **behavioural family** as DH, **separate** product and type model:

- **v1:** **One** type/category (minimal catalogue); expand when CL checks ship in Plan 24.
- **Future:** `source_*` pointing at **CL** check instances when those events exist.

### 3.3 Quality Fails (Quality-check-linked)

Same pattern again, **separate** from DH and Deviations:

- **v1:** **One** type/category (minimal catalogue).
- **Future:** link to **quality check** artefacts when Plan 24 (or linked HC-style quality) exposes them.
- **Naming:** keep “Quality fail” distinct from DH type **“Quality”** to avoid user confusion in lists and reports.

---

## 4. Architecture options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Three table families** | `dh_*`, `deviation_*`, `quality_fail_*` (+ optional small `*_types` per system) + shared React patterns | Matches **separate systems**; independent types and RLS; clearest product boundaries | Some duplication across migrations and UI shells |
| **B. One generic table** | e.g. `rtt_issues` with `kind ∈ {dh, deviation, quality_fail}` + JSON or extension tables | DRY | Weaker fit to **separate** type catalogues (DH 7+Other vs single-type others) unless heavily branched |
| **C. Hybrid** | Shared core + per-kind sidecars | Balance | More indirection |

**Selected for v1 planning:** **Option A** — three separate storage families, consistent with **§0** (separate systems, separate DH types vs minimal types for the other two).

---

## 5. Cross-cutting data (draft — not schema)

Fields the three systems likely **share** (exact names TBD):

- Identity: `id`, tenant/workspace, `master_cell_id` (minimum), **optional** location fields at **any** level you support in v1 (free text and/or FKs to future `equipment` / `line` master data — **TBD in ERD**).
- **Classification:** type/category (per-system rules per **§0**), priority, title, description.
- **Source (future):** `source_kind` + optional reference to Plan 24 event / check — **nullable in v1**; creation is **manual** until CL/CIL/quality checks exist.
- **Ownership:** `owner_person_id` (or user), `created_by`, `status`, `due_at`, `resolved_at`, `closed_at`.
- **IPS / standards:** **Not in v1 schema** (per **§0**); add columns or join tables when product prioritises.
- **Attachments:** storage bucket + metadata table pattern (same as HC attachments if applicable) — **optional** in first slice if time-constrained.

**DH types (seed):** Safety, Quality, Base Condition, Source of Contamination, Hard to Reach, Minor, Unnecessary items — **slugs** stable (`safety`, `quality`, …); **super admin** edits labels / order / active flag.

---

## 6. Permissions (draft)

External DH doc lists roles (Super Admin, Admin, Assessor, User, Read-only). This app already uses **`profiles.role`** (`admin`, `assessor`, `operator`) for Skill Matrix / RTT.

**Planning task:** Map BMS roles → existing app roles + optional new flags (e.g. `can_manage_all_dh`) or keep **admin / assessor** as “config + all defects”, **operator** as “create + own assigned” — **decision needed**.

---

## 7. Development plan (phased — no dates)

### Phase 0 — Spec lock (partially done)

- **§0** decisions recorded; remaining open items in **§9** (still TBD).
- ERD + RLS matrix for **three table families** (**§4 Option A**).
- Per-system **minimum fields** list for create/edit (align with “any level” location + manual-only source).

### Phase 1 — **DH v1** (done / in repo)

- **DB:** `public.dh_defect_types`, `public.dh_defects` + RLS (`app_user_can_access_rtt` on defects; types **SELECT** for RTT users on active rows only, **full CRUD** for `is_app_super_admin()`).
- **UI:** `/rtt-systems/defect-handling` — list/filter, create/edit modal, archive; uses **Plan 24 scope bar** for `master_cell_id`. `/rtt-systems/admin` tab **DH defect types** — **visible only to `super_admin`**.
- **Seed types:** seven labels per **§0**.

### Phase 1b — Deviations + Quality Fails (next, after DH fine-tune)

- Mirror DH: own `*_types` + `*_records` tables, RTT nav placeholders already exist; replace stubs with real pages.

### Phase 2 — Plan 24 check types (when built)

- Add **CL**, **CIL**, **Quality** as first-class Plan 24 event kinds per roadmap.
- Optional **“Raise [DH | Deviation | Quality fail]”** from a check detail flow — still **user-driven** unless product later requests auto-create.

### Phase 3 — Plan 24 surfacing

- Open items visible on the day grid / task strip (per `plan_24_rtt_planning.md`); filter by system.

### Phase 4 — IPS / standards / escalation (deferred)

- Revisit when IPS and standards/OPL exist in DB; add links + escalation rules from DH-style guidance.

### Phase 5 — Reporting & polish

- Counts by type/status, cycle time, repeat detection (when data exists); Pareto / trends later.

---

## 8. Documentation deliverables (this file + follow-ups)

| Deliverable | Owner | Note |
|-------------|--------|------|
| This plan | ✓ | **§0** locked; revise as product evolves |
| Per-system **user stories** + acceptance criteria | Product + eng | After remaining **§9** items |
| **ERD** + RLS matrix | Eng | **DH** done in migration; extend when Deviations / QF ship |
| Plan 24 integration addendum | Eng | When Phase 2–3 in **§7** start |

---

## 9. Resolved vs open questions

### Resolved (see **§0**)

| # | Topic | Answer |
|---|--------|--------|
| Delivery order | **DH first**; Deviations + Quality Fails after fine-tune | ✓ |
| DH types | Seven fixed names + **super-admin-only** catalogue UI | ✓ |
| Type catalogues | Separate per system when each ships | ✓ |
| Location | Any level; DH v1 = optional **location summary** text | ✓ |
| CL/CIL/Quality in Plan 24 | Later | ✓ |
| Check → issue creation | Manual for now | ✓ |
| Navigation | RTT systems | ✓ |
| IPS / standards | Skip for now | ✓ |

### Still open (for next round)

1. **Master data:** Add structured **FKs** to line/equipment tables later, or keep **summary text** only for DH long-term?
2. **Lifecycle:** Confirm **OPEN → IN PROGRESS → RESOLVED → CLOSED** verbatim vs align with other app enums.
3. **Close rule:** Is **verified-before-CLOSED** required in v1, and **who** can verify?
4. **List/detail UX:** Full page vs drawer vs modal for primary detail (can differ mobile/desktop).
5. **Permissions:** Map `admin` / `assessor` / `operator` to create/edit/reassign rules (operators: own rows only vs any cell user).
6. **Audit:** Soft delete for issues vs hard delete + activity log only?
7. **Export:** None vs CSV for admin in v1?

---

## 10. Next step

- **Apply migration:** `npm run supabase:push` (repo root) for `20260423100000_dh_defect_handling.sql`.
- **Fine-tune DH:** UX, permissions matrix (**§9**), comments/attachments, reporting — iterate before cloning to Deviations / Quality Fails.
- Product: answer **§9 (still open)** when ready.
