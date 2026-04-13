# SOS, QOS, and PPO — Observation Systems Specification

This document defines three LDR tools apps that mirror **Health Checks (HC)** for roster linkage, permissions, admin configuration, drafts, submission, roster RAG/comment sync, duplicate guards, and reporting patterns. Implementation follows the existing `hc_*` schema and `web/src/features/health-checks` UX unless noted below.

## 1. Names and placement

| Code | Meaning | LDR nav |
|------|---------|---------|
| **SOS** | Safety Observation System | LDR tools → SOS (+ SOS Report) |
| **QOS** | Quality Observation System | LDR tools → QOS (+ QOS Report) |
| **PPO** | Process Productivity Observation | LDR tools → PPO (+ PPO Report) |

Each app has its own **list**, **new**, **record** (draft/submit), and **report** routes under `/ldr-tools/{sos|qos|ppo}/…`.

## 2. Roster and LDR activities

- Each system has exactly one linked `ldr_activities` row per workspace/site context:
  - one for **SOS**
  - one for **QOS**
  - one for **PPO**
- **Types are independent** from activities and are managed inside each system.
- **Roster** cell modal shows **Complete SOS / Complete QOS / Complete PPO** only when:
  - the activity row matches the linked system activity, and
  - at least one active type in that system has an active template.
- Query params when starting from roster match HC: `activityId`, `masterCellId`, `completionDate`, `assignmentId`.
- **Duplicate submit** guard: same completer + same type + same cell + same scheduled day (roster `assignment_date` when `ldr_assignment_id` set, else UTC date of `completed_at`), same as HC.
- **Assignment sync** on first submit: map observation RAG to `ldr_assignments.rag_status` (HC mapping: amber → yellow). Append feedback text to `ldr_assignments.comment` from overall comment + per-question comments (QOS/PPO), or overall only (SOS), but only when assignment activity matches the linked system activity.

## 3. Scoring and RAG

### SOS (whole observation)

- **One** outcome for the record: **Full** (green), **Partly** (amber), **Not** (red).
- Template **questions** are **read-only** on the record screen (no per-question controls). They may show optional **good/bad reference images** (placeholders with styled frames when missing).
- Stored fields: `sos_level` ∈ `full | partly | not`, `status` (`hc_rag_status`), `score` integer for analytics (e.g. 100 / 50 / 0).
- **Overall comment** supported. Draft/submit lifecycle same as HC.

### QOS (per question, HC-like bands)

- Per question: optional **operator** (user id + display name, optional), **comment**, **Pass / Fail / N/A**.
- **N/A** excludes the question from the **overall score** denominator (same idea as ignoring non-scored items).
- Overall **score** = `ceil(100 * passes / total_scored)` where `total_scored` = questions answered Pass or Fail only.
- Overall **RAG**: same global bands as HC — **>80 green**, **60–80 amber**, **<60 red** (`hcScore` / `hcRagFromPercent` logic).

### PPO (per question, stricter pass threshold)

- Same per-question model as QOS (operator optional, comment, Pass / Fail / N/A, images).
- Overall score uses the same percentage formula as QOS (N/A excluded).
- Overall **RAG**: **≥85 green**, **70–84 amber**, **<70 red** (documented default for “85+ pass” with HC-style middle band).

## 4. Images (SOS, QOS, PPO)

- **Optional** one pair per template question: **good** and **bad** image.
- **Admins** upload via LDR Admin template editor; stored in Supabase **Storage** bucket `observation_assets` (private bucket, RLS: LDR read where `can_access_ldr_tools()`, write/delete for `is_app_admin()`).
- UI: **always** show framed slots — green frame + tick overlay and red frame + cross overlay; if no file, show empty placeholder inside the frame. If file present, show image under the overlay frame.

## 5. Database (summary)

Parallel families (mirror `hc_*`):

- `sos_types`, `sos_templates`, `sos_template_questions`, `sos_records` (no answer table).
- `qos_types`, `qos_templates`, `qos_template_questions`, `qos_records`, `qos_answers`.
- `ppo_types`, `ppo_templates`, `ppo_template_questions`, `ppo_records`, `ppo_answers`.
- `obs_system_activity_links` (workspace + kind + linked `ldr_activity_id`).

Shared enum for QOS/PPO answers: `obs_answer_kind` = `pass | fail | na`.

Reuse existing `hc_rag_status` for `status` on all `*_records` where applicable.

Triggers: `updated_at` touch; duplicate submit; assignment RAG + comment sync (SOS without per-question lines). Type names are now admin-managed and no longer auto-synced from `ldr_activities`.

RLS: same policy pattern as HC — LDR select; admin write on config tables; records insert draft as owner; update submit as owner; **delete records admin-only** (match current HC).

## 6. Reports (per app)

Each report page:

- **No** LDR site/plant/cell scope bar (same as HC Report): data is whatever RLS allows; filters are **date range**, **type**, **completer** (and presets where useful).
- **Volume over time**: counts of completed records aggregated by **day**, **week**, and **month** (toggle or small multiples).
- **By type**: counts (and optionally avg score) with the selected date range.
- **By person** (completer): counts / avg score with the same date range.
- Charts implemented with **Recharts** (or equivalent already in tree).

**Future (out of scope for first delivery):** unified roster report across HC + SOS + QOS + PPO.

## 7. Roles and export

- Same as HC: LDR access for operators; **app admin** for types/templates/images and deleting submitted records; export/audit parity with HC where HC has it.

## 8. Rollout

All three apps ship **together** with this spec and linked migrations.

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-04-13 | UX + reliability pass: SOS/QOS/PPO record screens now keep autosave/submit/delete in a sticky bottom action dock; submit success notice uses black text for higher contrast. |
| 2026-04-13 | Roster deep-link prefill hardening for observation new pages: Strict Mode-safe prefill and assignment-based fallback when `masterCellId` is blank (including legacy location-name matching via cached master-cell joins). |
| 2026-04-13 | Initial spec from product Q&A; aligned scoring, images for all three, roster parity, report requirements. |
| 2026-04-13 | Initial implementation: `sos_*` / `qos_*` / `ppo_*` migrations, Storage bucket `observation_assets`, web routes under `/ldr-tools/{sos,qos,ppo}`, admin panels, roster completion buttons, Recharts reports. |
| 2026-04-13 | Updated flow: single linked LDR activity per system/workspace (`obs_system_activity_links`), types decoupled from activities, roster completion buttons gated by system link + active templates. |
