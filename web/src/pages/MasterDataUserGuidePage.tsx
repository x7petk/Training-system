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
  'Master data is the shared geography and people backbone for the whole platform. Every scope bar — LDR, Plan 24, DDS, BDE — reads sites, plants, cells, areas, and equipment from here. People created here are the same people Skill Matrix, LDR, and Plan 24 assign work to.',
  'Only super admins can open this app. Everyone else consumes the tree by selecting it. If Master data is wrong, other apps look empty or point at the wrong cell.',
]

const principles = [
  {
    title: 'One tree',
    body: 'Site → Plant → Cell → Area → Equipment. Do not invent a parallel “RTT site” or “DDS plant”. Other apps have no extra enabled flag — a cell that exists can be selected.',
  },
  {
    title: 'Rename, don’t duplicate',
    body: 'Changing a name updates every selector that uses the ID. Creating a second cell because the name drifted splits history (Plan 24, BDE, issues) across two IDs.',
  },
  {
    title: 'People are shared',
    body: 'A person row is not “Skill Matrix only”. Link a login so operators can open My skills and so action owners match a sign-in.',
  },
]

const value = [
  'Scope bars stay consistent across LDR, RTT, DDS, and Problem Solve.',
  'Area and equipment on checks, defects, and BDE come from the same lists.',
  'People, teams, and login links are maintained in one place instead of per app.',
  'Sort order lets you present the plant the way the floor talks about it, not alphabetically by accident.',
]

const functionality = [
  {
    title: 'Structure',
    body: [
      'Tree of sites, plants, cells, areas, and equipment. Expand a node to work on children. Add with Plus, rename inline, delete with care — child records and history in other apps may depend on the ID.',
      'Each level has a colour badge (site teal, plant violet, cell sky, area amber, equipment slate) so you always know which layer you are editing.',
      'Sort order is stored per level. Keep production lines in walk-the-floor order so Plan 24 and DDS selectors match how coordinators think.',
    ],
  },
  {
    title: 'People',
    body: [
      'Shared roster: first name, last name, display name, email, phone, team, optional login account.',
      'Teams listed here are the same teams Skill Matrix uses. Linking a login attaches that person’s Skill Matrix My skills and identifies them in other apps.',
      'Creating people here is equivalent in data to Skill Matrix Admin → People. Prefer one habit so duplicates are not created under slightly different names.',
    ],
  },
]

const design = [
  {
    title: 'Why a separate app',
    body: 'Operational users should not edit the tree by accident. Super-admin-only keeps Plan 24 and DDS from gaining “shadow sites”.',
  },
  {
    title: 'Badges',
    body: 'Level colour is the only decoration. It is encoding: teal is never equipment. Match the badge when someone asks “is this a cell or an area?”',
  },
]

const process = [
  {
    title: '1. Build geography first',
    body: 'Site, then plants, then cells. Areas and equipment under cells before you expect CIL/CL location pickers or BDE equipment trends to work.',
  },
  {
    title: '2. Add people and link logins',
    body: 'After Login accounts exist, link them here (or in Skill Matrix People). Then grant hub tiles in Login accounts → Section access.',
  },
  {
    title: '3. Tell app admins the names',
    body: 'RTT Admin rosters, LDR workspaces, DDS cell lines, and BDE catalogues all assume these names. Changing a live cell name is possible; communicate it.',
  },
  {
    title: '4. Delete last',
    body: 'Retire by renaming or stopping use. Delete only when you accept that historical rows may lose a friendly label.',
  },
]

const colours = [
  { label: 'Site', tone: 'bg-teal-100 text-teal-950 border-teal-800/15', meaning: 'Top of the tree. LDR can also have a site workspace.' },
  { label: 'Plant', tone: 'bg-violet-100 text-violet-950 border-violet-800/15', meaning: 'Sits under a site. Needed before a cell exists.' },
  { label: 'Cell', tone: 'bg-sky-100 text-sky-950 border-sky-800/15', meaning: 'Required for Plan 24, DDS meetings, BDE, HC, and issue boards.' },
  { label: 'Area', tone: 'bg-amber-100 text-amber-950 border-amber-800/20', meaning: 'Location under a cell for checks and issues.' },
  { label: 'Equipment', tone: 'bg-slate-200 text-slate-950 border-slate-500/25', meaning: 'Asset under an area. Used on CIL, defects, BDE.' },
]

const connections = [
  {
    title: 'LDR tools',
    body: 'Site vs cell workspaces resolve using these IDs. HC/observations always store a cell.',
  },
  {
    title: 'RTT / DDS / Problem Solve',
    body: 'Plan 24, boards, meetings, and BDE will not load usefully until a cell is selected from this tree.',
  },
  {
    title: 'Skill Matrix',
    body: 'People and teams are shared. Skill Matrix is not filtered by cell. Job roles stay in Skill Matrix Admin, not here.',
  },
  {
    title: 'Login accounts',
    body: 'Logins live under Login accounts. Link them to people here. Super admin also grants which hub tiles each login can see.',
  },
]

const access = [
  {
    title: 'Super admin',
    body: 'Only role that can open Master data, create/rename/delete structure, and maintain shared people from this app.',
  },
  {
    title: 'Everyone else',
    body: 'Cannot open this app. They still read sites/plants/cells in scope bars if they have LDR, RTT, DDS, or Problem Solve.',
  },
]

export function MasterDataUserGuidePage() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
      <UserGuideHeader
        title="Master data — User Guide"
        subtitle="Sites, plants, cells, areas, equipment, and shared people — the backbone every other app selects from."
        iconClass="bg-teal-500/15 text-teal-800 dark:text-teal-300"
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

      <UserGuideSection title="Colour coding" Icon={Palette} lead="Structure tree badges.">
        <GuideColourGrid items={colours} />
      </UserGuideSection>

      <UserGuideSection title="Connections to other apps" Icon={Link2}>
        <GuideBlockList blocks={connections} />
      </UserGuideSection>

      <UserGuideSection title="Access — who can do what" Icon={ShieldCheck}>
        <GuideAccessList items={access} />
      </UserGuideSection>
    </div>
  )
}
