# Plan 24 (RTT) — planning & requirements draft

**Status:** planning only — no implementation yet.  
**Reference UI:** “Plan for the Day” style grid (time down the left, roles across the top). Example screenshots (legacy Power Apps — **labels and colours may differ** in our app; capture **behaviour**): see **§11**.

**Naming caveat:** the old app uses names like “DDS Actions”, “Plant Checks”, “Spacefillers”, etc. Our product names (checks, CL, CIL, …) may differ; map **concepts** (event type, legend, filters) not literal strings.

---

## 1. Product intent

**Plan 24** is the main operational view for a **cell**. Users see a day (or shift) as a calendar grid: **time** on the vertical axis, **roles** on the horizontal axis. **Events** (checks first; later CL, CIL, quality checks, fillers, etc.) appear as blocks with start/end time and can be **opened**, **completed** or **acknowledged**, **moved** (drag-and-drop), or **created ad-hoc**. Events **without a role** yet (**unassigned**) surface in a **right slide panel**; an **expandable bottom task bar** holds individual tasks (Outlook-like). Admin configures **rosters**, **roles**, **shifts**, **patterns**, and **scheduled event templates** (e.g. checks with sub-tasks and reporting).

**Scope rule:** Plan 24 exists **only at cell level** — not at plant-only or site-only. All related apps share the same **site → plant → cell** structure; **a cell must be selected** before Plan 24 (and related admin) is meaningful.

---

## 1a. Decisions log (confirmed with product)

| # | Topic | Decision |
|---|--------|----------|
| D1 | **Shift window on the grid** | Time column comes **entirely from Plan 24 roster** shift setup (start/end configurable, e.g. day **05:00–17:00** on **one calendar day**). **Night shift** is one continuous span (e.g. **17:00 on 14 Apr → 05:00 on 15 Apr**) shown as **a single Plan view** for that shift (not split across two pages). UX must **fit one shift on screen** — either one page without horizontal scroll for the time axis, or **zoom / scale-to-fit** controls so the full shift is usable on typical monitors. |
| D2 | **Roster change effective date** | Changes apply **from a chosen date forward**, not retroactively. When the user **changes roster** (or switches which roster applies), the app **prompts for an effective date**; **all plan context on and after that date** uses the new roster rules. **Before** that date, historical view stays as it was. |
| D3 | **Admin edits a recurring check** | **Future** generated instances follow the updated definition; **past** instances (already on the plan or completed) **stay unchanged** — no rewrite of history. |
| D4 | **People vs roles** | **Allowed:** two or more people may be involved across roles; **one person may appear in multiple role columns** for the same shift/day if reality requires it — **no hard block** (optional soft warning later if desired). |
| D5 | **Overlapping events (same role, same time)** | **Allowed.** **Visual:** stack/lane like **Outlook** day view when multiple appointments overlap in one column. |
| D6 | **Delete model** | **Confirmed: soft delete only** for removing events from the live plan — see **§7** and glossary. Keeps audit trail and reporting for “deleted” events + mandatory comment. |
| D7 | **Unassigned events** | An event is **unassigned** when it has **no role** yet (no column on the grid). It appears in the **right slide panel** (e.g. “Unassigned checks” / “Unassigned CILs” — **label per type**). User **drags from the sidebar onto the calendar** to drop on a **role** (and time position as implemented) → event becomes **assigned** and shows as a normal block. |
| D8 | **Bottom task bar** | A **task bar** fixed along the **bottom** of the screen (Outlook-inspired). User can **expand / collapse** (or resize) it as needed. Contains **individual tasks** (similar in spirit to Outlook’s task list / follow-ups); exact data model and link to Plan 24 events TBD. |
| D9 | **People (master data)** | People come from **master data — People** (same idea as Skill Matrix). **Simple add flow:** first name, second name, email, phone, and **account** (link to login) **if any**. Reuse Skill Matrix patterns where practical. |
| D10 | **Example role names** | Illustrative roster roles include **Team lead**, **Packing 1 … Packing 6** (not an exhaustive list; real cells may add Dryer, Evaporator, etc.). |
| D11 | **Permissions (v1)** | **Normal users** can do **everything in Plan 24** for day-to-day work (view, move events, ad-hoc, delete with comment, complete, etc.) **except:** **Edit Plan 24 roster** → **admins only**; **Edit schedules** (recurring / template definitions in admin) → **admins only**. *(Fine-grained roles later if needed.)* |
| D12 | **Scheduling examples** | Real examples to support in scheduling language: **daily walk**, **daily DDS** (and similar “every day shift” patterns). |

