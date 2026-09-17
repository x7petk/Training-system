/** Loss Elimination Navigator — shared types */

export type LossTypeId =
  | 'equipment_material'
  | 'process_system'
  | 'quality_internal'
  | 'quality_complaint'
  | 'breakdown'
  | 'process_failure'
  | 'organisational'

export type InitialMethod = 'IPS' | 'BDE_BREAKDOWN' | 'BDE_PROCESS' | 'OPM'
export type AdvancedMethod = 'UPS' | 'WPI' | 'IDA' | 'OPM_ADVANCED'

export type NavigatorStage =
  | 'identify'
  | 'initial'
  | 'refocus'
  | 'decision'
  | 'advanced'
  | 'close'

export type SixW2H = {
  what: string
  where: string
  when: string
  who: string
  which: string
  why: string
  how: string
  howMuch: string
}

export type ChecklistItem = {
  id: string
  label: string
  hint?: string
  status: 'pending' | 'ok' | 'fail' | 'na'
  note: string
}

export type AttachmentMeta = {
  id: string
  name: string
  kind: 'image' | 'document' | 'other'
  sizeLabel: string
  previewUrl?: string
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatSuggestedAction = {
  id: string
  label: string
  kind: 'answer' | 'open_form' | 'skip_ai' | 'run_checks' | 'continue'
  payload?: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  suggestedActions?: ChatSuggestedAction[]
}

export type EvidenceItem = {
  id: string
  source: string
  title: string
  detail: string
  severity: 'info' | 'warn' | 'critical'
  timestamp: string
}

export type MockDefect = {
  id: string
  assetId: string
  title: string
  status: 'open' | 'closed'
  foundOn: string
  description: string
}

export type MockAsset = {
  id: string
  name: string
  area: string
  cell: string
  type: string
  centerline: string
}

export type ExpertId = 'reliability' | 'process' | 'quality' | 'work_process' | 'opm' | 'safety'

export type ExpertFeedback = {
  expertId: ExpertId
  name: string
  role: string
  summary: string
  challenges: string[]
  suggestedTests: string[]
  involve: string[]
}

export type ActionItem = {
  id: string
  title: string
  owner: string
  due: string
  status: 'open' | 'in_progress' | 'done'
  type: 'immediate' | 'sustainable' | 'train' | 'standard'
}

export type CloseLoopStep = {
  id: string
  label: string
  done: boolean
  note: string
}

export type LossTypeDef = {
  id: LossTypeId
  label: string
  shortLabel: string
  description: string
  color: string
  bg: string
  border: string
  initialMethod: InitialMethod
  advancedMethod: AdvancedMethod
  examples: string[]
}

export type ProblemCase = {
  problemStatement: string
  assetId: string | null
  assetName: string
  area: string
  lossTypeId: LossTypeId | null
  initialMethod: InitialMethod | null
  advancedMethod: AdvancedMethod | null
  sixW2H: SixW2H
  checklist: ChecklistItem[]
  attachments: AttachmentMeta[]
  evidence: EvidenceItem[]
  refocusStatement: string
  expertFeedback: ExpertFeedback[]
  canResolveInHouse: boolean | null
  actions: ActionItem[]
  closeSteps: CloseLoopStep[]
  learningCaptured: string
}

export type AiNavigateResponse = {
  reply: string
  questions?: string[]
  suggestedActions?: ChatSuggestedAction[]
  extracted?: Partial<{
    problemStatement: string
    assetName: string
    area: string
    lossTypeId: LossTypeId
    initialMethod: InitialMethod
    sixW2H: Partial<SixW2H>
  }>
  readyForForm?: boolean
  runEvidenceChecks?: boolean
}

export type AiRefocusResponse = {
  refocusStatement: string
  known: string[]
  missing: string[]
  narrowedScope: string
  expertFeedback: ExpertFeedback[]
  recommendInHouse: boolean
  rationale: string
  suggestedActions: ActionItem[]
}
