import { supabase } from '../../../lib/supabase'
import { AI_VIDEO_BUCKET } from './types'

export type PhoneInboxItem = {
  id: string
  user_id: string
  storage_path: string
  file_name: string
  created_at: string
}

export async function uploadPhoneInboxPhoto(userId: string, file: File): Promise<PhoneInboxItem> {
  const id = crypto.randomUUID()
  const path = `${userId}/inbox/${id}.jpg`
  const { error: upErr } = await supabase.storage.from(AI_VIDEO_BUCKET).upload(path, file, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (upErr) throw new Error(upErr.message)
  const { data, error } = await supabase
    .from('ai_video_phone_inbox')
    .insert({
      id,
      user_id: userId,
      storage_path: path,
      file_name: file.name || 'phone.jpg',
    })
    .select('id, user_id, storage_path, file_name, created_at')
    .single()
  if (error) {
    await supabase.storage.from(AI_VIDEO_BUCKET).remove([path])
    throw new Error(error.message)
  }
  return data as PhoneInboxItem
}

export async function listPhoneInbox(): Promise<PhoneInboxItem[]> {
  const { data, error } = await supabase
    .from('ai_video_phone_inbox')
    .select('id, user_id, storage_path, file_name, created_at')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PhoneInboxItem[]
}

export async function consumePhoneInboxItem(item: PhoneInboxItem): Promise<File> {
  const { data, error } = await supabase.storage.from(AI_VIDEO_BUCKET).download(item.storage_path)
  if (error || !data) throw new Error(error?.message || 'Could not download the phone picture.')
  const file = new File([data], item.file_name || 'phone.jpg', { type: data.type || 'image/jpeg' })
  await supabase.from('ai_video_phone_inbox').delete().eq('id', item.id)
  await supabase.storage.from(AI_VIDEO_BUCKET).remove([item.storage_path])
  return file
}
