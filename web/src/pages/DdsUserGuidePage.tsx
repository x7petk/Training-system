import { BookOpen, Compass, Layers3, Link2, Palette, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import { DdsProcessGuidelines } from '../features/dds/DdsProcessGuidelines'
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
  'Daily Direction Setting (DDS) aligns the site on safety, quality, delivery, and cost for this shift and the days ahead. Meetings cascade from the shift outward — Shift → Line → Plant → Site — so a problem raised at the gemba can be seen at the right level the same day.',
  'The line is where customer value is added. Leadership enables the line; it does not replace Plan 24 execution. This app is the cascade, the P2P audits, triggers, weekly direction, e-plan, and PDCA that sit around that day plan.',
]

const principles = [
  {
    title: 'Configure down, execute up',
    body: 'Admin defines KPI groups, KPIs, P2P standards, triggers, recognition, losses, and WDS measures per cell. Shift DDS and Plan 24 create the facts. Higher meetings roll those facts up.',
  },
  {
    title: 'Same cell context',
    body: 'The scope bar (cell, date, shift) is shared with Plan 24. If you are in the wrong cell, every meeting, P2P, and action list will look wrong. Pick the cell first.',
  },
  {
    title: 'Servant leadership',
    body: 'Value is created at team-member level. Team leaders and plant leaders enable people through standards and support systems — they do not do the operators’ work in this app.',
  },
  {
    title: 'Planned work and troubleshooting both feed DDS',
    body: 'Plan 24 and in-process checks are the planned loop. Deviations, defects, quality fails, BDE, and PDCA are the troubleshooting loop. Both should show up in the meeting, not only KPIs.',
  },
]

const value = [
  'One cascade instead of four disconnected meeting packs.',
  'P2P connects roster roles to standard questions so “people and process” is auditable.',
  'Triggers and compliance views show pass/fail before the room debates anecdotes.',
  'DDS actions and e-plan give two horizons: this week’s follow-ups vs longer improvement actions.',
  'Shift DDS can keep Plan 24 and P2P on the same screen so the meeting stays on the gemba picture.',
]

const functionality = [
  {
    title: 'Plan 24',
    body: 'The same cell day/shift grid as RTT systems. Use it here so the meeting does not bounce apps. Completing checks and raising issues still write to Plan 24 and the RTT boards.',
  },
  {
    title: 'DDS actions',
    body: 'Named follow-ups with owners, times, and surfaces (which screens should show them). List and timeline views. Shared with RTT and Problem Solve.',
  },
  {
    title: 'P2P and P2P Summary',
    body: [
      'People-to-process audits against the P2P standard and soft points configured in Admin for the cell.',
      'P2P Summary is the roll-up table used in Shift DDS and line conversations. Scores support the cascade; they do not replace walking the line.',
    ],
  },
  {
    title: 'Triggers',
    body: 'Scorecards (typically safety/quality style) for the scoped cell. Admin maintains trigger definitions. The Triggers screen and Shift DDS tiles consume the same setup.',
  },
  {
    title: 'Shift DDS',
    body: [
      'The shift meeting shell: KPIs, trigger tiles, reward and recognition, top losses (as configured), plus a right-hand panel that switches between P2P Summary and an embedded Plan 24.',
      'Enter values for the scoped cell, date, and shift. This is the base layer Line DDS aggregates.',
    ],
  },
  {
    title: 'Line / Plant / Site DDS and compliance',
    body: [
      'Line DDS aggregates cell/shift performance for the line (cells grouped via Admin → Cell lines). Plant and Site DDS continue that roll-up.',
      'Line compliance and Site compliance are pass/fail views where configured — use them to see who is off-standard, then open the matching DDS screen for context.',
    ],
  },
  {
    title: 'WDS',
    body: 'Weekly Direction Setting: KPI columns versus targets for a longer lens than a single shift. Admin → WDS KPIs decides which measures appear.',
  },
  {
    title: 'e-plan',
    body: [
      'One-page improvement actions for the selected cell: status cards, filters, table, and Gantt-style timeline. Create/edit in the modal. Admin → e-Plan setup holds pillars, forums, labels, loss types, and owners.',
      'Important: e-plan currently stores in this browser (localStorage). It is not shared across devices or logins, and it is not linked to Plan 24 events yet. Do not treat it as the system of record for audits.',
    ],
  },
  {
    title: 'PDCA',
    body: 'Problem-solving boards at site or cell depending on how you enter. Use it for structured Plan-Do-Check-Act items that sitting on DDS actions would overcrowd.',
  },
  {
    title: 'Admin (admin / super admin)',
    body: [
      'KPI groups, KPIs, KPI set-up per cell, cell lines (which cells form a line), P2P standard, P2P soft points, P2P set-up, triggers, reward & recognition, top losses, e-Plan setup, WDS KPIs.',
      'Admin configures meetings; it does not replace Shift DDS or Plan 24.',
    ],
  },
]

