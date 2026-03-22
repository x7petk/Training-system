Skill Matrix

## Overview

The **Skill Matrix** module is the workforce capability and competency
management system.

Its purpose is to connect:

-   People
-   Roles
-   Skills

and allow the business to compare:

-   **Required skill level** for a role
-   **Actual skill level** of a person

The module must help users identify:

-   critical skill gaps
-   minor gaps
-   skills that meet requirements
-   skills that exceed requirements
-   extra capabilities not required by the role
-   overdue development items

This module must be built as a **wide-screen, highly interactive,
premium enterprise tool**, not as a simple spreadsheet.

It must support operational filtering by:

-   Site
-   Plant
-   Cell
-   Team
-   Role
-   Skill Group

and must use the same shared data structure as the rest of BMS
Accelerator.

------------------------------------------------------------------------

# 1. Core Purpose

The Skill Matrix is used to:

-   define required skills by role
-   store actual skills by person
-   identify skill gaps
-   assign due dates for missing capability
-   report capability by role / team / plant / cell
-   support workforce planning and qualification visibility

The system should answer questions such as:

-   What skills are required for this role?
-   Does this person meet the role requirements?
-   Which skills are overdue?
-   Which teams have capability gaps?
-   Which people have extra skills beyond their role?

------------------------------------------------------------------------

# 2. Core Data Model

The Skill Matrix must be built around these main entities:

-   Person / User
-   Role
-   Skill
-   Skill Group
-   Role Skill Requirement
-   Person Skill
-   Extra Person Skill

------------------------------------------------------------------------

# 3. Role-Based Skill Requirements

Each role must define a list of **required skills**.

Each required skill must include:

-   Skill
-   Required level

A role may contain:

-   multiple skills
-   skills from multiple skill groups

Role requirements must be standardized across the system.

The same role definitions must be shared with:

-   Roster Admin
-   Plan for the Day
-   Admin master data

No duplicate role structure should be created inside Skill Matrix.

------------------------------------------------------------------------

# 4. Skill Scale Rules

The module must support two skill types:

## 4.1 Numeric skills

Use a fixed scale:

-   **1 = No knowledge**
-   **2 = Theoretical understanding**
-   **3 = Practical capability**
-   **4 = Expert / Trainer**

This scale must be fixed and **cannot be customized by users**.

------------------------------------------------------------------------

## 4.2 Certification skills

Some skills must be binary instead of numeric.

Examples: - Forklift License - Permit to Work - Confined Space
Qualification

Possible values: - Yes - No

The system must support both numeric and certification-style skills in
the same module.

------------------------------------------------------------------------

# 5. Person and Role Logic

A person may have:

-   one role
-   multiple roles

Required skills for a person must be automatically derived from their
assigned roles.

This means the required skill set for a person is the combined set of
role requirements.

Actual skills must always be stored at the **person level**, not on the
role record.

------------------------------------------------------------------------

# 6. Due Date Rule

If:

``` text
Actual Skill < Required Skill
```

then a **due date** must be assigned.

Purpose: - track when the person should reach the required capability

If:

``` text
Actual Skill >= Required Skill
```

then a due date is not required.

------------------------------------------------------------------------

# 7. Extra Personal Skills

The system must allow users to store **extra skills** not required by
their assigned role.

Rules:

-   extra skills are stored separately from role requirements
-   extra skills do not change required role skills
-   extra skills still require an actual level
-   extra skills should appear visually different in the matrix

Examples: - Lean Facilitation - Python / Analytics - Additional machine
experience - Cross-training beyond assigned role

------------------------------------------------------------------------

# 8. Main Matrix View

## Layout

The main Skill Matrix screen must be optimized for **wide screens**.

Requirements:

-   Rows = People
-   Columns = Skills
-   Cell value = actual skill level
-   Matrix compares actual vs required

The matrix must be built as the main central analysis view.

------------------------------------------------------------------------

## Wide-Screen Design Requirements

The module must be designed desktop-first and optimized for large
monitors.

Requirements:

-   wide layout
-   sticky top row for skill headers
-   sticky left column for person names if possible
-   horizontal scrolling for many skills
-   compact but readable cell layout
-   strong visual heatmap feel
-   large, interactive analysis workspace

This must not feel like a narrow form page.

------------------------------------------------------------------------

