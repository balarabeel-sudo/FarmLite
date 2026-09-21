import { supabase } from './supabaseClient'

export type MediaFolder = 'avatars' | 'covers' | 'logos' | 'gallery' | 'listings' | 'posts' | 'equipment' | 'companies' | 'communities'

const MAX_SIDE: Record<MediaFolder, number> = {
  avatars: 600,
  covers: 1800,
  logos: 600,
  gallery: 1600,
  listings: 1600,
  posts: 1600,
  equipment: 1600,
  companies: 1600,
  communities: 1600,
}

// Shrinks a photo on the phone before upload (saves data and storage).
export async function compressImage(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process this image.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process this image.'))),
      'image/webp',
      quality,
    )
  })
}

// Uploads one image to the public "media" bucket under {user_id}/{folder}/...
// and returns its public URL. The first path segment must be the user's id
// (the storage policies check that).
export async function uploadMedia(file: File, folder: MediaFolder): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Please log in first.')
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')

  const blob = await compressImage(file, MAX_SIDE[folder])
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error('Photo upload failed. Check your connection and try again.')

  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