const design = [
  {
    title: 'Navigation',
    body: 'Left nav is the cascade in rough time order: day plan and actions first, P2P and triggers, then Shift → Line → Plant → Site, then weekly/longer tools. User Guide sits in the footer; Admin expands extra links for admins.',
  },
  {
    title: 'Shift DDS layout',
    body: 'Compact meeting chrome: header stays thin, Plan 24 or P2P sits beside KPI work so the room can toggle without losing cell context.',
  },
]

const process = [
  {
    title: '1. Admin prepares the cell',
    body: 'KPI groups/KPIs, KPI set-up, cell lines, P2P, triggers, recognition, losses, WDS. Without this, Shift DDS is an empty shell.',
  },
  {
    title: '2. Run the day on Plan 24',
    body: 'Complete checks, raise deviations/defects/quality fails, add DDS actions as work appears.',
  },
  {
    title: '3. Hold Shift DDS',
    body: 'Enter KPIs, review triggers, P2P, recognition, losses, and the day grid. Agree actions before the next meeting consumes them.',
  },
  {
    title: '4. Cascade up',
    body: 'Line, Plant, and Site meetings read roll-ups. Compliance screens flag misses. Do not re-type cell facts at site if Shift DDS was done.',
  },
  {
    title: '5. Weekly and improvement',
    body: 'WDS for the week. e-plan for longer actions (remember local-only storage). PDCA when the problem needs a structured loop.',
  },
]

const colours = [
  { label: 'On standard / healthy', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'Used across Plan 24 completion, e-plan On Track (blue in some e-plan cards), and compliance pass. Prefer the label on the card if two palettes meet.' },
  { label: 'e-plan On Track', tone: 'bg-sky-100 text-sky-950 border-sky-200', meaning: 'Improvement action progressing as planned.' },
  { label: 'e-plan Need Help', tone: 'bg-amber-100 text-amber-950 border-amber-200', meaning: 'Action needs support — raise it in the meeting, not only the Gantt.' },
  { label: 'e-plan Off Track', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'Action is off plan. Reset owner, date, or scope.' },
  { label: 'Compliance fail / trigger concern', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'Pass/fail compliance views and trigger scorecards use red for miss or high concern.' },
  { label: 'Plan 24 families', tone: 'bg-green-700 text-green-50 border-green-900/40', meaning: 'Same as RTT: CL green, CIL teal, Quality purple, general checks dark blue — because this Plan 24 is the same grid.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'Every scoped screen needs Site → Plant → Cell. Cell lines in Admin group cells for Line DDS. Area/equipment on Plan 24 issues still come from Master data.',
  },
  {
    title: 'RTT systems',
    body: 'Plan 24, DDS actions, and fail boards are shared. Completing a CL check here still raises a Deviation on the RTT board.',
  },
  {
    title: 'Problem Solve',
    body: 'BDE (breakdown elimination) lives under Problem Solve but uses the same scope bar. Reference BDE from DDS when downtime is the story; do not duplicate the breakdown in e-plan unless you accept two lists.',
  },
  {
    title: 'Skill Matrix / people',
    body: 'P2P roles and action owners draw from people and Plan 24 roster roles, not from Skill Matrix login roles. Linking logins still happens in Skill Matrix Admin or Master data People.',
  },
]

const access = [
  {
    title: 'Anyone with the DDS tile',
    body: 'Use Plan 24, meetings, P2P, triggers, WDS, e-plan, PDCA, actions, and this User Guide. Enter KPIs and complete meeting content for the selected cell.',
  },
  {
    title: 'Admin / super admin',
    body: 'All of the above plus DDS Admin catalogues listed above. e-Plan setup lists are admin; creating e-plan actions is open to DDS users (still local to the browser).',
  },
  {
    title: 'Hub tile',
    body: 'Super admin grants DDS Process on Login accounts → Section access.',
  },
]

export function DdsUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="DDS Process — User Guide"
        subtitle="How Daily Direction Setting works: cascade, Plan 24, P2P, triggers, WDS, e-plan, and PDCA."
        Icon={BookOpen}
        iconClass="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
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

      <UserGuideSection title="Functionality" Icon={Layers3} lead="Match the left navigation.">
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

      <DdsProcessGuidelines defaultOpenAll standalone />
    </div>
  )
}