### 1b. Supplemental decisions (§13 questionnaire — merged)

| # | Topic | Decision |
|---|--------|----------|
| D13 | **Plan scope** | **One** view: **one cell + one calendar date + one shift (day/night)** — no multi-day grid in v1. |
| D14 | **Night date anchor** | **Yes:** date picker = **start** calendar day of the night shift (aligns with **D1**). |
| D15 | **Timezone** | **Browser local** for display/interaction (document implications vs plant legal time if audits need plant time). |
| D16 | **Instance generation** | Materialise / refresh plan instances **when rostered** (roster publish or roster-driven job — exact trigger in build; not midnight-only). |
| D17 | **Deactivated roles** | Apply **only forward** — do not hide columns retroactively on past plan views. |
| D18 | **Same person, overlap** | **Warn** (icon / indicator) — **do not block** (extends **D4**). *(User wrote “warm icon” → interpreted as **warn**.)* |
| D19 | **Rosters under cell** | **Cell** owns **multiple rosters**; **only one active** roster at a time for planning. Shift/pattern context lives **under cell → roster** (not site-wide). |
| D20 | **Day / night for today** | **Automatic** from pattern + date (user still switches day vs night view per **D1** window). |
| D21 | **Overtime / partial shifts** | **In scope** for v1. |
| D22 | **Grid step** | **15 minutes** default slot size. |
| D23 | **Drag / resize precision** | **Free minute** — users may drag and resize events to **any minute** boundary (no forced snap to the 15-minute grid). *(Time ruler may still show **D22** steps for readability.)* |
| D24 | **Complete without all sub-tasks** | **Yes** — **admin override** allowed. |
| D25 | **In process** | Mark on **first open** of the event (no separate Start required for v1). |
| D26 | **Check spanning two shifts** | **One record** — a single check/event may span across the **day/night** or **calendar** boundary; **do not split** into two records for v1. |
| D27 | **Ad-hoc** | **Anyone** can add ad-hoc; event must carry a clear **ad-hoc** visual indication. **Data model (v1 default):** same stored event type as scheduled with `source = ad_hoc` (not a separate table) unless engineering objects. |
| D28 | **Deleted in reports** | **Plan day only** (counts tied to original scheduled plan day). |
| D29 | **Ad-hoc metrics** | Count in **both** “Added” and relevant “Scheduled” aggregates as agreed in report spec. |
| D30 | **Finer permissions** | **Later** — v1 stays **D11**. |
| D31 | **Read-only users** | **Not** required in v1. |
| D32 | **Export** | **Not required** for v1 (in-app reporting enough). |
| D33 | **Task bar scope** | Tasks are **per cell** and **per role** (user wording: “per cell per role”). |
| D34 | **Tasks vs events** | **Not linked** to events in v1. |
| D35 | **Task bar chrome** | **Default** expand/collapse behaviour OK (no custom shortcut required for v1). |
| D36 | **Deliverables** | Will provide **roster step-by-step** media (**yes**); **wireframe** for right panel + bottom bar (**yes**); will supply **colour** refs (**yes**). |
| D37 | **Cells master data** | **Existing** site/plant/cell only — **no** new “RTT enabled” flag for v1. |
| D38 | **Report visibility** | **Cell** users (anyone authorised for that cell’s Plan 24) can see the Plan 24 report — **not** admin-only. |
| D39 | **Mobile** | **Desktop + tablet**; phone not a v1 target (responsive best-effort only if time allows). |
| D40 | **Sub-tasks** | **Max 20** per check; **no photos** on sub-task lines in v1. |
| D41 | **Report filters** | User answered **yes** to mandatory filters — implement **date range, shift, role, person, event type** as baseline set; adjust if product adds one line item list later. |
| D42 | **Retention (soft delete)** | **1 year** queryable history for soft-deleted events + delete comments (revisit for compliance). |
| D43 | **Language** | **English** only v1. |
| D44 | **Accessibility** | **Best effort** (no formal WCAG AA gate for v1). |
| D45 | **Pilot / success** | **Qualitative priority:** ship a **strong working model** with best implementation effort; **named pilot cell, date, trainer** still **TBD** — add when known. |

