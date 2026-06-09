import { useEffect, useRef, useState } from 'react'
import { Paperclip, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { signedBmsAttachmentUrl, uploadBmsAttachment } from './bmsBrainStorage'

type AttachmentRow = {
  id: string
  file_name: string
  storage_path: string
  mime_type: string
  byte_size: number | null
  created_at: string
}

type Props = {
  processId: string
  stepId: string
  canEdit?: boolean
}

export function BmsBrainStepAttachments({ processId, stepId, canEdit = false }: Props) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<AttachmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const { data } = await supabase
      .from('bms_brain_attachments')
      .select('id, file_name, storage_path, mime_type, byte_size, created_at')
      .eq('process_id', processId)
      .eq('step_id', stepId)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as AttachmentRow[])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [processId, stepId])

  async function onUpload(file: File) {
    if (!user) return
    setUploading(true)
    setError(null)
    const { error: upErr } = await uploadBmsAttachment(processId, stepId, file, user.id)
    setUploading(false)
    if (upErr) setError(upErr)
    else void reload()
  }

  async function remove(id: string, storagePath: string) {
    await supabase.storage.from('bms-brain-attachments').remove([storagePath])
    await supabase.from('bms_brain_attachments').delete().eq('id', id)
    void reload()
  }

  async function openFile(storagePath: string) {
    const url = await signedBmsAttachmentUrl(storagePath)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-muted">
          <Paperclip className="size-3.5" aria-hidden />
          Attachments
        </p>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUpload(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-black/[0.04]"
            >
              <Upload className="size-3" aria-hidden />
              Upload
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="text-[10px] text-danger">{error}</p> : null}
      {loading ? <p className="text-[10px] text-muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-[10px] text-muted">No files attached.</p>
      ) : null}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1 text-[10px]">
            <button
              type="button"
              onClick={() => void openFile(r.storage_path)}
              className="truncate text-left text-accent hover:underline"
            >
              {r.file_name}
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void remove(r.id, r.storage_path)}
                className="shrink-0 rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-danger"
                aria-label={`Remove ${r.file_name}`}
              >
                <Trash2 className="size-3" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
