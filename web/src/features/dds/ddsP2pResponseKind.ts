/** Stored in `dds_p2p_standard_questions.response_kind`. */
export const DDS_P2P_RESPONSE_KINDS = [
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'number_with_target', label: 'Number (with target)' },
] as const

export type DdsP2pResponseKind = (typeof DDS_P2P_RESPONSE_KINDS)[number]['value']

export function isDdsP2pResponseKind(s: string): s is DdsP2pResponseKind {
  return DDS_P2P_RESPONSE_KINDS.some((k) => k.value === s)
}
