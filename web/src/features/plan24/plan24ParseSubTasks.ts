import type { Plan24SubTask } from './plan24Types'

export function parsePlan24SubTasks(raw: unknown): Plan24SubTask[] {
  if (!Array.isArray(raw)) return []
  const out: Plan24SubTask[] = []
  for (const x of raw) {
    if (x && typeof x === 'object' && 'id' in x && 'label' in x) {
      const o = x as Record<string, unknown>
      const wc = o.when_condition
      const whenOk = wc === 'running' || wc === 'down' || wc === 'other' ? wc : null
      let checkTypes: string[] | undefined
      if (Array.isArray(o.check_types)) {
        checkTypes = o.check_types.map((t) => String(t))
      }
      const res = o.result
      const resultOk = res === 'pass' || res === 'fail' ? res : null
      const evNum = o.entered_value
      let enteredVal: number | null | undefined
      if (evNum === null) enteredVal = null
      else if (typeof evNum === 'number' && Number.isFinite(evNum)) enteredVal = evNum
      else if (typeof evNum === 'string' && evNum.trim() !== '' && Number.isFinite(Number(evNum))) enteredVal = Number(evNum)
      const tv = o.target_value
      let targetVal: number | null | undefined
      if (tv === null) targetVal = null
      else if (typeof tv === 'number' && Number.isFinite(tv)) targetVal = tv
      else if (typeof tv === 'string' && tv.trim() !== '' && Number.isFinite(Number(tv))) targetVal = Number(tv)
      out.push({
        id: String(o.id),
        label: String(o.label),
        done: Boolean(o.done),
        required: typeof o.required === 'boolean' ? o.required : undefined,
        input_kind: typeof o.input_kind === 'string' ? o.input_kind : undefined,
        min_value: typeof o.min_value === 'number' ? o.min_value : o.min_value === null ? null : undefined,
        max_value: typeof o.max_value === 'number' ? o.max_value : o.max_value === null ? null : undefined,
        target_value: targetVal,
        standard_description: typeof o.standard_description === 'string' ? o.standard_description : undefined,
        photo_path: typeof o.photo_path === 'string' ? o.photo_path : undefined,
        check_types: checkTypes,
        when_condition: whenOk,
        entered_value: enteredVal,
        result: resultOk,
        text_value: typeof o.text_value === 'string' ? o.text_value : o.text_value === null ? null : undefined,
      })
    }
  }
  return out
}
