import { createContext, useContext } from 'react'

export type SwpFlowEditorActions = {
  onLabelChange: (nodeId: string, label: string) => void
  onNodeResize: (nodeId: string, width: number, height: number) => void
}

const SwpFlowEditorContext = createContext<SwpFlowEditorActions | null>(null)

export function SwpFlowEditorProvider({
  value,
  children,
}: {
  value: SwpFlowEditorActions
  children: React.ReactNode
}) {
  return <SwpFlowEditorContext.Provider value={value}>{children}</SwpFlowEditorContext.Provider>
}

export function useSwpFlowEditorActions() {
  const ctx = useContext(SwpFlowEditorContext)
  if (!ctx) throw new Error('useSwpFlowEditorActions must be used within SwpFlowEditorProvider')
  return ctx
}
