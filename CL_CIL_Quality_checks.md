# CL, CIL & Quality Checks — Locked Requirements (RTT Systems)

## 1) Objective

Deliver CL, CIL, and Quality checks under RTT systems with the **same engine and behavior as current Plan 24 Checks**, while keeping separate check families and linked action outputs.

This document reflects confirmed product decisions and supersedes earlier draft assumptions.

---

## 2) Architecture Decisions (Confirmed)

1. **Engine**: Shared checks engine + 3 wrappers:
   - CL checks
   - CIL checks
   - Quality checks
2. **Admin UX**: 3 separate admin tabs (same structure/behavior as current Checks admin).
3. **Data model**: Separate tables per family (CL/CIL/Quality), not one polymorphic table.
4. **Execution behavior**: Same runtime behavior as current Plan 24 checks.
5. **Approvals/workflow**: Same as current Checks behavior (no additional approval gate for this phase).

---

## 3) Scope & Placement

## 3.1 Scope Bar and Planning Context

All CL/CIL/Quality checks run in the same RTT scope context:

- Site
- Plant
- Cell

They also support assignment to:

- **Area** (master data selector)
- **Equipment** (master data selector)
- **Equipment group/set** (master data selector)

All selectors use master-data-backed values only.

## 3.2 Navigation

- No new top-level routes for now.
- Delivery includes:
  - 3 Admin tabs (CL/CIL/Quality checks)
  - Unified **List view** containing all check families + existing Checks, with filters.

---

## 4) Check Families and Action Mapping

| Family | Fail/Issue Action | Target System |
|---|---|---|
| CL | Raise Deviation | Deviations |
| CIL | Raise Defect | Defect Handling (DH) |
| Quality | Record Fail | Quality Fails |

Rules:

- Action launch from operator/check execution context.
- Use quick-create popup fields (see section 7).
- Record bidirectional links where applicable (event/check -> target record).

---

## 5) Visual Design Tokens

Family colors are fixed:

- **CL**: Green (`#22C55E`)
- **CIL**: Teal (`#14B8A6`) (between green and blue)
- **Quality**: Purple (`#8B5CF6`)

Usage:

- Event chips/cards in Plan context
- Family badges in list/admin/operator views
- Quick visual differentiation while preserving same interaction model.

---

## 6) Admin Requirements

Each family has its own admin tab with the same interaction model as current Plan 24 Checks:

- Template lifecycle and versioning consistent with existing checks admin.
- Schedule management consistent with existing checks admin.
- Same recurrence and assignment mechanics.
- Same schedule state model as current checks behavior.

Required configurable fields:

- Name/title
- Family-specific template/task content
- Scope selectors (area/equipment/equipment group, master-data backed)
- Frequency/schedule
- Version metadata

---

## 7) Operator & Execution Requirements

## 7.1 Common Execution Model

- Render and run like current checks in Plan 24 runtime.
- Complete/Fail flow remains minimal and quick.
- Keep compatibility with role assignment and time-slot execution logic.

## 7.2 Input Types (Confirmed for v1)

Per check item/sub-item, support multiple input types:

- Pass/Fail
- Number
- Range
- Text (as needed by existing checks model)

## 7.3 Fail / Raise Popup (Quick Create)

When raising from check execution, use quick-create popup fields:

- Title
- Description
- Area
- Equipment
- Priority

No full-form modal in this phase; user can open full record later in target system if needed.

---

## 8) Unified List View Requirements

Single combined list view must include:

- Existing Checks + CL + CIL + Quality
- Open/complete status visibility
- Ability to open a check and complete it

Filters (minimum):

- Family/type (Checks, CL, CIL, Quality)
- Site
- Plant
- Cell
- Area
- Equipment
- Equipment group
- Status
- Date/time range
- Assigned role/person (if available in current checks model)

---

## 9) Integration & Data Linking

- CL issue records create/link to Deviations.
- CIL issue records create/link to DH defects.
- Quality issue records create/link to Quality Fails.
- Preserve auditability of source check event and who raised the issue.

---

## 10) Delivery Principles

- Same engine, same behavior, family-specific wrappers.
- Keep operator path minimal.
- Reuse existing checks architecture where possible.
- Master-data-driven scope selectors (no free-text fallback in this phase).