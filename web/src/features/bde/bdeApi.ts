import { supabase } from '../../lib/supabase'
import {
  BDE_ALLOWED_IMAGE_TYPES,
  BDE_MAX_PHOTO_BYTES,
  BDE_MAX_PHOTOS,
  BDE_PHOTO_BUCKET,
  type BdeCodeKind,
  type BdePhotoRow,
} from './bdeTypes'

export async function replaceBdeCodes(
  bdeId: string,
  selected: Record<BdeCodeKind, string[]>,
): Promise<string | null> {
  const { error: delErr } = await supabase.from('bde_record_codes').delete().eq('bde_id', bdeId)
  if (delErr) return delErr.message

  const rows: { bde_id: string; code_kind: BdeCodeKind; code_id: string }[] = []
  for (const kind of ['activity', 'object_part', 'damage', 'cause'] as BdeCodeKind[]) {
    for (const codeId of selected[kind] ?? []) {
      rows.push({ bde_id: bdeId, code_kind: kind, code_id: codeId })
    }
  }
  if (!rows.length) return null
  const { error: insErr } = await supabase.from('bde_record_codes').insert(rows)
  return insErr?.message ?? null
}

export async function replaceBdeTeamMembers(bdeId: string, personIds: string[]): Promise<string | null> {
  const { error: delErr } = await supabase.from('bde_record_team_members').delete().eq('bde_id', bdeId)
  if (delErr) return delErr.message
  const unique = Array.from(new Set(personIds.filter(Boolean)))
  if (!unique.length) return null
  const { error: insErr } = await supabase
    .from('bde_record_team_members')
    .insert(unique.map((person_id) => ({ bde_id: bdeId, person_id })))
  return insErr?.message ?? null
}

export async function uploadBdePhoto(
  bdeId: string,
  file: File,
  userId: string | undefined,
  currentCount: number,
): Promise<{ photo?: BdePhotoRow; error?: string }> {
  if (currentCount >= BDE_MAX_PHOTOS) {
    return { error: `Maximum ${BDE_MAX_PHOTOS} photos.` }
  }
  if (!BDE_ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Use JPEG, PNG, WebP, or GIF.' }
  }
  if (file.size > BDE_MAX_PHOTO_BYTES) {
    return { error: 'Each photo must be under 8 MB.' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${bdeId}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BDE_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const { data, error: insErr } = await supabase
    .from('bde_record_photos')
    .insert({
      bde_id: bdeId,
      storage_path: path,
      file_name: file.name,
      sort_order: currentCount,
      created_by: userId ?? null,
    })
    .select('id, bde_id, storage_path, file_name, sort_order, created_at')
    .single()

  if (insErr) {
    await supabase.storage.from(BDE_PHOTO_BUCKET).remove([path])
    return { error: insErr.message }
  }
  return { photo: data as BdePhotoRow }
}

export async function deleteBdePhoto(photo: BdePhotoRow): Promise<string | null> {
  const { error: delErr } = await supabase.from('bde_record_photos').delete().eq('id', photo.id)
  if (delErr) return delErr.message
  await supabase.storage.from(BDE_PHOTO_BUCKET).remove([photo.storage_path])
  return null
}

export async function signedBdePhotoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BDE_PHOTO_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}
