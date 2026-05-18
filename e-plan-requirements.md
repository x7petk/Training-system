# e-Plan One-Page App Requirements

## Implementation (this repo)

Built under **DDS Process → e-plan** (`/dds-process/e-plan`).

| Topic | Decision |
|---|---|
| Persistence | **localStorage** for actions and e-Plan admin lists (`rtt-systems.eplan.*` keys) |
| Site / Plant / Cell | **Master Data** via existing **Plan 24 scope bar** (not duplicated on the page) |
| Company / Region | Omitted |
| Admin | **DDS Process → Admin → e-Plan setup** — OGSM pillars, forums, labels, loss types, action owners only |
| Permissions | Any user with DDS Process access can create/edit actions; admin setup requires DDS admin |
| Demo data | Auto-seeded on first visit (actions across site cells; admin defaults if empty) |
| Integrations | Standalone (no Plan 24 / DDS actions links in v1) |

Code: `web/src/features/eplan/`, `web/src/pages/EPlanPage.tsx`, `web/src/pages/DdsAdminEPlanSetupPage.tsx`.

---

## Purpose

Build a one-page e-Plan application for manufacturing action planning. The app is used to create, manage, review, and track improvement actions across the manufacturing hierarchy.

The app must support a hierarchy of:

**Company → Region → Site → Plant → Cell**

Each e-Plan action belongs to a **Cell**.

---

## 1. Core Page Structure

The application must be a single-page app with the following sections:

1. Top hierarchy filters
2. Status summary cards
3. Advanced filters
4. e-Plan action table
5. Gantt-style timeline
6. Create/edit action modal
7. Admin setup area for dropdown values

The page should look modern, clean, and suitable for manufacturing management.

---

## 2. Hierarchy Filters

The top of the page must include persistent filters for:

- Site
- Plant
- Cell

Filter behaviour:

- Selecting a Site filters available Plants.
- Selecting a Plant filters available Cells.
- Selecting a Cell filters the e-Plan actions.
- All actions shown must belong to the selected Cell.
- Filters should persist after page refresh using local storage.

---

## 3. Status Summary Cards

Show summary cards at the top of the page with action counts by status:

- On Track
- Need Help
- Off Track
- Completed
- Not Started

Status colours:

| Status | Colour |
|---|---|
| On Track | Blue |
| Need Help | Yellow |
| Off Track | Red |
| Completed | Green |
| Not Started | Grey |
| Not Required | Archived / light grey |

“Not Required” actions must be hidden by default and only shown when selected in filters.

---

## 4. Action Statuses

Use the following statuses:

```ts
type ActionStatus =
  | "ON_TRACK"
  | "NEED_HELP"
  | "OFF_TRACK"
  | "COMPLETED"
  | "NOT_STARTED"
  | "NOT_REQUIRED";
```

Display names:

| Code | Display Name |
|---|---|
| ON_TRACK | On Track |
| NEED_HELP | Need Help |
| OFF_TRACK | Off Track |
| COMPLETED | Completed |
| NOT_STARTED | Not Started |
| NOT_REQUIRED | Not Required |

---

## 5. Action Data Model

Each action must have the following fields:

```ts
interface EPlanAction {
  id: string;

  title: string;
  description?: string;

  companyId?: string;
  regionId?: string;
  siteId: string;
  plantId: string;
  cellId: string;

  startDate: string;
  endDate: string;

  ogsmPillarId: string;
  forumId: string;
  status: ActionStatus;
  actionOwnerId: string;
  labelId?: string;
  lossTypeId?: string;

  raisedById: string;
  createdAt: string;
  updatedAt: string;

  parentActionId?: string;
  progress?: number;
}
```

---

## 6. Main Action Fields

When creating or editing an action, the user must be able to manage:

- Title
- Description
- Start date
- End date
- OGSM pillar / category
- Forum
- Status
- Action owner
- Label
- Loss type
- Raised by
- Site
- Plant
- Cell

System-generated fields:

- Created date
- Updated date

Default values:

- Start date = today
- End date = today + 30 days
- Status = Not Started
- Raised by = current user or selected user
- Created date = automatically generated

---

## 7. Sub-Actions

Each action can have sub-actions underneath it.

Sub-actions must support:

- Title
- Description
- Start date
- End date
- Status
- Owner
- Label
- Loss type
- Raised by
- Created date

Sub-action behaviour:

