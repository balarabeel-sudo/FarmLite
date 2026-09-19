import { supabase } from './supabaseClient'

/**
 * Uploads a file to the shared "media" storage bucket under the current
 * user's own folder, and returns its public URL. Every image in the app
 * (post photos, listing photos, profile pictures, company logos) should
 * go through this one function so the storage path convention stays
 * consistent with the bucket's RLS policies (each user can only write
 * inside their own "{user_id}/..." folder).
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('You must be signed in to upload an image.')

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB.')
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${folder}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}
