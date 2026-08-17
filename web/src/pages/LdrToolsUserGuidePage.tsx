import { Compass, Layers3, Link2, Palette, PlayCircle, Repeat2, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
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
  'LDR tools is the leadership workspace: plan the week, put names against leadership activities, then complete health checks and observations at cell level. It exists so site and cell leadership work is visible on the same calendar language, not in separate notebooks.',
  'Use Calendar to see the week. Use Roster to assign people and RAG. Use Health Checks and Observation System (SOS / QOS / PPO) to run the standards. Use reports for trends. Use Admin to keep people, activities, and templates accurate.',
]

const principles = [
  {
    title: 'Site workspace vs cell workspace',
    body: 'Switching Site / Cell in the scope bar does not delete data. It changes which LDR workspace you are in. Cell-created activities stay on that cell. Site activities can be shown on a cell roster if Admin turns visibility on.',
  },
  {
    title: 'Catalogue vs execution',
    body: 'Admins maintain LDR people, activity names, types, and templates. Anyone with the LDR tile can plan, assign, complete checks, and submit.',
  },
  {
    title: 'Submit is history',
    body: 'Drafts can be saved and resumed. After submit, a health check or observation is frozen. Admins can delete a submitted record when it must be removed; operators cannot rewrite it.',
  },
  {
    title: 'Conflicts warn, they do not block',
    body: 'The same person on two activities in one day is highlighted so you see it. You can still save — coordinators need to record what actually happened.',
  },
  {
    title: 'Cell-level checks',
    body: 'Health checks and observations always belong to a cell. Report pages hide the usual Site/Cell bar and show every record you are allowed to see under LDR access rules.',
  },
]

const value = [
  'Everyone sees the same leadership week before arguments start on the floor.',
  'Assignments carry RAG and comments, so cell status is not only a conversation in the office.',
  'Complete HC / SOS / QOS / PPO from the roster so the check is already linked to the assignment.',
  'Templates keep questions standard; scores and RAG stay comparable week to week.',
  'Reports show volume, who completed work, and RAG mix without exporting.',
]

const functionality = [
  {
    title: 'Scope bar',
    body: [
      'Pick Site for site-wide planning, or Cell and then Plant + Cell for local execution. Last choice is remembered on this device (localhost and production do not share it).',
      'Health Checks and Observation System use their own cell filter so a site-wide roster choice does not accidentally create a cell check in the wrong place.',
    ],
  },
  {
    title: 'Calendar',
    body: [
      'Weekly board Monday–Sunday of all-day leadership events. Create or edit title, dates, colour, and notes. Drag an event to move it; a three-week compact preview sits under the main board.',
      'Calendar is shared context. It does not assign people — that is Roster.',
    ],
  },
  {
    title: 'Roster',
    body: [
      'People against activities and days. Open a day cell to add a person, set RAG with one tap (None / Green / Yellow / Red), add comments, and (in site scope) tap a cell tag.',
      'Drag assignments between days or activities when the plan changes. Avatar colours are fixed presets so people stay recognisable in a dense week.',
      'When an activity is linked to HC or an observation system and an active template exists, Complete HC / SOS / QOS / PPO appears. That shortcut prefills date and location from the assignment.',
    ],
  },
  {
    title: 'Health Checks',
    body: [
      'Start or resume a standardised check at a cell. Questions are cards with live scoring. Save draft, then submit. Submit stores the template snapshot and answers; they cannot be edited afterwards.',
      'FAIL answers need a comment before submit. Record screens keep submit/delete in a sticky bottom bar with autosave status.',
    ],
  },
  {
    title: 'Observation System (SOS, QOS, PPO)',
    body: [
      'Same list → new → record → report pattern as Health Checks, with their own activity links and templates.',
      'SOS uses one Full / Partly / Not outcome plus a reference checklist. Optional good/bad example images sit in green/red frames.',
      'QOS and PPO score Pass / Fail / N/A per question. N/A is excluded from the score. Optional operator text and comments support the answers. FAIL still needs a comment on submit.',
    ],
  },
  {
    title: 'Reports',
    body: [
      'Submitted records only. Compact filters: date range, type, completer. No Site/Cell scope bar — you see all records your LDR access allows.',
      'Summary cards, RAG mix, weekly volume/average, by-type and by-completer tables, plus the record list. There is no export in the current reports.',
    ],
  },
  {
    title: 'Admin (admin / super admin)',
    body: [
      'LDR people (status, avatar) used on Roster. Activity names and order. In cell scope, choose which site activities appear on this cell’s roster.',
      'HC and observation types, versioned templates, questions, and optional good/bad images. Activate only the current template version.',
    ],
  },
]

const design = [
  {
    title: 'What you will notice',
    body: [
      'RAG is one tap so updates are fast on the floor. Cell on an assignment (site scope) is also one tap — no long dropdown in the edit popup.',
      'Record screens keep actions at the bottom so you do not scroll to submit. Good example frames are green; bad examples are red; empty frames stay so the standard is still visible.',
    ],
  },
  {
    title: 'How site planning shows in cell scope',
    body: [
      'Activities created while in Cell scope stay in that cell workspace and never appear on the site roster.',
      'In Cell scope, Admin → Activities controls which site activities are visible locally. People lists in cell scope are that cell’s LDR people.',
      'If something looks missing, check activity visibility or switch to Site scope for the full site plan.',
    ],
  },
]

