export const BMS_BRAIN_ATTACHMENTS_BUCKET = 'bms-brain-attachments'

export async function uploadBmsAttachment(
  processId: string,
  stepId: string,
  file: File,
  userId: string,
): Promise<{ path: string | null; error: string | null }> {
  const { supabase } = await import('../../lib/supabase')
  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_')
  const path = `${processId}/${stepId}/${Date.now()}_${safeName}`
  const { error: upErr } = await supabase.storage.from(BMS_BRAIN_ATTACHMENTS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { path: null, error: upErr.message }
  const { error: metaErr } = await supabase.from('bms_brain_attachments').insert({
    process_id: processId,
    step_id: stepId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    byte_size: file.size,
    uploaded_by: userId,
  })
  if (metaErr) return { path: null, error: metaErr.message }
  return { path, error: null }
}

export async function signedBmsAttachmentUrl(storagePath: string): Promise<string | null> {
  const { supabase } = await import('../../lib/supabase')
  const { data, error } = await supabase.storage
    .from(BMS_BRAIN_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}