---

## 2. Plan 24 — main grid (user view)

### 2.1 Layout (Outlook-like)

| Axis | Content |
|------|--------|
| **First column** | Time of day from **shift start** to **shift end**; default grid step **15 minutes** (**D22**). |
| **Header row** | **Roles** (from active roster for that cell + selected roster + shift/day context). |
| **Grid body** | Events as coloured blocks spanning their **start** and **end** time under the assigned **role** column. |

### 2.2 Day vs night

- User can **switch between day shift and night shift** in Plan 24; bounds come from **roster shift config** (see **D1**).
- **Day shift example:** roster defines 05:00–17:00 → grid shows **05:00–17:00 on the selected calendar date**.
- **Night shift example:** roster defines 17:00–05:00 → grid shows **one continuous window** from **17:00 on date D** through **05:00 on date D+1** (header should make both dates obvious, e.g. “Night · 14 Apr 17:00 → 15 Apr 05:00”).
- **Default pattern (still as §4.4):** A/B/C/D with classic 06–18 / 18–06 unless roster overrides — align implementation with whatever times are stored in roster.
- **Viewport:** one-shift view must **fit the screen** (scroll within grid vs scale — implementation detail; requirement is usability for the whole shift).

### 2.3 Interactions (high level)

- **Drag and drop:** move an event **role to role** and/or **time to time** (validation rules TBD).
- **Click event:** open **popup** (or side panel) to view details, sub-tasks, complete / acknowledge / in-progress flow.
- **Click empty (white) space:** **ad-hoc create** flow — pick event type (for now only **check**; later CL, CIL, etc.).
- **Click role header:** assign or **change the person** mapped to that role for the plan context (date + shift + roster).

### 2.4 Event types — phase 1

- **Checks** only in v1.
- **Visual:** checks displayed as **dark blue** blocks (distinct from other future types).
- Other types (CL, CIL, quality checks, fillers, …) deferred; grid and admin tabs reserved conceptually.

### 2.5 Shell layout — grid, right panel, bottom task bar

Plan 24 is not only the centre grid; the **page shell** includes:

| Region | Purpose |
|--------|--------|
| **Centre** | Role × time grid (§2.1–2.3): assigned events, DnD, ad-hoc on empty cells. |
| **Right — slide panel** | **Unassigned events:** events with **no role assigned** yet (see **D7**). Lists here until the user **drags** them onto the grid **to a role** (and time). Panel can slide open/closed so the grid gains horizontal space when collapsed. |
| **Bottom — task bar** | **Tasks** strip (Outlook-like): **individual tasks** the user can track. **Expandable** (or resizable) so more rows are visible when needed; **collapsed** to a thin bar when not in use. Scope: Plan-24-linked tasks only vs global user tasks — **TBD** (§9.11). |

**Interaction (confirmed for assign):** drag from **Unassigned** panel onto the **calendar** to assign **role** (and placement in time). Drag from grid **back** to unassigned — **TBD** (policy).