## Interactivity Requirements

The matrix must be highly interactive.

Users should be able to:

-   filter instantly
-   search instantly
-   click cells to open details
-   click a person to open person-skill detail
-   click a role to filter matrix
-   hover over cells for more information
-   quickly update actual skill level where permissions allow
-   quickly review due dates and comments later

The module should feel like an enterprise analysis tool, not a static
spreadsheet.

------------------------------------------------------------------------

# 9. Color Coding Logic

Color coding is one of the most important parts of this app.

Use:

``` text
Delta = Actual Level − Required Level
```

------------------------------------------------------------------------

## 9.1 Critical Gap

Condition: - actual missing - OR actual \< required - 1

Color: - **Red**

Meaning: - major deficiency / critical gap

------------------------------------------------------------------------

## 9.2 Minor Gap

Condition: - actual = required - 1

Color: - **Amber**

Meaning: - slightly below requirement

------------------------------------------------------------------------

## 9.3 Meets Requirement

Condition: - actual = required

Color: - **Green**

Meaning: - requirement met

------------------------------------------------------------------------

## 9.4 Exceeds Requirement

Condition: - actual \> required

Color: - **Dark Green / Teal**

Meaning: - exceeds requirement / additional strength

------------------------------------------------------------------------

## 9.5 Extra Personal Skill

Condition: - skill exists for person - but no assigned role requires it

Color: - **Light Blue**

Meaning: - additional capability beyond role requirement

------------------------------------------------------------------------

## 9.6 Not Applicable

Condition: - skill not required - and not recorded

Color: - neutral / empty

------------------------------------------------------------------------

## 9.7 Color Consistency Rule

These colors must remain consistent across:

-   main matrix
-   person detail
-   dashboards
-   reports
-   summary cards if relevant

------------------------------------------------------------------------

# 10. Filters and Search

The Skill Matrix must include a strong top control bar.

## Required filters

-   Site
-   Plant
-   Cell
-   Team
-   Role
-   Skill Group
-   Person
-   Gap status
-   Due date range
-   Certification type if useful

## Search

Support search by: - person name - role - skill name

## Quick filters

Support useful quick filters such as: - overdue skills only - due in
next 7 days - due in next 30 days - critical gaps only - one role only -
one team only - one skill group only

------------------------------------------------------------------------

# 11. KPI Summary Cards

At the top of the page include summary cards such as:

-   Total People
-   Total Required Skills
-   Overdue Skills
-   Skills Due in 7 Days
-   Skills Due in 30 Days
-   Critical Gaps
-   Coverage %
-   Extra Skills Count

These should feel premium and data-rich.

------------------------------------------------------------------------

# 12. Person Detail View

Clicking a person row or matrix cell should open a drawer, modal, or
detail page showing:

-   person name
-   assigned roles
-   required skills
-   actual skills
-   extra skills
-   due dates
-   current gap status
-   last updated info
-   quick edit actions if allowed

This detail view should make the matrix more usable and interactive.

------------------------------------------------------------------------

# 13. Editing Behavior

Where permissions allow, users should be able to:

-   click a cell to update actual level
-   update due date
-   add extra skill
-   review role assignment
-   edit or review certification status

The interaction should be fast and clean.

------------------------------------------------------------------------

# 14. Reporting Requirements

The module must provide reporting for:

-   overdue skills
-   skills due within next 7 days
-   skills due within next 30 days
-   skill coverage by role
-   skill gaps by team
-   capability overview by site / plant / cell

These can be shown through: - KPI cards - filtered tables - summary
widgets - optional charts

------------------------------------------------------------------------

# 15. Required Admin Setup

The Skill Matrix depends heavily on correct Admin setup.

Admin must be able to configure:

## 15.1 People

Fields: - Full Name - Team - Primary Role - Secondary Roles (optional) -
Site - Plant - Cell - Active / Inactive

People must be shared with the whole BMS platform.

------------------------------------------------------------------------

## 15.2 Roles

Admin must manage: - Role Name - Role Group - Description - Active /
Inactive

Roles must be shared with: - Roster Admin - Plan for the Day - Skill
Matrix

------------------------------------------------------------------------

## 15.3 Skill Groups

Suggested manufacturing skill groups: - Safety - Quality - Process -
Equipment - Maintenance - Leadership - Compliance - Continuous
Improvement

