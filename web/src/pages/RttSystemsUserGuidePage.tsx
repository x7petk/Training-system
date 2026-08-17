import { Compass, Layers3, Link2, Palette, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import {
  GuideAccessList,
  GuideBlockList,
  GuideColourGrid,
  GuideParagraphs,
  GuideValueList,
  UserGuideHeader,
  UserGuideSection,
} from '../components/userGuide/UserGuideKit'

const why = [
  'RTT systems is the cell execution space for the next 24 hours: who does which check, on which role column, at which time — plus the boards that catch failures. Plan 24 is the day. Defect Handling, Deviations, and Quality Fails are the issue tracks when a check does not meet standard.',
  'Use it on shift to run the grid, complete CL / CIL / Quality / general checks, raise issues without leaving the check, and review open work on the boards. Admin owns roster templates and schedules; day-to-day execution is open to anyone with the RTT tile.',
]

const principles = [
  {
    title: 'One cell, one date, one shift',
    body: 'Plan 24 is not a plant-wide calendar. Pick Site → Plant → Cell, then a date and Day or Night. Night is one continuous window that can cross midnight, shown as a single plan.',
  },
  {
    title: 'Catalogue vs the live grid',
    body: 'Admins edit Plan 24 roster (roles and shifts) and check schedules. Everyone with RTT access can move events, complete work, add ad-hoc checks, and soft-delete with a comment.',
  },
  {
    title: 'Warn, do not block',
    body: 'Overlapping events in the same role stack like a day diary. One person in several role columns is allowed. Soft warnings beat blocking the floor.',
  },
  {
    title: 'Delete is history',
    body: 'Removing a plan event is a soft delete with a required comment. Past completed work is not rewritten when a schedule changes; future instances follow the new definition.',
  },
  {
    title: 'Fail paths stay typed',
    body: 'CL raises a Deviation. CIL raises a Defect. Quality records a Quality Fail. Boards use the same interaction so crews do not learn three products.',
  },
]

const value = [
  'The shift can see planned work and ad-hoc work on one grid instead of separate lists.',
  'Checks materialise from schedules, so the day is not rebuilt by hand every morning.',
  'Raising an issue from a fail keeps the link back to the check, area, and equipment.',
  'Boards give open / in progress / resolved / closed tracking with priority.',
  'DDS actions on the RTT sidebar is the same action list used in DDS Process — one queue, two doorways.',
]

const functionality = [
  {
    title: 'Scope bar',
    body: 'Select cell, plan date, and shift before the grid or boards mean anything. The same bar is used in DDS Process and Problem Solve when those apps embed Plan 24.',
  },
  {
    title: 'Plan 24',
    body: [
      'Time down the left (shift window from roster setup, 15-minute ruler, free-minute drag). Roles across the top from the active cell roster.',
      'Blocks are scheduled or ad-hoc checks. Click to open, complete, or acknowledge. Drag to another role or time. Unassigned work sits in a side panel until you drop it onto a role.',
      'Ad-hoc work is visually marked. Completing without every sub-task needs an admin override. Status moves toward in-process when the event is first opened.',
    ],
  },
  {
    title: 'Check families on the grid',
    body: [
      'General checks: dark blue blocks. CL: green. CIL: teal. Quality: purple. Completed CL / CIL / Quality keep the same hue at about half fill with strikethrough.',
      'CL steps can be number, range, or text against a standard. CIL tasks can include photos and running/down/other context. Quality steps are pass/fail.',
      'From a fail, raise Deviation (CL), Defect (CIL), or Quality Fail (Quality). Icons on the block show an open linked issue.',
    ],
  },
  {
    title: 'My Plan',
    body: 'Placeholder in the current release. Use Plan 24 for the cell day and List view for a combined checklist. Personal-focus filtering is not wired yet.',
  },
  {
    title: 'List view',
    body: 'All check families for the scoped cell/day in a filterable list. Use it when the grid is busy or you want OEE-style “what is left” rather than a diary layout.',
  },
  {
    title: 'DDS actions',
    body: 'Same cross-app action queue as DDS Process. Create and track actions with surfaces (where they should appear). Timeline view helps the week, list view helps completion.',
  },
  {
    title: 'Deviations / Defect Handling / Quality Fails',
    body: [
      'Three boards, same pattern: create a record for the selected cell, set type, status, and priority, filter by area and equipment from Master data.',
      'Status: open → in progress → resolved → closed. Priority: low / medium / high / critical. Inline status and priority pills update without opening a long form.',
      'Types (catalogues) are super-admin only in RTT Admin. Day-to-day board work is available to anyone with RTT access. Manual create is live; more auto-create from checks continues to grow from the Plan 24 raise-issue flow.',
    ],
  },
  {
    title: 'Admin (admin / super admin)',
    body: [
      'Plan 24 roster: shifts and roles for the cell. Roster changes apply from an effective date forward; history stays as it was.',
      'Checks / CL / CIL / Quality tabs: templates, versions, tasks, schedules, and which roster roles they apply to. Publishing a template version updates future instances, not completed past ones.',
      'Super admin: Defect, Deviation, and Quality Fail type catalogues.',
    ],
  },
]

const design = [
  {
    title: 'Grid language',
    body: 'Outlook-style day view: stack overlaps in a role column. Keep the full shift on screen (zoom if needed). Ad-hoc must stay visually distinct from scheduled work.',
  },
  {
    title: 'Family colours (locked)',
    body: 'Checks dark blue, CL green (#22C55E language), CIL teal, Quality purple. Use the same hues on List view and Admin so crews do not relearn labels.',
  },
  {
    title: 'Raise-issue popup',
    body: 'Quick create from the check: type, location (area/equipment from Master data), and comments. The event keeps a bidirectional link to the board row.',
  },
]

const process = [
  {
    title: '1. Admins publish the day definition',
    body: 'Active roster, roles, shift windows, and schedules for Checks / CL / CIL / Quality. Materialisation puts instances on the grid when the plan is in use.',
  },
  {
    title: '2. Select cell, date, shift',
    body: 'Everyone starts here. Night date is the start calendar day of that night shift.',
  },
  {
    title: '3. Run the shift',
    body: 'Open events as they come due. Complete sub-tasks. Drag if reality moved. Add ad-hoc if something extra must happen. Soft-delete with a comment if it should not stay on the live plan.',
  },
  {
    title: '4. Fail → board',
    body: 'Raise Deviation, Defect, or Quality Fail from the check. Continue the board status until closed. Filter by area and equipment to run a cell walk.',
  },
  {
    title: '5. Close the loop in DDS',
    body: 'Use DDS actions where the meeting needs a named follow-up. Shift DDS in DDS Process can show Plan 24 beside P2P — same cell context.',
  },
]

const colours = [
  { label: 'General check', tone: 'bg-sky-950 text-sky-50 border-sky-900', meaning: 'Scheduled or ad-hoc general Plan 24 check (dark blue family).' },
  { label: 'CL check', tone: 'bg-green-700 text-green-50 border-green-900/40', meaning: 'Centerline. Fail path: Deviation.' },
  { label: 'CIL check', tone: 'bg-teal-700 text-teal-50 border-teal-900/40', meaning: 'Clean, inspect, lubricate. Fail path: Defect Handling.' },
  { label: 'Quality check', tone: 'bg-violet-700 text-violet-50 border-violet-900/40', meaning: 'Quality. Fail path: Quality Fail.' },
  { label: 'Completed CL/CIL/Quality', tone: 'bg-green-700/50 text-green-50 border-green-900/35', meaning: 'Same family colour at lower fill, strikethrough — done, still identifiable.' },
  { label: 'Issue open', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'Board status open, or high/critical priority pills on Defect / Deviation / Quality Fail boards.' },
  { label: 'Issue in progress', tone: 'bg-amber-100 text-amber-950 border-amber-200', meaning: 'Work started, not resolved.' },
  { label: 'Issue resolved / closed', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'Resolved keeps the record visible; closed finishes the workflow.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Plan 24 and boards require a cell. Area and equipment on checks and issue records come from Master data under that cell. There is no separate “RTT enabled” flag — if the cell exists, it can be planned.',
  },
  {
    title: 'People and Skill Matrix',
    body: 'People on roster columns come from shared people (Master data / Skill Matrix people). Plan 24 roster roles are configured in RTT Admin; they are not the same table as Skill Matrix job roles, even when names match.',
  },
  {
    title: 'DDS Process and Problem Solve',
    body: 'The same Plan 24 grid is embedded under DDS Process and Problem Solve so meetings and breakdowns share one day picture. DDS actions is shared. Scope bar choices are remembered per browser origin.',
  },
  {
    title: 'LDR tools',
    body: 'LDR health checks are leadership standards at cell level. They are not Plan 24 timed checks. Do not expect LDR RAG to move Plan 24 blocks.',
  },
]

const access = [
  {
    title: 'Anyone with the RTT tile',
    body: [
      'Run Plan 24: view, drag, ad-hoc, complete, soft-delete with comment, raise issues, use boards and List view, open this User Guide.',
      'There is no read-only RTT login in the current version.',
    ],
  },
  {
    title: 'Admin / super admin',
    body: 'RTT Admin: roster, check family templates and schedules. Admin override to complete without all sub-tasks. Super admin also edits Defect / Deviation / Quality Fail type catalogues.',
  },
  {
    title: 'Hub tile',
    body: 'Granted by super admin on Login accounts → Section access. Operator vs assessor login role does not restrict Plan 24 once the tile is on.',
  },
]

export function RttSystemsUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="RTT systems — User Guide"
        subtitle="Plan 24, checks, DDS actions, defect / deviation / quality-fail boards, and how they connect to Master data."
        iconClass="bg-sky-500/15 text-sky-800 dark:text-sky-300"
      />

      <UserGuideSection title="Why this app exists" Icon={Compass}>
        <GuideParagraphs text={why} />
      </UserGuideSection>

      <UserGuideSection title="Design principles" Icon={Sparkles}>
        <GuideBlockList blocks={principles} />
      </UserGuideSection>

      <UserGuideSection title="Value it adds">
        <GuideValueList items={value} />
      </UserGuideSection>

      <UserGuideSection title="Functionality" Icon={Layers3} lead="Left navigation, top to bottom.">
        <GuideBlockList blocks={functionality} />
      </UserGuideSection>

      <UserGuideSection title="Design">
        <GuideBlockList blocks={design} />
      </UserGuideSection>

      <UserGuideSection title="Process" Icon={Workflow}>
        <GuideBlockList blocks={process} />
      </UserGuideSection>

      <UserGuideSection title="Colour coding" Icon={Palette}>
        <GuideColourGrid items={colours} />
      </UserGuideSection>

      <UserGuideSection title="Connections to Master data and other apps" Icon={Link2}>
        <GuideBlockList blocks={connections} />
      </UserGuideSection>

      <UserGuideSection title="Access — who can do what" Icon={ShieldCheck}>
        <GuideAccessList items={access} />
      </UserGuideSection>
    </div>
  )
}
