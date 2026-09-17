import type {
  ChecklistItem,
  CloseLoopStep,
  EvidenceItem,
  ExpertFeedback,
  LossTypeDef,
  MockAsset,
  MockDefect,
  SixW2H,
} from './types'

export const LOSS_TYPES: LossTypeDef[] = [
  {
    id: 'equipment_material',
    label: 'Equipment / Material Operational Loss',
    shortLabel: 'Equipment / Material',
    description: 'Minor stops, chronic loss, or condition issues on equipment or material.',
    color: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    initialMethod: 'IPS',
    advancedMethod: 'UPS',
    examples: ['Seal scrap rising', 'Chronic jam on infeed', 'Centerline drift'],
  },
  {
    id: 'process_system',
    label: 'Process / System Loss',
    shortLabel: 'Process / System',
    description: 'Waste, delay, imbalance, or work sequence issues in the process.',
    color: 'text-sky-800',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    initialMethod: 'IPS',
    advancedMethod: 'WPI',
    examples: ['Changeover overtime', 'Waiting for materials', 'Imbalanced stations'],
  },
  {
    id: 'quality_internal',
    label: 'Quality-Type Loss (Internal)',
    shortLabel: 'Quality Internal',
    description: 'Rework, waste, or downgrades found on site before shipment.',
    color: 'text-violet-800',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    initialMethod: 'IPS',
    advancedMethod: 'UPS',
    examples: ['Fill weight out of spec', 'Label defects', 'Downgrade lot'],
  },
  {
    id: 'quality_complaint',
    label: 'Complaint Quality Loss (Customer)',
    shortLabel: 'Customer Complaint',
    description: 'External complaint requiring root cause and recurrence prevention.',
    color: 'text-cyan-800',
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
    initialMethod: 'IPS',
    advancedMethod: 'UPS',
    examples: ['Foreign material complaint', 'Leak in market', 'Wrong pack claim'],
  },
  {
    id: 'breakdown',
    label: 'Breakdown (Equipment Failure)',
    shortLabel: 'Breakdown',
    description: 'Physical equipment failure causing a production stop.',
    color: 'text-orange-900',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    initialMethod: 'BDE_BREAKDOWN',
    advancedMethod: 'IDA',
    examples: ['Motor seized', 'Bearing failure', 'Shaft broken'],
  },
  {
    id: 'process_failure',
    label: 'Process Failure',
    shortLabel: 'Process Failure',
    description: 'Critical process function failed without a physical breakdown.',
    color: 'text-rose-900',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    initialMethod: 'BDE_PROCESS',
    advancedMethod: 'IDA',
    examples: ['CIP incomplete', 'Sterile barrier breach', 'Control loop failed'],
  },
  {
    id: 'organisational',
    label: 'Organisational Performance Loss',
    shortLabel: 'Organisational',
    description: 'Roles, behaviours, capability, or leadership gaps driving loss.',
    color: 'text-amber-900',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    initialMethod: 'OPM',
    advancedMethod: 'OPM_ADVANCED',
    examples: ['Handover gaps', 'Skill mismatch', 'Escalation not followed'],
  },
]

export const MOCK_ASSETS: MockAsset[] = [
  {
    id: 'ast-filler-01',
    name: 'Filler Line 1 — Head 3',
    area: 'Filling',
    cell: 'Cell A',
    type: 'Filler',
    centerline: '120 bpm · seal temp 185°C · vacuum −0.4 bar',
  },
  {
    id: 'ast-packer-02',
    name: 'Case Packer CP-2',
    area: 'Packaging',
    cell: 'Cell A',
    type: 'Case Packer',
    centerline: '18 cpm · glue pattern B · sensor height 42 mm',
  },
  {
    id: 'ast-conveyor-04',
    name: 'Transfer Conveyor TC-4',
    area: 'Transfer',
    cell: 'Cell B',
    type: 'Conveyor',
    centerline: 'Belt tension green · speed 0.8 m/s',
  },
  {
    id: 'ast-mixer-01',
    name: 'Batch Mixer MX-1',
    area: 'Process',
    cell: 'Cell B',
    type: 'Mixer',
    centerline: 'RPM 42 · temp 68°C · batch 1200 L',
  },
  {
    id: 'ast-labeler-01',
    name: 'Labeler LB-1',
    area: 'Packaging',
    cell: 'Cell A',
    type: 'Labeler',
    centerline: 'Apply pressure mid · web tension OK',
  },
]

