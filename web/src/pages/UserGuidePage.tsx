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
  'Skill Matrix exists so a manufacturing site can see, in one place, whether people can actually do the jobs they are assigned to. It compares what each job role requires with what each person currently has — then shows the gap in colour so training and assessment stay visible, not buried in spreadsheets.',
  'Use it when you need to know who is ready for a role, who still needs theory or practical sign-off, which certifications are missing, and which target dates are overdue.',
]

const principles = [
  {
    title: 'Required level comes from job roles',
    body: 'A person’s required level for a skill is the highest requirement across all of their assigned job roles. Changing roles updates the picture without rewriting their actual scores.',
  },
  {
    title: 'Catalogue vs scores stay separate',
    body: 'Admins maintain groups, skills, roles, and training packs. Assessors (and admins) record actual levels. Operators read their own skills and can take Level 1 → 2 training where a pack exists.',
  },
  {
    title: 'Colours are the language',
    body: 'Critical, minor, meets, exceeds, extra, and N/A mean the same thing on Matrix, My skills, and Dashboard. Use colour first, then open the cell for detail.',
  },
  {
    title: 'Due dates are discipline, not a lock',
    body: 'You can put a target date on a gap. The app will not force a date the moment a gap appears — it helps you manage overdue and upcoming work.',
  },
  {
    title: 'Operators only see themselves here',
    body: 'Skill Matrix is org-wide (not site/plant/cell scoped). Operators are limited to their linked person on My skills so they cannot browse other people’s scores.',
  },
]

const value = [
  'Leaders see capability gaps before they show up as downtime or quality loss.',
  'Team leads can plan who can cover a role, not just who is on shift.',
  'Assessors have one grid to update levels, extras, and targets.',
  'Operators have a clear view of what their roles need and which training they can take.',
  'Training completions and assessor promotions become reportable history, not hallway knowledge.',
]

const functionality = [
  {
    title: 'Dashboard (staff)',
    body: [
      'Best for target-date management. Tiles filter to Overdue, Next 7 days, Next 30 days, and gaps with no target date.',
      'Use the overdue and coming-due tables to walk a team through the week. Bar charts bucket work by 12 weeks or 12 months — click a bucket to focus the list.',
      'Operators do not see Dashboard; they land on My skills.',
    ],
  },
  {
    title: 'Matrix (staff)',
    body: [
      'Wide grid: people as rows, skills as columns grouped by skill group. Each cell shows required vs actual and the gap colour.',
      'Search people or skills, then use role, team, and skill-group chips together to focus one area of the plant.',
      'Click a cell to update actual level, extra-skill tracking, or target date if you are allowed to edit. Changes save immediately and flow through to My skills, Dashboard, and Report.',
      'Certification skills are yes/no (stored as numbers, treated as binary). Plan skills follow staged programmes, not a single 1–4 cell in the same way.',
    ],
  },
  {
    title: 'My skills',
    body: [
      'Operators: read-only view of the person record linked to their login. If nothing appears, ask an admin to link your login under Admin → People or Master data → People.',
      'Staff: pick any person. If your login is linked to a person, you can edit your own scores here.',
      'Splits “Required for your roles” from “Extra skills tracked”. Filters include gap type and skill group; staff also get person, team, and role.',
      'Target tiles (overdue / 7 / 30 / no date) work like Dashboard. Open Training when a numeric skill is at level 1 and a pack plus quiz exist.',
    ],
  },
  {
    title: 'Report (staff)',
    body: [
      'Leadership review of passed Level 1 → 2 training attempts and Level 2 → 3 progression events (where those events exist).',
      'Also summarises current role gaps from the live matrix. Use it in weekly capability conversations, not as a cell-level shift board.',
    ],
  },
  {
    title: 'Admin — Catalog',
    body: [
      'Skill groups first — they become Matrix columns and My skills headings.',
      'Skills next: numeric (1–4), certification (yes/no), or plan (staged programme).',
      'Job roles are roster/job titles (Packing 1, Team lead), not login roles. Then connect skills to roles in Role skill requirements with the required level.',
      'Skill plans define stages and knowledges. People enrol when an assigned role requires that plan skill. If the role is later removed, unused plan-only knowledge rows can drop unless they are extra or still required.',
    ],
  },
  {
    title: 'Admin — Training and assessment',
    body: [
      'Skill training: packs, page layouts, images, links, documents, and quiz questions for operator self-training from level 1 to 2.',
      'Skill assessment: instructions and assessor checklists for practical and certification sign-off. Level 2 → 3 is not a self-quiz.',
    ],
  },
  {
    title: 'Admin — Organisation',
    body: [
      'Teams group people for filters (shifts, cells, areas). Teams in Skill Matrix are not the same as Master data cells, but naming them to match the plant makes reports easier to scan.',
      'People: display name, team, one or more job roles, and optional link to a login. Linking a login is what lets an operator open My skills and take training.',
    ],
  },
]

const design = [
  {
    title: 'Layout',
    body: 'Dense desktop/tablet grid first. Filters are chips, not buried menus. Sidebar is Skill Matrix only; App Hub is always one click via the brand (admins) or back to hub from other apps.',
  },
  {
    title: 'Numeric scale (locked)',
    body: '1 = No knowledge. 2 = Theoretical understanding. 3 = Practical capability. 4 = Expert / Trainer. Do not invent other numbers in conversation — the matrix will not match them.',
  },
  {
    title: 'How a cell is classified',
    body: [
      'Numeric: compare actual minus required. Missing actual or two or more levels below = Critical. One below = Minor. Equal = Meets. Above = Exceeds.',
      'Certification required but not held = Critical. Held = Meets. Extra skills (tracked but not required) stay Extra, never mixed into role gaps.',
    ],
  },
]

