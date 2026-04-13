export type ObsKind = 'sos' | 'qos' | 'ppo'

export function obsBasePath(k: ObsKind): string {
  return `/ldr-tools/${k}`
}

export function obsLabel(k: ObsKind): string {
  switch (k) {
    case 'sos':
      return 'SOS'
    case 'qos':
      return 'QOS'
    case 'ppo':
      return 'PPO'
  }
}

export function obsTitle(k: ObsKind): string {
  switch (k) {
    case 'sos':
      return 'Safety Observation System'
    case 'qos':
      return 'Quality Observation System'
    case 'ppo':
      return 'Process Productivity Observation'
  }
}

export function obsDuplicateToken(k: ObsKind): string {
  switch (k) {
    case 'sos':
      return 'sos_duplicate_submit'
    case 'qos':
      return 'qos_duplicate_submit'
    case 'ppo':
      return 'ppo_duplicate_submit'
  }
}