------------------------------------------------------------------------

## 15.4 Skills

Admin must manage: - Skill Name - Skill Group - Skill Type (Numeric /
Certification) - Description - Active / Inactive

All skills should be manufacturing-related.

------------------------------------------------------------------------

## 15.5 Role Skill Requirements

Admin must be able to assign required skills to each role, including: -
role - skill - required level

------------------------------------------------------------------------

## 15.6 Teams

Teams should be available for filtering and grouping.

Suggested teams: - Shift 1 - Shift 2 - Shift 3 - Shift 4 - Other

------------------------------------------------------------------------

## 15.7 Location Structure

The module must use the shared hierarchy: - Site - Plant - Cell

from Admin.

------------------------------------------------------------------------

# 16. Shared Data Rules

The Skill Matrix must use the same shared master data as the rest of the
platform.

If something changes in Admin, it must update here automatically.

Examples: - rename a role → updates in matrix - move a person to another
team → updates filters and reports - change a skill group → updates
grouping and filters

There must not be separate disconnected data inside Skill Matrix.

------------------------------------------------------------------------

# 17. Integrations with Other Apps

## Roster Admin

Uses the same roles and people structure.

## Plan for the Day

Future-ready integration: - optionally warn if a person assigned to a
role does not meet required skill level

## Admin

Provides: - people - roles - teams - skills - skill groups - location
hierarchy

## Analytics

Track: - filter usage - matrix opens - edits - person detail opens

------------------------------------------------------------------------

# 18. Dummy Data Requirements

Create realistic demo data so the matrix feels alive.

Required scale: - **25 people** - **25 manufacturing-related skills** -
multiple roles - multiple teams - multiple skill groups - multiple gaps
and strengths

Dummy data should include: - people meeting requirements - people below
requirements - people exceeding requirements - overdue skills - due in 7
days - due in 30 days - extra personal skills - certification examples

The matrix should look meaningful on first load.

------------------------------------------------------------------------

# 19. Suggested Manufacturing Skills

Examples of realistic skills: - Lockout Tagout - Dryer Operation -
Evaporator Operation - Packaging Line Operation - Product Changeover -
CIP Procedure - Lubrication Basics - Inspection Standards - Defect
Recognition - Quality Sampling - Foreign Matter Control - GMP
Compliance - HACCP Awareness - Forklift License - Confined Space
Awareness - Permit to Work - Startup / Shutdown Procedure - Equipment
Cleaning Standards - Process Monitoring - HMI Operation - Batch Record
Accuracy - Autonomous Maintenance - Centerlining Basics - Safety
Observation - Problem Solving Basics

------------------------------------------------------------------------

# 20. UX / Design Requirements

The module must feel:

-   premium
-   modern
-   data-rich
-   enterprise SaaS
-   visually clear
-   wide-screen optimized
-   highly interactive

Important: - do not make it look like a plain spreadsheet - do not make
it feel cramped - use elegant spacing and hierarchy - use sticky headers
/ columns where useful - use hover states and tooltips - make it one of
the strongest visual modules in BMS Accelerator

------------------------------------------------------------------------

# 21. MVP Success Criteria

The Skill Matrix module is successful when:

-   roles define required skills
-   people have actual skill levels
-   required vs actual comparison works
-   color coding works exactly as defined
-   due dates appear correctly
-   extra skills are supported
-   filters work fast
-   the matrix is wide-screen and highly interactive
-   clicking rows/cells opens meaningful detail
-   dummy data makes the module feel real and useful

------------------------------------------------------------------------

# 22. Recommended Build Order

Implement in this sequence:

1.  shared people / roles / skills data model
2.  admin setup pages for roles, skills, skill groups, role requirements
3.  person skill storage and due date logic
4.  wide-screen matrix shell
5.  sticky headers / sticky person column
6.  actual vs required comparison
7.  color coding rules
8.  top filters and KPI cards
9.  cell click / person detail interactions
10. editing behavior
11. reporting widgets
12. dummy data seed
13. final UX polish

------------------------------------------------------------------------

# Final Note

The Skill Matrix must be built as a **core workforce intelligence
tool**.

It is not only a report. It is a live operational capability system that
supports: - staffing visibility - training priorities - qualification
review - future planning integration with Plan for the Day and Roster
