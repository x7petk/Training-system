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
  'BMS Brain is the business-system process matrix: which processes exist, which roles and forums they touch, and how the flow is drawn. It exists so “how we run the business system” is a published picture, not tribal knowledge in a slide deck.',
  'Use Process Matrix to see the landscape, Systems & Tools to edit a flow, AI Insights for assisted reading of the catalogue, and Admin to maintain roles, forums, and systems.',
]

const principles = [
  {
    title: 'Catalogue first, then flows',
    body: 'Roles, forums, and systems in Admin are the building blocks. Processes sit on those blocks. Publishing a process is what makes it appear in the matrix for everyone who can view.',
  },
  {
    title: 'Extra permission layer',
    body: 'Besides the hub tile, BMS Brain uses viewer / editor / admin (bms_brain_role). Platform admin and super admin can still do everything.',
  },
  {
    title: 'No plant scope bar',
    body: 'This is a site-agnostic system map. Naming processes after plants is a content choice, not a filter.',
  },
]

const value = [
  'One matrix of processes vs roles/forums instead of disconnected Visio files.',
  'Standard block types (start, process, decision, review, document, subprocess, end) so readers learn one legend.',
  'Role summaries and Matrix AI views help leaders see load and hand-offs.',
  'Export PNG/PDF for forums that still need a pack, without redrawing.',
]

const functionality = [
  {
    title: 'Process Matrix',
    body: [
      'View modes: Matrix, Role summaries, Matrix AI. Filters (process, role, forum, system) sit in the filter bar; preferences remember zoom and mode per user.',
      'Click a block to focus that step. Zoom with the controls or Ctrl/Cmd + wheel. Export the current view when you need a snapshot.',
    ],
  },
  {
    title: 'Systems & Tools',
    body: 'List of processes. Open one to edit the flow: add nodes, connect them, assign role/forum/system metadata, save versions. Editors publish when the flow is ready; viewers cannot change it.',
  },
  {
    title: 'AI Insights',
    body: 'Assisted commentary over the catalogue and processes. Treat it as a reader, not as an automatic publisher — nothing should go live in the matrix without an editor checking the flow.',
  },
  {
    title: 'Admin',
    body: 'Roles, Forums, Systems catalogues. These names appear on nodes and filters. Renaming here updates labels; do not delete a record that published processes still rely on without a replacement plan.',
  },
]

const design = [
  {
    title: 'Block shapes (locked legend)',
    body: 'Start/End are ovals. Decision is a diamond. Process, review, document, and subprocess are rectangles. Colour follows kind (start green, decision amber, process sky, review violet, document indigo, subprocess pink, end slate).',
  },
  {
    title: 'Matrix vs editor',
    body: 'Matrix is for reading at scale. Editor is for changing one process. Do not try to redesign the whole BMS on the matrix canvas.',
  },
]

const process = [
  {
    title: '1. Admin fills catalogues',
    body: 'Roles, forums, systems that match how the organisation actually meets and who owns what.',
  },
  {
    title: '2. Editors draft processes',
    body: 'Create a process under Systems & Tools, draw the flow, attach metadata, save versions as you go.',
  },
  {
    title: '3. Publish and read',
    body: 'Published processes appear in Process Matrix. Leaders use filters and role summaries. Export for a forum pack if needed.',
  },
  {
    title: '4. Improve',
    body: 'Use AI Insights to spot gaps, then edit and republish. Keep forum names aligned with DDS/KPI cascade language where those forums are the same meetings.',
  },
]

const colours = [
  { label: 'Start', tone: 'bg-emerald-50 text-emerald-950 border-emerald-300', meaning: 'Entry or trigger. Oval.' },
  { label: 'Process', tone: 'bg-sky-50 text-sky-950 border-sky-300', meaning: 'Work performed by a role. Rectangle.' },
  { label: 'Decision', tone: 'bg-amber-50 text-amber-950 border-amber-400', meaning: 'Branch. Diamond.' },
  { label: 'Review', tone: 'bg-violet-50 text-violet-950 border-violet-300', meaning: 'Sign-off or forum checkpoint.' },
  { label: 'Document', tone: 'bg-indigo-50 text-indigo-950 border-indigo-300', meaning: 'Form, record, or artefact.' },
  { label: 'Subprocess', tone: 'bg-pink-50 text-pink-950 border-pink-300', meaning: 'Nested or linked flow.' },
  { label: 'End', tone: 'bg-slate-50 text-slate-900 border-slate-300', meaning: 'Outcome or hand-off complete. Oval.' },
]

const connections = [
  {
    title: 'Master data',
    body: 'BMS Brain does not bind nodes to cells. If a process is plant-specific, say so in the process name or documentation fields.',
  },
  {
    title: 'Agents',
    body: 'KPI Cascade forums and Standard Work roles are related ideas. They are separate stores — align names on purpose if you want readers to recognise them.',
  },
  {
    title: 'DDS',
    body: 'Forums in BMS Brain often match meeting names (Shift DDS, WDS). DDS still holds the live KPIs; BMS Brain holds how the management system is supposed to run.',
  },
]

const access = [
  {
    title: 'Viewer (bms_brain_role)',
    body: 'Open Process Matrix, Systems & Tools (read), AI Insights, and this User Guide. Cannot edit flows or Admin catalogues.',
  },
  {
    title: 'Editor',
    body: 'View plus edit/publish processes. No Admin catalogue unless also platform admin.',
  },
  {
    title: 'BMS admin / platform admin / super admin',
    body: 'Full catalogue and processes. Hub tile: super admin grants BMS Brain; platform admins also see the tile. Footer Admin shows for platform admins.',
  },
]

export function BmsBrainUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="BMS Brain — User Guide"
        subtitle="Process matrix, flow editor, catalogues, and the extra viewer / editor / admin layer."
        iconClass="bg-indigo-500/15 text-indigo-800 dark:text-indigo-300"
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

      <UserGuideSection title="Colour coding" Icon={Palette} lead="Flow block legend as used on the matrix and editor.">
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