const process = [
  {
    title: '1. Set scope',
    body: 'Site for planners; Cell with Plant + Cell for local execution.',
  },
  {
    title: '2. Plan in Calendar',
    body: 'Lay out the week so the roster has a shared story before names go on activities.',
  },
  {
    title: '3. Assign in Roster',
    body: 'Add people, RAG, comments, and cell tags. Drag when the week changes. Complete HC or observations from the assignment when you can so linkage stays intact.',
  },
  {
    title: '4. Complete and submit',
    body: 'Answer every required question. Comment every FAIL. Submit when the check is true. Duplicate-submit protection stops accidental repeats for the same user, type, cell, day, and assignment.',
  },
  {
    title: '5. Read reports weekly',
    body: 'Look at RAG mix, volume, and completer. Hunt stale drafts. Admins keep people, activities, and templates current.',
  },
]

const colours = [
  { label: 'Green RAG', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'Healthy / acceptable outcome on roster or a submitted check.' },
  { label: 'Yellow RAG', tone: 'bg-amber-100 text-amber-950 border-amber-200', meaning: 'Caution — gaps or partial compliance. Follow up.' },
  { label: 'Red RAG', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'High concern. Action required.' },
  { label: 'None / blank', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', meaning: 'Not assessed yet.' },
  { label: 'PASS', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'Question answer: meets the standard.' },
  { label: 'FAIL', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'Question answer: does not meet the standard. Comment required before submit.' },
  { label: 'N/A (QOS / PPO)', tone: 'bg-zinc-200 text-zinc-800 border-zinc-300', meaning: 'Not applicable. Excluded from the score.' },
  { label: 'Good / bad images', tone: 'bg-sky-100 text-sky-950 border-sky-200', meaning: 'Green frame = good example. Red frame = bad example.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Site, plant, and cell selectors are the Master data tree. Health checks and observations always store a cell. Super admins own the tree; LDR users need it to exist so scope bars can work.',
  },
  {
    title: 'People',
    body: 'LDR people sit on top of shared people (names, login link). Maintain LDR-specific status and avatar in LDR Admin so Roster stays usable. Skill Matrix people and teams are a different catalogue view of the same people records.',
  },
  {
    title: 'Other apps',
    body: 'LDR does not replace Plan 24. Plan 24 is the cell day/shift execution grid in RTT / DDS. Completing an LDR check does not raise an RTT defect automatically. Create Action on HC remains a placeholder where shown.',
  },
]

const access = [
  {
    title: 'Anyone with the LDR tile',
    body: [
      'Calendar, Roster, Health Checks, Observation System, reports, and this User Guide.',
      'Create drafts, complete, submit, assign people, set RAG. Start from Roster when you can so assignment linkage stays.',
    ],
  },
  {
    title: 'Admin / super admin',
    body: [
      'LDR Admin: people, activities, site-activity visibility, types and templates (including images).',
      'Delete submitted HC / observation records when they must be removed. Activate only current templates.',
    ],
  },
  {
    title: 'Hub tile',
    body: 'Super admin grants LDR tools on Login accounts → Section access. Login role (operator vs assessor) does not add extra LDR powers once the tile is on.',
  },
]

const troubleshooting = [
  'No Complete buttons on Roster: the activity must be linked and at least one active type needs an active template.',
  'Plant/Cell shows a dash on a new record: the assignment needs a valid cell, or pick cell manually.',
  'Cannot submit: unanswered questions or FAIL without a comment.',
  'Missing activities in cell scope: Admin → Activities visibility for that cell, or switch to Site scope.',
  'Unexpected records on a report: reports ignore the scope bar on purpose and show every LDR record you can access.',
]

export function LdrToolsUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="LDR tools — User Guide"
        subtitle="Calendar, roster, health checks, observations, reports, and how site vs cell workspaces fit together."
        iconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
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

      <UserGuideSection title="Quick start" Icon={PlayCircle}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-fg">
          <li>Open LDR tools from App Hub, then set Site or Cell in the scope bar.</li>
          <li>Use Calendar for the week, then Roster to assign people, RAG, and comments.</li>
          <li>Complete HC or observations from the assignment when the button is available.</li>
          <li>Read HC Report and OS Report for trends. Admins use Admin under this User Guide in the footer.</li>
        </ol>
      </UserGuideSection>

      <UserGuideSection title="Functionality" Icon={Layers3} lead="Each area of the left navigation.">
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

      <UserGuideSection title="Feedback loops" Icon={Repeat2}>
        <GuideBlockList
          blocks={[
            {
              title: 'Roster → check',
              body: 'Complete HC / SOS / QOS / PPO from the assignment modal. Date and location prefetch from that assignment where they exist.',
            },
            {
              title: 'Submit → Roster',
              body: 'When a linked assignment exists, submit can sync RAG back and append comment history. Duplicate protection covers the same user, type, cell, day, and assignment context.',
            },
            {
              title: 'Scope on return',
              body: 'If you started in Site scope, you return in Site scope. Cell scope keeps the same Site / Plant / Cell.',
            },
          ]}
        />
      </UserGuideSection>

      <UserGuideSection title="Connections to Master data and other apps" Icon={Link2}>
        <GuideBlockList blocks={connections} />
      </UserGuideSection>

      <UserGuideSection title="Access — who can do what" Icon={ShieldCheck}>
        <GuideAccessList items={access} />
      </UserGuideSection>

      <UserGuideSection title="Common issues">
        <ul className="space-y-2 text-sm text-muted">
          {troubleshooting.map((item) => (
            <li key={item} className="border-l-2 border-border pl-3">
              {item}
            </li>
          ))}
        </ul>
      </UserGuideSection>
    </div>
  )
}
