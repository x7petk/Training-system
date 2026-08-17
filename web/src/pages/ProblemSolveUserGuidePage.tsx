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
  'Problem Solve is where structured elimination of losses lives. Today the live engine is BDE — Breakdown Elimination — so a breakdown has a record, photos, AODC codes, actions, and reports instead of a verbal handoff at shift change.',
  'Plan 24 and DDS actions are included so you can see the day grid and the action queue without leaving the app. Other methods (IPS, UPS, W-W, IDA, OPM, Safety, Quality) are reserved nav items; their screens are not live yet.',
]

const principles = [
  {
    title: 'Same cell as Plan 24',
    body: 'Pick Site, Plant, Cell, date, and shift in the scope bar before creating a BDE. Records belong to that cell. Area and equipment come from Master data under the cell.',
  },
  {
    title: 'Catalogue vs record',
    body: 'Admins maintain problem types and AODC code lists (Activity, Object part, Damage, Cause). Anyone with the Problem Solve tile can create and complete BDE records.',
  },
  {
    title: 'Saved vs completed',
    body: 'A BDE can sit as Saved while you gather facts. Completed is the closed analysis for reporting. Actions on a BDE have their own open / in progress / completed status.',
  },
]

const value = [
  'One breakdown identity (display ID) that shift and engineering can reopen.',
  'AODC coding makes trends by activity, object, damage, and cause possible.',
  'Photos and “what was checked / what happened / results” keep the investigation in the record.',
  'Reports cover volume, actions, and trends instead of a private spreadsheet.',
  'Optional links back to a Plan 24 event or DDS item keep the breakdown in the day’s story.',
]

const functionality = [
  {
    title: 'Plan 24 / DDS actions',
    body: 'Same tools as RTT / DDS. Use them to see whether the breakdown sat on a timed check or already has a meeting action.',
  },
  {
    title: 'BDE — Records',
    body: [
      'List of breakdowns for the scoped cell. Status pills: Saved (in progress capture) or Completed.',
      'Create New: title, problem statement, area, equipment, problem type, functional location, component, notification/work order numbers, narrative fields, photos.',
      'Link a Plan 24 event or DDS item when the breakdown started from the grid or a meeting. Add actions with owner (people), due date, and status.',
      'AODC letters are chosen from Admin catalogues. Soft-delete is available to remove a mistake from the live list.',
    ],
  },
  {
    title: 'BDE — Reports',
    body: [
      'Breakdown report: counts by status and problem type, filterable list, drill into a record.',
      'Actions report: open vs in progress vs completed actions, by day. Use it in DDS to chase owners.',
      'Trends: equipment and type over time. Filter by Saved / Completed to separate working files from closed analyses.',
    ],
  },
  {
    title: 'Placeholders',
    body: 'IPS, UPS, W-W, IDA, OPM, Safety, and Quality show a “coming later” page. They share the Plan 24 scope bar so future tools land in the same cell context. Do not enter production investigations there yet.',
  },
  {
    title: 'Admin',
    body: 'Problem types and four AODC lists. Inactive codes hide from new records; existing records keep what they stored.',
  },
]

const design = [
  {
    title: 'BDE editor',
    body: 'Record editor is a dedicated route so lists stay fast. Reports live under BDE → Reports with sub-routes for actions and trends.',
  },
  {
    title: 'Pills',
    body: 'BDE saved = sky. Completed = green. Action open = default, in progress = sky, completed = green. Match those colours in conversation with the board, not with Skill Matrix gap colours.',
  },
]

const process = [
  {
    title: '1. Select the cell',
    body: 'Wrong cell = wrong equipment list and missing records.',
  },
  {
    title: '2. Create the BDE while facts are fresh',
    body: 'Title and what happened first. Photos next. Area/equipment and problem type as soon as they are known. Save if the shift must move on.',
  },
  {
    title: '3. Code and act',
    body: 'AODC when the technical story is clear. Actions with owners and due dates. Link Plan 24 if the event still sits on the grid.',
  },
  {
    title: '4. Complete and review',
    body: 'Mark the BDE completed when the analysis is done (actions may still run). Use reports in DDS or engineering reviews.',
  },
]

const colours = [
  { label: 'BDE Saved', tone: 'bg-sky-100 text-sky-950 border-sky-300', meaning: 'Capture in progress — not the final analysis.' },
  { label: 'BDE Completed', tone: 'bg-emerald-100 text-emerald-950 border-emerald-300', meaning: 'Record finished for reporting.' },
  { label: 'Action in progress', tone: 'bg-sky-600 text-white border-sky-700', meaning: 'Follow-up work started.' },
  { label: 'Action completed', tone: 'bg-emerald-600 text-white border-emerald-700', meaning: 'Follow-up done.' },
  { label: 'Plan 24 families', tone: 'bg-green-700 text-green-50 border-green-900/40', meaning: 'Same CL / CIL / Quality colours as RTT when you open Plan 24 here.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Cell, area, and equipment on BDE are Master data IDs. Super admins must keep the tree accurate or BDE location fields will be empty or wrong.',
  },
  {
    title: 'People',
    body: 'Action owners are shared people records. Link logins in Master data / Skill Matrix if you want owners to recognise themselves when they sign in.',
  },
  {
    title: 'RTT and DDS',
    body: 'Plan 24 events and DDS actions can be referenced on a BDE. Raising a CIL defect is Defect Handling, not BDE — use BDE for breakdown elimination, DH for defects found on CIL.',
  },
]

const access = [
  {
    title: 'Anyone with the Problem Solve tile',
    body: 'Plan 24, DDS actions, BDE records and reports, this User Guide. Create and edit BDEs for the selected cell.',
  },
  {
    title: 'Admin / super admin',
    body: 'BDE Admin catalogues. Footer Admin link appears for admins.',
  },
  {
    title: 'Hub tile',
    body: 'Granted by super admin on Login accounts → Section access.',
  },
]

export function ProblemSolveUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="Problem Solve — User Guide"
        subtitle="Breakdown Elimination (BDE), how it uses Master data, and which other methods are still placeholders."
        iconClass="bg-orange-500/15 text-orange-900 dark:text-orange-300"
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

      <UserGuideSection title="Functionality" Icon={Layers3}>
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