### 2.6 View preferences & legend (parity with legacy “Show/Hide”)

From the legacy **Show/Hide items** style modal (reference **§11** image 2), we want equivalent **concepts** in our app (exact UI copy TBD):

- **Toggle visibility by event type** — each type has a **colour** on the grid (legacy example mapping for *ideas only*: DDS-style actions, spacefillers, CL, CIL, plant checks, tasks — **our palette and names may differ**).
- **Filter which role columns appear** (checkbox list per role / “no group” bucket in legacy).
- **Legend / info:** e.g. hazardous area, **ad hoc** marker, **completed** styling (legacy used **striped** fill for completed — we may use the same visual language for “done” checks).
- **Fit to screen** toggle (aligns with **D1** viewport requirement).
- **Filter events by minimum duration (minutes)** — optional; persist filter if “save filter” equivalent.

Implement after core grid + event types exist; v1 may ship a **minimal** subset (e.g. checks + fit-to-screen only).

---

## 3. Checks — behaviour (v1 detail)

### 3.1 On the grid

- Check has **start time** and **end time** → determines **vertical placement** and height in the grid.
- Completing a check may require **multiple sub-tasks**; **all sub-tasks ticked** → check can be marked **completed** (rules for partial completion TBD).

### 3.2 Admin — “Checks” tab (under RTT / Plan 24 admin)

- **Who may edit:** **admins only** for schedule / recurring definitions (**D11**).
- Create/configure **checks** with at least: **times**, **frequency**, **role** (and likely cell + roster context — TBD).
- Ability to define **multiple tasks under one check** (checklist).
- Scheduling engine: how **frequency** maps to concrete instances on the grid (daily, weekly, per-shift, custom — TBD).
- **Concrete examples** to support in product copy and rules (**D12**): **daily walk**, **daily DDS**.

---

## 4. Plan 24 roster (admin)

Separate area: **Plan 24 roster** (admin), not the same screen as the day grid but feeds it.

- **Who may edit:** **admins only** (**D11**).

### 4.1 Roles

