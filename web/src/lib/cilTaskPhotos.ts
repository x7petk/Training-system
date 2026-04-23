import { supabase } from './supabase'

export const CIL_TASK_PHOTOS_BUCKET = 'cil-task-photos'

export function cilTaskPhotoPublicUrl(storagePath: string | null | undefined): string | null {
  const s = storagePath?.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  const { data } = supabase.storage.from(CIL_TASK_PHOTOS_BUCKET).getPublicUrl(s)
  return data?.publicUrl ?? null
}