export const MOCK_DEFECTS: MockDefect[] = [
  {
    id: 'def-101',
    assetId: 'ast-filler-01',
    title: 'Seal wrinkle — Head 3',
    status: 'open',
    foundOn: '2026-09-15',
    description: 'CIL found recurring seal wrinkle on Head 3; temporary wipe-down in place.',
  },
  {
    id: 'def-102',
    assetId: 'ast-filler-01',
    title: 'Vacuum gauge drift',
    status: 'closed',
    foundOn: '2026-09-02',
    description: 'Gauge recalibrated; closed after verification run.',
  },
  {
    id: 'def-201',
    assetId: 'ast-packer-02',
    title: 'Glue nozzle partial block',
    status: 'open',
    foundOn: '2026-09-16',
    description: 'Intermittent glue skip on flap B; nozzle clean pending parts.',
  },
  {
    id: 'def-301',
    assetId: 'ast-conveyor-04',
    title: 'Belt tracking left',
    status: 'open',
    foundOn: '2026-09-14',
    description: 'Belt walks left under load; tracker adjustment overdue.',
  },
  {
    id: 'def-401',
    assetId: 'ast-labeler-01',
    title: 'Label skew >2 mm',
    status: 'open',
    foundOn: '2026-09-17',
    description: 'Skew on SKU-A only; applicator roller wear suspected.',
  },
]

export const METHOD_LABELS: Record<string, string> = {
  IPS: 'IPS — Initial Problem Solve',
  BDE_BREAKDOWN: 'BDE — Breakdown Elimination',
  BDE_PROCESS: 'BDE — Process Failure',
  OPM: 'OPM — Organisational Performance',
  UPS: 'UPS — Unified Problem Solving',
  WPI: 'WPI — Work Process Improvement',
  IDA: 'IDA — Incident Determination Analysis',
  OPM_ADVANCED: 'OPM Advanced',
}

export function emptySixW2H(): SixW2H {
  return {
    what: '',
    where: '',
    when: '',
    who: '',
    which: '',
    why: '',
    how: '',
    howMuch: '',
  }
}

export function defaultChecklist(method: string): ChecklistItem[] {
  const common: ChecklistItem[] = [
    {
      id: 'cl-safe',
      label: 'Stop, make safe, protect quality',
      hint: 'Confirm area is safe and product is protected before investigation.',
      status: 'pending',
      note: '',
    },
    {
      id: 'cl-basic',
      label: 'Check basic conditions',
      hint: 'Lubrication, cleanliness, fastening, alignment, temperature, utilities.',
      status: 'pending',
      note: '',
    },
    {
      id: 'cl-standard',
      label: 'Compare with standard / centerline',
      hint: 'What should it look like vs what do you see?',
      status: 'pending',
      note: '',
    },
    {
      id: 'cl-deviation',
      label: 'Identify the deviation',
      hint: 'Name the gap between standard and current condition.',
      status: 'pending',
      note: '',
    },
    {
      id: 'cl-immediate',
      label: 'Take immediate actions',
      hint: 'Containment, temporary fix, quality hold if needed.',
      status: 'pending',
      note: '',
    },
    {
      id: 'cl-restore',
      label: 'Restore base condition',
      hint: 'Return equipment/process to known good state where possible.',
      status: 'pending',
      note: '',
    },
  ]

  if (method.startsWith('BDE')) {
    common.push({
      id: 'cl-aodc',
      label: 'Capture AODC / failure mode facts',
      hint: 'Activity, Object, Damage, Cause — even if provisional.',
      status: 'pending',
      note: '',
    })
  }
  if (method === 'OPM') {
    common.push({
      id: 'cl-role',
      label: 'Confirm role / standard work expectation',
      hint: 'Who should do what, and is the standard clear?',
      status: 'pending',
      note: '',
    })
  }
  return common
}

export function defaultCloseSteps(): CloseLoopStep[] {
  return [
    { id: 'c1', label: 'Confirm effectiveness', done: false, note: '' },
    { id: 'c2', label: 'Restore / define base condition', done: false, note: '' },
    { id: 'c3', label: 'Update standards & systems', done: false, note: '' },
    { id: 'c4', label: 'Complete sustainable actions', done: false, note: '' },
    { id: 'c5', label: 'Train affected people', done: false, note: '' },
    { id: 'c6', label: 'Share learning via DDS / WDS', done: false, note: '' },
    { id: 'c7', label: 'Record verified problem, cause, solution', done: false, note: '' },
    { id: 'c8', label: 'Monitor for recurrence', done: false, note: '' },
  ]
}

