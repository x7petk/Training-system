import { describe, expect, it } from 'vitest'
import { isMissingMasterCellColumnError } from './types'

describe('isMissingMasterCellColumnError', () => {
  it('detects PostgREST-style missing column messages', () => {
    expect(isMissingMasterCellColumnError('column ldr_people.master_cell_id does not exist')).toBe(true)
    expect(isMissingMasterCellColumnError('master_cell_id not found in schema')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isMissingMasterCellColumnError('permission denied')).toBe(false)
    expect(isMissingMasterCellColumnError(null)).toBe(false)
    expect(isMissingMasterCellColumnError(undefined)).toBe(false)
  })
})
