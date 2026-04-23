import { supabase } from './supabase'

export const CIL_TASK_PHOTOS_BUCKET = 'cil-task-photos'

export function cilTaskPhotoPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim()) return null
  const { data } = supabase.storage.from(CIL_TASK_PHOTOS_BUCKET).getPublicUrl(storagePath.trim())
  return data?.publicUrl ?? null
}