const process = [
  {
    title: '1. Set up the catalogue (admins)',
    body: 'Create skill groups, then skills, then job roles, then role skill requirements. Add training packs where operators should self-serve Level 1 → 2.',
  },
  {
    title: '2. Add people',
    body: 'Create or tidy people, assign a team, assign one or more job roles, and link logins. Role requirements then appear automatically on Matrix and My skills.',
  },
  {
    title: '3. Record actual levels',
    body: 'Assessors and admins set actuals in Matrix or My skills. Extra skills can be added so specialists stay visible even when the current role does not require that skill.',
  },
  {
    title: '4. Train and sign off',
    body: 'Operators take Level 1 → 2 when a pack and quiz exist and actual is still 1. A submitted quiz always stores an attempt; a pass only moves 1 → 2 if the saved level is still 1. Practical and certification steps use assessor checklists.',
  },
  {
    title: '5. Manage targets and report',
    body: 'Use Dashboard for overdue and near-term dates. Use Report for passed training and promotions. Review colours weekly: critical first, then minor, then extras you still want to grow.',
  },
]

const colours = [
  { label: 'Critical gap', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'Well below the required level, or required certification not held. Treat first.' },
  { label: 'Minor gap', tone: 'bg-amber-100 text-amber-950 border-amber-200', meaning: 'One numeric level below the requirement. Close it on a plan, with a target if you use dates.' },
  { label: 'Meets', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'Actual matches the required level (or certification is held).' },
  { label: 'Exceeds', tone: 'bg-teal-100 text-teal-950 border-teal-200', meaning: 'Actual is above what the current roles require.' },
  { label: 'Extra skill', tone: 'bg-sky-100 text-sky-950 border-sky-200', meaning: 'Tracked for the person but not required by their current roles.' },
  { label: 'N/A', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', meaning: 'No requirement and no recorded actual to compare.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Skill Matrix people are the same shared people records used across the platform. Super admins maintain the Site → Plant → Cell → Area → Equipment tree; Skill Matrix itself is not scoped to that tree. Name teams and roles in a way that matches how cells work so other apps stay readable.',
  },
  {
    title: 'Login accounts',
    body: 'Login role (operator / assessor / admin / super admin) and the Skill Matrix hub tile are set in Login accounts. A person record with no linked login can still appear on Matrix; they just cannot sign in to see My skills.',
  },
  {
    title: 'Plan 24 / RTT / DDS',
    body: 'Job roles in Skill Matrix are the capability catalogue. Plan 24 uses its own roster roles for the day grid (often similar names: Team lead, Packing 1). People selected on those grids come from the shared people list, not a separate “RTT only” database.',
  },
  {
    title: 'LDR tools',
    body: 'LDR maintains its own leadership people overlay (status, avatars) on top of shared people. Completing an LDR check does not change Skill Matrix scores.',
  },
]

const access = [
  {
    title: 'Operator',
    body: [
      'Needs the Skill Matrix hub tile. Opens My skills only (Matrix, Dashboard, and Report redirect here).',
      'Read-only scores. Can take Level 1 → 2 training for their linked person when actual is 1 and a pack plus quiz exist.',
      'This User Guide is available to everyone with Skill Matrix access.',
    ],
  },
  {
    title: 'Assessor',
    body: [
      'Matrix, Dashboard, Report, and My skills for any person. Edit actual levels, extras, and target dates.',
      'Run assessor checklists including Level 2 → 3 and certifications. Cannot open catalog Admin.',
    ],
  },
  {
    title: 'Admin',
    body: 'Everything an assessor can do, plus Admin setup (groups, skills, roles, requirements, plans, training, assessment, teams, people). Can set login roles on Login accounts, but cannot grant hub tiles or mint super admin.',
  },
  {
    title: 'Super admin',
    body: 'Full Skill Matrix plus Master data and hub section flags. Use Login accounts → Section access to give someone the Skill Matrix tile.',
  },
]

export function UserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="Skill Matrix — User Guide"
        subtitle="How capability tracking works: people, job roles, skills, gaps, training, and who can change what."
        iconClass="bg-accent-dim text-accent"
      />

      <UserGuideSection title="Why this app exists" Icon={Compass} lead="Start here if you are new.">
        <GuideParagraphs text={why} />
      </UserGuideSection>

      <UserGuideSection title="Design principles" Icon={Sparkles}>
        <GuideBlockList blocks={principles} />
      </UserGuideSection>

      <UserGuideSection title="Value it adds">
        <GuideValueList items={value} />
      </UserGuideSection>

      <UserGuideSection
        title="Functionality"
        Icon={Layers3}
        lead="What each screen is for, and what you actually do there."
      >
        <GuideBlockList blocks={functionality} />
      </UserGuideSection>

      <UserGuideSection title="Design" lead="How the product is meant to be read.">
        <GuideBlockList blocks={design} />
      </UserGuideSection>

      <UserGuideSection title="Process" Icon={Workflow}>
        <GuideBlockList blocks={process} />
      </UserGuideSection>

      <UserGuideSection
        title="Colour coding"
        Icon={Palette}
        lead="Scan colour before opening a cell."
      >
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