export function mockEvidenceForAsset(assetId: string | null, problemText: string): EvidenceItem[] {
  const now = new Date()
  const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString()
  const asset = MOCK_ASSETS.find((a) => a.id === assetId)
  const defects = MOCK_DEFECTS.filter((d) => !assetId || d.assetId === assetId)

  const items: EvidenceItem[] = [
    {
      id: 'ev-alarm',
      source: 'Alarms & events',
      title: asset ? `${asset.name} — intermittent fault` : 'Line alarm cluster',
      detail: '3× fault code F-214 in last 4 hours (seal / vacuum related).',
      severity: 'warn',
      timestamp: iso(45),
    },
    {
      id: 'ev-hist',
      source: 'Process & historian',
      title: 'Seal temperature deviation',
      detail: asset
        ? `Head seal temp spiked +12°C vs centerline (${asset.centerline.split('·')[1]?.trim() ?? 'standard'}).`
        : 'Temperature excursion vs centerline on filler heads.',
      severity: 'critical',
      timestamp: iso(90),
    },
    {
      id: 'ev-quality',
      source: 'Quality / Lab',
      title: 'In-process check fail',
      detail: '2 of last 8 seal integrity checks failed on current SKU.',
      severity: 'critical',
      timestamp: iso(120),
    },
    {
      id: 'ev-cmms',
      source: 'Maintenance (CMMS)',
      title: 'Open work order',
      detail: defects[0]
        ? `Linked defect: ${defects[0].title} (${defects[0].status})`
        : 'No open WO linked — create if parts/tools needed.',
      severity: defects.some((d) => d.status === 'open') ? 'warn' : 'info',
      timestamp: iso(200),
    },
    {
      id: 'ev-mes',
      source: 'Production / MES',
      title: 'OEE loss spike',
      detail: 'Performance loss +4.2 pts vs shift target in last 2 hours.',
      severity: 'warn',
      timestamp: iso(30),
    },
    {
      id: 'ev-std',
      source: 'Standards & centerline',
      title: asset ? `${asset.name} centerline` : 'Centerline reference',
      detail: asset?.centerline ?? 'Select an asset to load centerline.',
      severity: 'info',
      timestamp: iso(0),
    },
    {
      id: 'ev-hist-issue',
      source: 'Previous issues',
      title: 'Similar sealed-loss case (Aug 2026)',
      detail:
        'Verified cause: worn sealing jaw pad. Action: replace pad + add CIL check. Recurrence prevented for 6 weeks.',
      severity: 'info',
      timestamp: iso(60 * 24 * 20),
    },
  ]

  if (/complaint|customer|market/i.test(problemText)) {
    items.unshift({
      id: 'ev-complaint',
      source: 'Customer complaint',
      title: 'Complaint ticket linked',
      detail: 'Mock CMP-4421 — foreign seal appearance reported by retail QC.',
      severity: 'critical',
      timestamp: iso(10),
    })
  }

  return items
}

export function mockExpertsForMethod(method: string, problem: string): ExpertFeedback[] {
  const base: ExpertFeedback[] = [
    {
      expertId: 'reliability',
      name: 'Alex Rivera',
      role: 'Reliability Engineer',
      summary:
        'Treat chronic seal/vacuum drift as a condition issue first. Confirm basic conditions before replacing parts.',
      challenges: [
        'Is the temperature spike a cause or a symptom of seal friction?',
        'Has jaw pad wear been measured against the wear limit?',
      ],
      suggestedTests: ['Measure pad thickness vs standard', 'Trend vacuum during good vs bad packs'],
      involve: ['Operator', 'Maintenance'],
    },
    {
      expertId: 'quality',
      name: 'Priya Shah',
      role: 'Quality Coach',
      summary: 'Protect the product first. Hold suspect packs and verify last good check.',
      challenges: ['Is the hold window clear from last good check?', 'Any risk of shipped product?'],
      suggestedTests: ['Seal integrity sampling plan (n=20)', 'Compare retain samples from last good hour'],
      involve: ['Quality', 'Team Leader'],
    },
  ]

  if (method.startsWith('BDE')) {
    base.push({
      expertId: 'process',
      name: 'Marcus Chen',
      role: 'Process / SME',
      summary: 'Capture failure mode and timeline for BDE. Do not jump to root cause without AODC facts.',
      challenges: ['What changed in the last 24h (parts, settings, SKU, people)?'],
      suggestedTests: ['Reproduce under controlled speed', 'Check last changeover checklist completion'],
      involve: ['Maintenance', 'Reliability Engineer'],
    })
  }

  if (method === 'OPM' || /handover|training|skill|role/i.test(problem)) {
    base.push({
      expertId: 'opm',
      name: 'Jordan Blake',
      role: 'HR / People Leader',
      summary: 'Check if standard work and capability match the task. Organisational gaps often look like equipment loss.',
      challenges: ['Was the operator trained and signed off on this SKU?', 'Was escalation path followed?'],
      suggestedTests: ['Review last 3 handover sheets', 'Observe one full cycle vs SOS'],
      involve: ['Team Leader', 'Trainer'],
    })
  }

  if (method === 'IPS') {
    base.push({
      expertId: 'work_process',
      name: 'Sam Okonkwo',
      role: 'Work Process Coach',
      summary: 'Keep the problem statement narrow. One deviation, one asset, one time window.',
      challenges: ['Are we mixing two losses into one statement?'],
      suggestedTests: ['Time-stamp first symptom vs first stop'],
      involve: ['Operator', 'Team Leader'],
    })
  }

  return base
}

export function lossTypeById(id: string | null | undefined) {
  return LOSS_TYPES.find((t) => t.id === id) ?? null
}
