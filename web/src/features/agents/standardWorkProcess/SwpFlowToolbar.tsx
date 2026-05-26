import { Download, FolderOpen, RotateCcw, Save, Trash2, Upload, Workflow } from 'lucide-react'
import type { SwpSystem } from './types'

type Props = {
  title: string
  systems?: SwpSystem[]
  selectedSystemId?: string | null
  onSelectSystem?: (systemId: string) => void
  onSaveLocal?: () => void
  onLoadLocal?: () => void
  onExportJson?: () => void
  onImportJson?: () => void
  onResetTemplate?: () => void
  onClearAll?: () => void
}

function ToolbarButton({
  onClick,
  title,
  children,
  className = '',
  disabled,
}: {
  onClick?: () => void
  title: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

/** Minimal top bar: title + file actions only. */
export function SwpFlowToolbar({
  title,
  systems,
  selectedSystemId,
  onSelectSystem,
  onSaveLocal,
  onLoadLocal,
  onExportJson,
  onImportJson,
  onResetTemplate,
  onClearAll,
}: Props) {
  const activeSystems = systems?.filter((s) => s.active) ?? []

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Workflow className="size-4 shrink-0 text-slate-600" aria-hidden />
        <h2 className="truncate text-sm font-semibold text-slate-800">{title}</h2>
        {activeSystems.length > 1 && onSelectSystem ? (
          <select
            value={selectedSystemId ?? ''}
            onChange={(e) => onSelectSystem(e.target.value)}
            className="max-w-[8rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            aria-label="Select system"
          >
            {activeSystems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {onSaveLocal ? (
          <ToolbarButton onClick={onSaveLocal} title="Save diagram to browser">
            <Save className="size-3.5" />
            Save
          </ToolbarButton>
        ) : null}
        {onLoadLocal ? (
          <ToolbarButton onClick={onLoadLocal} title="Load diagram from browser">
            <FolderOpen className="size-3.5" />
            Load
          </ToolbarButton>
        ) : null}
        {onExportJson ? (
          <ToolbarButton onClick={onExportJson} title="Export diagram as JSON">
            <Download className="size-3.5" />
            Export JSON
          </ToolbarButton>
        ) : null}
        {onImportJson ? (
          <ToolbarButton onClick={onImportJson} title="Import diagram JSON file">
            <Upload className="size-3.5" />
            Import JSON
          </ToolbarButton>
        ) : null}
        {onResetTemplate ? (
          <ToolbarButton onClick={onResetTemplate} title="Reset to example template">
            <RotateCcw className="size-3.5" />
            Reset Example
          </ToolbarButton>
        ) : null}
        {onClearAll ? (
          <ToolbarButton
            onClick={onClearAll}
            title="Remove all blocks and arrows"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="size-3.5" />
            Clear All
          </ToolbarButton>
        ) : null}
      </div>
    </header>
  )
}