- **Per cell:** maintain a **list of roles** (e.g. PACKER #1, TEAM LEAD, …).
- **Activate / deactivate** a role at any time → **inactive roles do not appear** as columns in Plan 24.

### 4.2 Multiple rosters

- Create **multiple named rosters** per cell (or per context — TBD).
- **Switch active roster** (or apply a different roster) for Plan 24: user must set an **effective from date** — **everything on and after that date** uses the new roster; **earlier dates unchanged** (see **D2**).
- **Assign roles to rosters** — not every role must appear on every roster; mapping flexibility TBD.

### 4.3 Shifts

- Create **shifts** with **start** and **end** time.
- Support **shift patterns** (rotation).

### 4.4 Default pattern (stated requirement)

- **Four shift labels:** A, B, C, D.
- **Day:** 06:00–18:00; **night:** 18:00–06:00.
- **Default rotation:** 2 day shifts → 2 night shifts → **4 days off** (calendar anchoring and handoff rules TBD).

### 4.5 People on roles

- **People directory:** use **master data — People** (**D9**): same spirit as Skill Matrix — capture **first name**, **second name**, **email**, **phone**, **account** (optional link to login). Provide a **simple process** to add/edit people there; Plan 24 roster pickers read from this list.
- **Pre-populate** which **person** is assigned to which **role** for planning (per roster / per shift / per date — TBD).
- Plan 24: **click role** to assign or change person — choices come from **People** master data.

---

## 5. Additional admin tabs (same cell context)

Separate admin tabs (same site/plant/cell shell), content to be specified per type:

- **CL**
- **CIL**
- **Checks** (scheduling + sub-tasks — see §3.2)
- **Quality checks**
- **Fillers**

*(Implementation order: roster + Plan 24 shell + checks first; others stubbed in nav/spec later.)*

---

## 6. Reporting — Plan 24 report

User needs visibility into **counts** (and likely filters by date range / shift / cell):

| Metric | Meaning (draft) |
|--------|------------------|
| **Scheduled** | Events that were on the plan for that period. |
| **Complete** | Finished successfully per rules. |
| **Not complete** | Past end or day boundary and not completed (definition TBD). |
| **In process** | Opened/started but not finished. |
| **Deleted** | Removed from plan (see §7). |
| **Added** | Ad-hoc additions (may overlap with “scheduled” if classified differently — TBD). |

Export / charts / drill-down to individual events — TBD.

---

## 7. Delete & audit

- User can **delete** an event from Plan 24.
- **Mandatory comment** on delete (reason / audit trail).
- **Soft delete (default design):** the event is **hidden from the live plan** and marked **deleted** with **timestamp + user + comment**, but the **row stays in the database**. Reports can count **deleted** events and auditors can trace what happened. This is **not** “remove every trace from the system” (**hard delete**).

### Glossary — soft delete vs hard delete

| Term | Meaning |
|------|--------|
| **Soft delete** | Mark record as deleted (`deleted_at`, etc.); **stop showing** it on the grid; **keep** it for reports, metrics, and compliance. Matches “deleted” counts in §6. |
| **Hard delete** | Physically remove the row from the database — **cannot** be recovered; reporting for “deleted that day” is harder unless you log elsewhere. |

**Product decision:** use **soft delete** for Plan 24 events (confirmed). **Hard delete** not required for v1.

---

## 8. Technical & UX assumptions (non-binding)

- Reuse patterns from **LDR tools** where applicable: **scope bar** (site → plant → **cell**), auth, RLS-by-tenant/cell.
- Grid complexity suggests dedicated components (virtualisation, DnD library, timezone) — **decision deferred**.
- **Layout:** three-band shell — **main grid**, **right unassigned panel**, **bottom task bar** (§2.5); responsive behaviour on small screens TBD.
- Example image shows **Power Apps**-style UI; we are **not** bound to replicate pixel-perfect — capture **behaviour and information architecture** first.

---

## 9. Open questions — need answers to lock requirements

**Resolved elsewhere:** **D1–D45** — see **§1a** + **§1b** (includes §13 questionnaire merge: plan scope, night anchor, browser local time, instance gen when rostered, deactivated roles forward-only, double-book **warn icon**, rosters per cell one active, auto day/night, overtime in v1, 15 min grid steps, **free-minute drag/resize** (**D23**), sub-task admin override, in-progress on first open, **one record across shifts** (**D26**), ad-hoc anyone + indicator, reporting, tasks per cell/role unlinked, no export v1, max 20 sub-tasks no photos, 1y retention, English, best-effort a11y, desktop+tablet, cell-level report access).

### 9.1 Cell, date, and “whose plan?”

1. Is Plan 24 strictly **one cell + one calendar date + one shift (day/night)** at a time, or can a user span **multiple dates** in one view?
2. **Date picker for night shift:** confirm anchor = **start date of the night shift** (day D at 17:00) — aligns with **D1**; any edge case for “view yesterday’s night still open at 06:01”?
3. **Timezone:** always plant timezone, or user preference?

### 9.2 Templates vs materialised events

4. ~~Roster retroactive~~ → **Decided:** effective date only forward (**D2**).
5. **Materialisation:** confirm events are **materialised instances** (so **D3** is implementable: past copies frozen, future can be regenerated or patched per policy). Exact job (cron vs on-open) TBD.

### 9.3 Roles & people

6. ~~Same person multiple roles~~ → **Decided** allow (**D4**). Optional: warn if **same minute** double-booked?
7. ~~People source~~ → **Decided:** **Master data — People** with Skill-Matrix-like fields and add flow (**D9**).
8. Do **deactivated roles** hide **only new plans**, or also **historical** columns?

### 9.4 Shifts & patterns

9. Is shift pattern **global per cell**, or **per roster**?
10. Who sets **“today’s shift”** for the team — automatic from pattern + date, or **manual picker** each day?
11. **Overtime / partial shifts** — in scope for v1 or out?

### 9.5 Grid & time

12. ~~Minimum time slot~~ → **Decided:** **15 minutes** default grid step (**D22**).
13. ~~Overlap~~ → **Decided** allow, Outlook stack (**D5**).
14. ~~**Drag**~~ → **Decided:** **free minute** drag/resize — **D23**.

### 9.6 Checks & sub-tasks

15. ~~Complete without all sub-tasks~~ → **Decided** admin override allowed (**D24**).
16. ~~**In process**~~ → **Decided** first open (**D25**).
17. ~~If a check **spans two shifts**~~ → **Decided:** **one record** — **D26**.

### 9.7 Ad-hoc checks

18. Ad-hoc check: same **data model** as scheduled check with `source = ad_hoc`, or separate entity?
19. Any **approval** required for ad-hoc creation?

### 9.8 Delete & reporting

20. **Deleted** events: appear in report for the **original plan day** only, or rolling window (e.g. pay period)?
21. **“Added”** vs **“Scheduled”** — should ad-hoc increments count as both or only “Added”?

### 9.9 Permissions

22. ~~Who may do plan operations vs admin~~ → **Decided (v1):** users do **all Plan 24 day-to-day actions**; **roster edit** and **schedule (template) edit** → **admins only** (**D11**). Split finer roles later?
23. Read-only viewers for Plan 24 — needed in v1?

### 9.10 Integrations

24. Any **export** (Excel/PDF) mandatory for v1?
25. ~~People IDs~~ → **People** master data (**D9**); align with Skill Matrix person records / auth where applicable.

### 9.11 Right panel & task bar (follow-ups)

26. ~~Unassigned rule~~ → **Decided:** unassigned = **no role** on the event; **drag to calendar** to assign role (**D7**).
27. ~~Drag gesture~~ → **Decided:** drag from sidebar **onto calendar** to assign to **role** (time placement as UX/engineering refine).
28. **Task bar:** tasks are **per user** globally, **per cell**, or **per Plan 24 session** only?
29. Should tasks **link** to a Plan 24 event (e.g. “follow up check #123”) or stay **free-standing** in v1?
30. **Collapsed** task bar: minimum height (e.g. one line + chevron) and keyboard shortcut to expand — any preference?

---

## 10. Suggested implementation phases (for later — not a commitment)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Cell-scoped shell; Plan 24 route; empty grid with time + role columns; **stub** right unassigned panel + **stub** bottom task bar (layout only). |
| **P1** | Plan 24 roster admin: roles CRUD, active flag, one roster, shifts day/night, assign names to roles. |
| **P2** | Checks admin: define check + sub-tasks + schedule → **materialised** events on grid. |
| **P3** | DnD, click-to-complete popup, ad-hoc on empty cell, delete with comment. |
| **P4** | Plan 24 report + **soft-delete** audit trail (see §7). |
| **P5** | Multiple rosters, shift patterns A–D default, CL/CIL/… |

---

## 11. Reference material & screenshots

| # | File (Cursor workspace assets) | What it shows |
|---|-------------------------------|----------------|
| 1 | `image-e56aba73-d179-4b60-a931-f93efd4f80ba.png` | **Night** (same grid idea as day), **Unassigned** right panel (e.g. unassigned CIL-style cards with time/date/id), multi-role columns, mixed event colours. |
| 2 | `image-88b58f97-1bc1-4c7b-a5a0-f40634e34734.png` | **View preferences** modal: toggles by **event type + colour**, **role** visibility checklist, **legend** (hazardous, ad hoc, completed striping), **Fit to screen**, **minimum duration** filter + save. |
| 3 | *(earlier)* `image-850cf88a-11fd-4fb4-82a6-75cb468bd6bf.png` | Initial “Plan for the Day” grid reference. |

*Copy these into e.g. `docs/plan24/` inside the repo when you want them versioned with git.*

- Still welcome: **step-by-step roster setup** photos if not covered above.

---

## 12. What we need from you — checklist (questions & deliverables)

Use this as a **shopping list** of things to provide or decide so build and QA do not stall. Answers can be short bullets; drop them into §9 or a reply thread and we will merge into the spec.

### A. Visuals & examples

- **More screenshots or a short screen recording** of: roster setup step-by-step, night shift view, overlapping events, and (if it exists today) any **Unassigned** or **task** behaviour you want to echo.
- **Optional:** a simple **wireframe** (even pen on paper photo) for the **right panel** and **bottom task bar** if you care about proportions beyond “like Outlook”.
- **Colour tokens:** confirm **dark blue** for checks (hex or “match this swatch”); any other event colours for later types.

### B. Data & “source of truth”

- ~~**People:** source~~ → **Provided:** master data **People** + add flow like Skill Matrix (**D9**).
- **Roles:** **Partial:** Team lead, Packing 1–6 as examples (**D10**); extend with per-cell lists when ready.
- **Cells / plants / sites:** confirm we reuse **existing master data** only, or you need new fields (e.g. “RTT enabled” flag per cell).

### C. Rules & permissions

- ~~**Matrix**~~ → **Provided (v1):** all users **full Plan 24 ops**; **roster** + **schedules** admin-only (**D11**). Still open: **read-only** viewers (§9.9 Q23), **reports** visibility.
- **Mobile:** must Plan 24 be **usable on a phone** in v1, or tablet/desktop only?

### D. Scheduling & checks (v1 depth)

- ~~**Frequency examples**~~ → **Provided:** **daily walk**, **daily DDS** (**D12**); add more as needed.
- **Sub-tasks:** max count, required order, photo attachment per line — yes/no for v1.
- **Materialisation:** when should the system **create tomorrow’s events** — midnight, first open of the day, or on roster publish?

### E. Reporting & compliance

- **Report filters** you cannot live without on day one (date range, shift, role, person, event type).
- **Retention:** how long must **soft-deleted** events and **delete comments** remain queryable?
- **Export:** Excel only, PDF, or “in app tables are enough” for v1?

### F. Unassigned panel & task bar (close §9.11)

- ~~**Unassigned rule**~~ → **Provided** (**D7**).
- **Tasks:** per user vs per cell; **link to events** or not; any **sync with Outlook/To Do** later or never.

### I. View preferences (legacy parity)

- **Partial:** §2.6 + **§11** image 2 — confirm final **colour palette** and **type names** for our app (not Power Apps literals).

### G. Non-functional

- **Timezone** rule (plant vs user).
- **Language** (English only v1?).
- **Accessibility** target (WCAG level if any).

### H. Rollout

- **Pilot:** one cell name + go-live window + who trains operators.
- **Success metrics** in one sentence (e.g. “100% of scheduled checks visible same day”).

---

## 13. Answer sheet — open questions

**Merged answers** are in **§1b** (supplemental decisions **D13–D45**), including **Q11** → **D23** (**free minute** drag/resize) and **Q14** → **D26** (**one record** across shift boundary). The numbered questions below are kept for traceability; **§1b is the source of truth.**

1. **Plan scope:** One view = **one cell + one calendar date + one shift (day/night)** only, or should users ever see **multiple dates** in one grid?
2. **Night date picker:** Confirm the selected date is always the **start night** calendar day (e.g. 14 Apr 17:00 → 15 Apr 05:00). Any rule for “still finishing night at 06:05” — show previous night automatically or user picks?
3. **Timezone:** Always **plant** timezone, **user** preference, or **browser** local?
4. **Materialised events:** OK that each grid block is a **stored instance** (past frozen, future updatable per **D3**)? When should instances be **generated** — midnight, **first open** of cell that day, **on roster publish**, or other?
5. **Deactivated roles:** Hide only for **new** days forward, or also **hide columns** when viewing **past** plans?
6. **Double-book warning:** Same person in two roles overlapping same time — **warn**, **silent**, or **block**?
7. **Shift pattern scope:** **Per cell**, **per roster**, or both supported?
8. **Which shift today:** **Auto** from pattern + date, **manual** Day/Night toggle only, or both (auto with override)?
9. **Overtime / partial shifts** in v1 — **in** or **out**?
10. **Grid slot size:** Minimum step **15**, **30**, or **60** minutes (default)?
11. **Drag snap:** Snap to slot grid only, or **free** to any minute? → **Free minute** (**D23**).
12. **Sub-tasks:** Allow **complete check** without all sub-tasks (**admin override**)? Yes/No.
13. **In progress:** Mark **in process** on **first open** of event, or only after explicit **Start** button?
14. **Check spanning two shifts:** **Split** into two records, **disallow**, or **one** record allowed across boundary? → **One record** (**D26**).
15. **Ad-hoc data model:** Same row type as scheduled with `source = ad_hoc`, or **separate** table?
16. **Ad-hoc approval:** Anyone can add ad-hoc, or **approval** / second person required?
17. **Deleted in reports:** Count deleted for **original plan day only**, or **rolling** window (e.g. 90 days / pay period)?
18. **Added vs scheduled:** Should ad-hoc count as **Added only**, **Scheduled only**, or **both** in metrics?
19. **Finer permissions later:** For v1 “users do all” is enough — do you already know you need **e.g. operator cannot delete** (yes/no / later)?
20. **Read-only role:** Need users who **see** Plan 24 but **cannot** move/complete/delete in **v1**?
21. **Export v1:** **Excel**, **PDF**, **both**, or **not required** for v1?
22. **Task bar scope:** Tasks **per user** (global), **per cell**, or **per session** only?
23. **Tasks linked to events:** **Must link**, **optional link**, or **never** in v1?
24. **Task bar UX:** Collapsed height preference; **keyboard shortcut** to expand — care or ship default?
25. **Roster setup media:** Will you provide **step-by-step** screenshots/video (yes / later / not needed)?
26. **Wireframe:** Want a rough **right panel + bottom bar** sketch from you (yes / no)?
27. **Colour tokens:** Hex or brand refs for **check (dark blue)** and other types for v2 — list or “designer later”?
28. **Cells master data:** Reuse **only** existing site/plant/cell, or add flags (e.g. **RTT enabled** per cell)?
29. **Reports visibility:** Can **every** logged-in cell user see Plan 24 report, or **admin only** for v1?
30. **Mobile v1:** Plan 24 **must work on phone**, **tablet OK**, or **desktop only** for v1?
31. **Sub-task limits:** Approx **max** sub-tasks per check; **photos** on lines in v1 (yes/no)?
32. **Report filters (must-have):** List what filters are **mandatory** on day one (e.g. date range, shift, role, person, type).
33. **Retention:** How long keep **soft-deleted** rows + comments queryable (e.g. **2 years**, **7 years**, **forever**)?
34. **Language v1:** **English only** or bilingual from day one?
35. **Accessibility:** Target **none**, **best effort**, or explicit **WCAG 2.1 AA**?
36. **Pilot:** Target **cell name(s)**, **go-live** month, **who trains** operators?
37. **Success metric:** One sentence for “we shipped Plan 24 v1 successfully when …”

---

*Document owner: product / engineering pair. Update this file as answers to §9 are decided.*

**Last decisions captured:** **D1–D45** — core **D1–D12** plus **§1b** (full §13 merge), including **free-minute** drag/resize (**D23**) and **single record** for checks spanning shifts (**D26**).
