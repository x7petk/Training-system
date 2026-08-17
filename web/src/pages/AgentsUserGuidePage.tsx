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
  'Agents is the workspace for AI-assisted specialist tools: an Apps Team that can take a request from idea to deploy, plus builders for road maps, KPI trees, and standard work. It exists so improvement and digital work have a board, not a pile of chats.',
  'Several tools in the left nav are shells ready for a workflow (they say so on the page). Use the live tools below as the source of truth for what you can do today.',
]

const principles = [
  {
    title: 'One hub tile, many tools',
    body: 'Access is the Agents section flag. There is no extra “agent role”. Anyone with the tile can use the live boards.',
  },
  {
    title: 'Not site-scoped',
    body: 'There is no Site / Plant / Cell bar here. Work is per login. Do not expect Master data cells to filter Apps Team tickets.',
  },
  {
    title: 'Human stays the customer',
    body: 'On Apps Team you are the customer. Agents (PM, designer, developer, tester, DevOps) move the ticket. Answer clarify questions or the board waits.',
  },
]

const value = [
  'Apps Team turns a request into a visible kanban with design brief, build, test, and deploy artefacts.',
  'Road Map Builder drafts Now / Next / Later, quarterly, or Gantt views you can save and export.',
  'KPI Cascade and Forum Cascade make trees you can govern instead of slides that drift.',
  'Standard Work Process links roles and systems to how work should run, using the same cascade language.',
]

const functionality = [
  {
    title: 'Apps Team (live)',
    body: [
      'Chat with the product-manager agent to draft a ticket (title, value, requirements, acceptance). Confirming creates a board card.',
      'Columns: Intake → Design → Build → Test → Deploy → Done, plus Blocked. Some internal statuses (PM review, clarify) map onto Design or Build so the board stays short.',
      'Open a ticket drawer for brief, logs, PR/deploy links, and conversation. Advance and cloud-sync run in the background while a build is in flight. Delete only if you meant to discard that ticket.',
    ],
  },
  {
    title: 'Road Map Builder (live)',
    body: 'Enter goals, constraints, and timeframe. Generate a visual (quarterly, now/next/later, or Gantt). Save maps, switch between them, and export PNG or PDF. This is a planning aid — it does not change Plan 24 schedules.',
  },
  {
    title: 'KPI Cascade (live)',
    body: 'Admin tab holds catalogues. KPI Cascade and Forum Cascade tabs are the builders: decompose measures into trees. Save is to the signed-in workspace. Reset-to-seed is destructive — only use it if you intend to wipe the tree.',
  },
  {
    title: 'Standard Work Process (live)',
    body: 'Admin configures roles and systems. The Standard Work tab is the process map. It can read KPI Cascade data so measures and standard work stay in the same language.',
  },
  {
    title: 'UX/UI expert (live enough to use)',
    body: 'Specialist critique surface for screens and interaction. Use it when you want structured UX notes, not a kanban.',
  },
  {
    title: 'Placeholder tools',
    body: 'Problem solve advisor, Planner, Q&A, Reliability Engineer, Flex trends, Data Sciencer, Vision Detection, Comms generator, SOP optimiser, Staff Calculator, and KPI consultant are titled shells. They do not run a production workflow yet — do not log plant data there expecting it to save into DDS or RTT.',
  },
]

const design = [
  {
    title: 'Apps Team board',
    body: 'Kanban first, chat second. Column tints are status language. Selected card uses a sky ring. Counts on columns are volume, not priority.',
  },
  {
    title: 'Builders',
    body: 'Road map, KPI, and standard work keep Admin catalogues separate from the canvas so you do not accidentally edit master lists while drawing.',
  },
]

const process = [
  {
    title: '1. Open Agents from App Hub',
    body: 'You land on Apps Team. Other tools are in the left nav.',
  },
  {
    title: '2. For a build request',
    body: 'Describe the outcome in Apps Team chat. Confirm the draft ticket. Watch Design → Build → Test → Deploy. Answer clarify prompts. Use artefacts (PR, deploy URL) when they appear.',
  },
  {
    title: '3. For strategy or KPIs',
    body: 'Use Road Map Builder for time-phased intent. Use KPI Cascade for measure trees. Use Standard Work when you need the process that those KPIs sit on.',
  },
]

const colours = [
  { label: 'Intake', tone: 'bg-slate-100 text-slate-900 border-slate-300', meaning: 'New Apps Team ticket, PM owning the ask.' },
  { label: 'Design / PM review', tone: 'bg-sky-50 text-sky-950 border-sky-300', meaning: 'Designer (and PM review) working the brief.' },
  { label: 'Build / Clarify', tone: 'bg-amber-50 text-amber-950 border-amber-300', meaning: 'Developer building, or waiting on your answer.' },
  { label: 'Test', tone: 'bg-violet-50 text-violet-950 border-violet-300', meaning: 'Tester validating acceptance criteria.' },
  { label: 'Deploy', tone: 'bg-teal-50 text-teal-950 border-teal-300', meaning: 'DevOps shipping.' },
  { label: 'Done', tone: 'bg-emerald-50 text-emerald-950 border-emerald-300', meaning: 'Ticket complete.' },
  { label: 'Blocked', tone: 'bg-rose-50 text-rose-950 border-rose-300', meaning: 'Cannot proceed until a blocker is cleared.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Agents does not read the site tree for scoping. If a road map or KPI names a cell, that is text — keep names matching Master data by convention.',
  },
  {
    title: 'BMS Brain',
    body: 'BMS Brain is the process-system matrix and published flows. Agents Standard Work / KPI Cascade are companion builders. They are not automatically synced.',
  },
  {
    title: 'Problem Solve',
    body: 'Problem solve advisor in Agents is a future helper. Live breakdown records are BDE under Problem Solve.',
  },
]

const access = [
  {
    title: 'Anyone with the Agents tile',
    body: 'Use every Agents screen, including this User Guide. Tickets and saved maps belong to your login.',
  },
  {
    title: 'Admin / super admin',
    body: 'Same operational use. KPI Cascade Admin and Standard Work Admin tabs are on those pages (not a separate footer Admin link). Hub tile is granted by super admin.',
  },
]

export function AgentsUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="Agents — User Guide"
        subtitle="Apps Team, road maps, KPI cascade, standard work, and which tools are live versus placeholders."
        iconClass="bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300"
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

      <UserGuideSection title="Colour coding" Icon={Palette} lead="Apps Team column tints.">
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