- Sub-actions are visually nested under parent actions.
- Parent rows must have expand/collapse.
- Sub-actions must appear under the parent row in the table.
- Sub-actions must appear aligned with the parent action in the Gantt timeline.
- Clicking a sub-action opens the same edit modal.

---

## 8. OGSM Link

Every action must be linked to OGSM.

Admin must be able to set up OGSM pillars.

Example OGSM pillars:

- Safety
- Quality
- Cost
- Delivery
- People
- Sustainability
- Asset Management
- Operational Excellence

The OGSM pillar/category must be selected from a dropdown.

Dropdown values must come from admin setup, not hardcoded directly in the form.

---

## 9. Forum Dropdown

Each action must have a Forum field.

Forum values must be created and managed in Admin.

Example forums:

- Shift DDS
- Daily DDS
- Weekly DDS
- Monthly PDCA
- Leadership Review
- Project Review
- Audit Review
- Improvement Review

---

## 10. Labels

Each action can have a Label.

Labels must be managed in Admin.

Example labels:

- High Priority
- Compliance
- Improvement
- Audit Finding
- Risk
- Follow Up
- Project
- Behaviour
- System

---

## 11. Loss Types

Each action can have a Loss Type.

Loss types must be managed in Admin.

Example loss types:

- Safety
- Quality
- Breakdown
- Rate Loss
- Planned Downtime
- Unplanned Downtime
- Material Issue
- People Capability
- System Gap
- Process Gap

---

## 12. Action Owner

Each action must have an Action Owner.

Action owners must be managed in Admin.

Owner fields:

```ts
interface Person {
  id: string;
  name: string;
  email?: string;
  role?: string;
  siteId?: string;
  plantId?: string;
  cellId?: string;
  isActive: boolean;
}
```

---

## 13. Admin Setup

Create an Admin setup section where the user can manage dropdown values.

**Sites, plants, and cells** — use existing **Master Data** (not e-Plan admin).

**e-Plan admin** (`/dds-process/admin/e-plan-setup`) — create, edit, archive (active flag), and delete:

- OGSM pillars
- Forums
- Labels
- Loss types
- Action owners

All dropdowns in the action form must use values from Admin setup.

Admin entities should support:

```ts
interface AdminItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Archived admin items should not appear in dropdowns by default.

---

## 14. Filters

Create filters for:

- Site
- Plant
- Cell
- Status
- OGSM pillar/category
- Forum
- Action owner
- Label
- Loss type
- Raised by
- Date range
- Show Not Required / archived actions

Default filter behaviour:

- Show selected Cell only
- Hide Not Required actions
- Show all active statuses
- Date range should default to current year or next 12 months

---

## 15. e-Plan Table

The table must show the following columns:

- Expand/collapse
- Action title
- Start date
- End date
- Owner
- OGSM pillar/category
- Forum
- Status
- Label
- Loss type
- Raised by
- Created date

Table behaviour:

- Rows are clickable.
- Clicking a row opens edit modal.
- Parent actions can be expanded or collapsed.
- Sub-actions are indented under the parent action.
- Overdue actions are highlighted.
- Not Required actions are hidden unless selected in filters.

---

## 16. Gantt Timeline

Build a Gantt-style timeline next to the action table.

Requirements:

- Show each action as a horizontal bar.
- Bar start position is based on start date.
- Bar length is based on start date and end date.
- Bar colour is based on status.
- Show a vertical “Today” line.
- Table rows and Gantt bars must align.
- Parent and sub-actions must align with the table.
- Clicking a Gantt bar opens the edit modal.

Timeline views:

- Weeks
- Months
- Next 12 months

Default view:

- Weeks

---

## 17. Progress Logic

If an action has sub-actions, calculate parent progress automatically:

```txt
completed sub-actions / total sub-actions * 100
```

Example:

- 2 completed sub-actions out of 4 = 50%

Show progress percentage on the parent Gantt bar.

If an action has no sub-actions:

- Completed = 100%
- Not Started = 0%
- On Track = manual progress or 0%
- Need Help = manual progress or 0%
- Off Track = manual progress or 0%

---

## 18. Overdue Logic

An action is overdue if:

```txt
endDate < today AND status is not Completed AND status is not Not Required
```

Overdue visual rules:

- Red row border or red left indicator
- Red end-date text
- Optional overdue badge

---

## 19. Create Action Modal

Create action modal must include:

- Title
- Description
- Start date
- End date
- OGSM pillar/category
- Forum
- Status
- Owner
- Label
- Loss type
- Raised by
- Site
- Plant
- Cell

Buttons:

- Save
- Cancel
- Save and Add Sub-Action

Validation:

- Title is required
- Start date is required
- End date is required
- End date cannot be before start date
- Cell is required
- Owner is required
- OGSM pillar is required
- Forum is required
- Status is required

---

## 20. Edit Action Modal

Edit modal must allow the user to update the action.

Editable fields:

- Title
- Description
- Start date
- End date
- OGSM pillar/category
- Forum
- Status
- Owner
- Label
- Loss type

Read-only fields:

- Raised by
- Created date
- Updated date

Buttons:

- Save changes
- Cancel
- Add sub-action
- Mark as Not Required
- Delete / archive

---

## 21. Not Required / Archive Logic

“Not Required” means the action is archived from the normal working view.

Rules:

- Not Required actions are hidden by default.
- They should not appear in status cards by default.
- They should only appear when the user selects “Show Not Required”.
- They should be shown in light grey when visible.

---

## 22. Dummy Data

Create realistic dummy data for testing.

Minimum dummy data:

- 2 sites
- 2 plants per site
- 3 cells per plant
- 15–25 people
- 20–30 e-Plan actions
- At least 8 actions with sub-actions
- All statuses represented
- Multiple OGSM pillars
- Multiple forums
- Multiple labels
- Multiple loss types

Example action titles:

- Improve CIL completion for packing line
- Reduce unplanned downtime on evaporator
- Complete DDS coaching deployment
- Review quality check failure trend
- Close audit finding for chemical storage
- Standardise start-up checks for line 2
- Update training matrix for operators
- Investigate top 3 downtime losses

---

## 23. Data Persistence

For version 1, use **browser localStorage** (implemented).

Requirements:

- Actions must remain after page refresh.
- Admin dropdown values must remain after page refresh.
- Selected filters must remain after page refresh.

Structure the code so it can later connect to a real backend API.

Service layer (implemented under `web/src/features/eplan/`):

```txt
eplanService.ts
eplanAdminService.ts
eplanStorage.ts
```

---

## 24. Suggested Component Structure

Use React, TypeScript, and Tailwind CSS.

Suggested components:

```txt
EPlanPage
StatusSummary
HierarchyFilter
ActionFilters
ActionTable
ActionTableRow
GanttTimeline
GanttBar
ActionModal
AdminSetup
AdminDropdownManager
DateRangeFilter
StatusBadge
OwnerBadge
```

Suggested folders:

```txt
/src
  /components
    /eplan
    /admin
    /common
  /data
  /services
  /types
  /utils
```

---

## 25. UI Design Requirements

The app should look professional and clean.

Design direction:

- Modern SaaS style
- Clear spacing
- Rounded cards
- Light background
- Subtle borders
- Clear status colours
- Easy-to-read table
- Gantt timeline should be visually aligned and simple

Important UX principles:

- Fast action creation
- Easy filtering
- Clear ownership
- Clear overdue visibility
- Clear connection to OGSM
- Easy expand/collapse of sub-actions
- Click action or Gantt bar to edit
- Admin can manage dropdowns without code changes

---

## 26. Responsive Behaviour

Desktop is the priority.

For smaller screens:

- Stack filters vertically
- Allow horizontal scroll for table and Gantt
- Keep Create Action button visible
- Keep status cards readable

---

## 27. Acceptance Criteria

The app is complete when:

1. User can select Site, Plant, and Cell.
2. User can create a new e-Plan action.
3. User can create sub-actions under a parent action.
4. User can edit actions by clicking table rows.
5. User can edit actions by clicking Gantt bars.
6. Actions are linked to OGSM pillars.
7. Admin can create and edit OGSM pillars.
8. Admin can manage Forums, Labels, Loss Types, and Owners.
9. Status summary cards update based on filtered actions.
10. Not Required actions are hidden by default.
11. Not Required actions only appear when selected in filters.
12. Gantt timeline shows correct dates and colours.
13. Today line is visible on the timeline.
14. Overdue actions are highlighted.
15. Data persists after page refresh.
16. Dummy data is available for testing.

---

## 28. Build Instruction for Cursor

Build this as a complete React + TypeScript + Tailwind one-page application.

Prioritise clean architecture, readable code, and easy future backend integration.

Do not hardcode dropdown options inside the form. All dropdowns must come from admin setup data.

Create a polished working prototype with local storage persistence and realistic manufacturing dummy data.
