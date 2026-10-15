import { supabase } from './supabaseClient'

// Shared helpers for FarmBot photo questions (personal FarmBot and company FarmBot).
// Photos live in the private "farmbot" bucket, in a folder named after the signed-in user,
// and are only shown through short-lived signed links.

export const DEFAULT_MAX_FARMBOT_PHOTOS = 3
const BUCKET = 'farmbot'
const MAX_SIDE = 1280

export const FARMBOT_BUSY_TEXT = 'FarmBot is very busy right now. Please try again later.'
export const FARMBOT_FREE_LIMIT_TEXT = "You've reached today's free FarmBot limit. Upgrade to Premium to keep chatting."
export const FARMBOT_PHOTO_PREMIUM_TEXT = 'Photo questions are a Premium feature. Upgrade to send photos to FarmBot.'

// Shrinks a photo so it uploads quickly on a phone connection (max 1280 px, JPEG).
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read the photo')
  ctx.drawImage(bitmap, 0, 0, width, height)
  if (typeof bitmap.close === 'function') bitmap.close()
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Could not read the photo')
  return blob
}

export async function removeFarmbotPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // ignore: a leftover file is harmless and is only reachable by its owner
  }
}

// Uploads the photos and returns their storage paths. If one fails, the ones already uploaded are removed.
export async function uploadFarmbotPhotos(userId: string, files: File[]): Promise<string[]> {
  const paths: string[] = []
  try {
    for (const file of files) {
      const blob = await compressImage(file)
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      paths.push(path)
    }
    return paths
  } catch (e) {
    await removeFarmbotPhotos(paths)
    throw e
  }
}

// Turns stored paths into temporary links that the browser can display.
export async function signFarmbotPhotos(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600)
  const out: Record<string, string> = {}
  ;(data || []).forEach((d: { path: string | null; signedUrl: string }) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  })
  return out
}

// True when an upload error means "not allowed" (for example the account is not Premium)
export function isPermissionError(e: unknown): boolean {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return /row-level security|not authorized|unauthorized|forbidden|403|policy/i.test(text)
}
