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
  'Login accounts is where you decide who someone is in the platform (operator, assessor, admin) and — if you are super admin — which App Hub tiles they can open. It does not replace Skill Matrix people or Master data. A login without a person link still cannot see My skills; a person without a login cannot sign in.',
]

const principles = [
  {
    title: 'Two independent switches',
    body: 'Login role = what they can administer and whether Skill Matrix is read-only. Section flags = which hub tiles they even see. An operator with RTT access can run Plan 24. An assessor with no tiles sees an empty hub.',
  },
  {
    title: 'Least privilege at signup',
    body: 'New registrations land as operator with every hub tile off. Someone with super admin access must grant tiles. Passwords are never stored in the browser’s localStorage.',
  },
  {
    title: 'Job titles are not logins',
    body: 'Packing 1 or Team lead are Skill Matrix job roles. They do not grant hub access. Do not try to map them here.',
  },
]

const value = [
  'One login for every app — no second password per module.',
  'Skill Matrix operators cannot browse other people’s scores; other apps stay usable for the floor once the tile is on.',
  'Only super admin can mint super admins or turn hub tiles on, which keeps sprawl in check.',
]

const functionality = [
  {
    title: 'Login accounts tab',
    body: [
      'List of profiles: display name and current login role.',
      'Admins can set Operator, Assessor, or Admin. They cannot assign Super admin and cannot change section flags.',
      'Operator (labelled read-only here) applies to Skill Matrix only. It does not freeze Plan 24, LDR, or DDS if those tiles are granted.',
      'Assessor can edit Skill Matrix scores. Admin gets catalog Admin screens in each granted app plus this page.',
    ],
  },
  {
    title: 'Section access tab (super admin)',
    body: [
      'Hub tiles: Skill Matrix, LDR tools, RTT systems, Agents, DDS Process, Problem Solve, BMS Brain.',
      'Master data appears for super admins automatically. Login accounts appears for admins automatically. Those are not section flags.',
      'Turn tiles on only for people who need that work. An empty hub shows a contact-an-admin message.',
    ],
  },
]

const design = [
  {
    title: 'Why it sits outside Skill Matrix Admin',
    body: 'Access is platform-wide. Keeping it on the hub avoids implying that only Skill Matrix admins can grant RTT or DDS.',
  },
  {
    title: 'Role badges',
    body: 'Super admin uses a stronger violet badge. Admin uses accent. Assessor uses sky. Operator is mute zinc — that is visual hierarchy, not RAG.',
  },
]

const process = [
  {
    title: '1. Person exists',
    body: 'Create the person in Master data or Skill Matrix Admin, with a unique name.',
  },
  {
    title: '2. They register (or you create the auth user)',
    body: 'They appear on this list as operator with no tiles.',
  },
  {
    title: '3. Set login role',
    body: 'Operator for My-skills-only users. Assessor for people who score others. Admin for catalogue maintainers. Super admin only from a super admin, and rarely.',
  },
  {
    title: '4. Super admin grants tiles',
    body: 'Section access tab. Then link the login to the person record so My skills and owners resolve.',
  },
]

const colours = [
  { label: 'Super admin', tone: 'bg-violet-500/12 text-fg border-border-strong', meaning: 'Hub flags, Master data, type catalogues, can assign super admin.' },
  { label: 'Admin', tone: 'bg-accent-dim text-accent border-accent/25', meaning: 'Catalogue Admin in granted apps; Login accounts roles except super admin / flags.' },
  { label: 'Assessor', tone: 'bg-sky-100 text-sky-900 border-sky-200', meaning: 'Edit Skill Matrix scores. Floor user on other granted apps.' },
  { label: 'Operator', tone: 'bg-zinc-100 text-muted border-zinc-200', meaning: 'Skill Matrix My skills read-only. Full floor use of other granted apps.' },
]

const connections = [
  {
    title: 'Master data People',
    body: 'Link user_id on the person row after the login exists. Unlinked logins still consume a licence of attention — they can open tiles but Skill Matrix will not know who they are.',
  },
  {
    title: 'Skill Matrix',
    body: 'Role here drives Matrix vs My skills. The Skill Matrix hub tile is a section flag, not implied by assessor.',
  },
  {
    title: 'BMS Brain',
    body: 'Needs the hub tile plus bms_brain_role (viewer / editor / admin) maintained in BMS Brain Admin. Platform admin overrides that extra layer.',
  },
]

const access = [
  {
    title: 'Admin',
    body: 'Open this page. Change operator / assessor / admin on profiles. Cannot open Section access, cannot set super admin, cannot grant tiles.',
  },
  {
    title: 'Super admin',
    body: 'All of the above, Section access flags, assign or demote super admin (within database rules). Own Master data exclusively.',
  },
  {
    title: 'Assessor / operator',
    body: 'Cannot open Login accounts. Ask an admin if a tile is missing.',
  },
]

export function LoginAccountsUserGuide() {
  return (
    <div className="space-y-6">
      <UserGuideHeader
        title="Login accounts — User Guide"
        subtitle="Login roles versus hub tiles, and how they connect to people in Master data and Skill Matrix."
        iconClass="bg-amber-500/15 text-amber-900 dark:text-amber-200"
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

      <UserGuideSection title="Colour coding" Icon={Palette} lead="Role badges on the accounts list.">
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
