import { supabase } from './supabaseClient'
import { fetchLimits } from './premiumShared'

// Short videos live in their own public "videos" bucket (50 MB per file).
// Only Premium members can upload; the database enforces that, the length limit and the daily cap.
export const VIDEO_BUCKET = 'videos'
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const DEFAULT_MAX_SECONDS = 20

export type VideoRow = {
  id: string
  user_id: string
  video_url: string
  video_path: string
  thumbnail_url: string | null
  thumbnail_path: string | null
  caption: string | null
  duration_seconds: number
  likes_count: number
  views_count: number
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null
}

// Select string every page should use so VideoCard gets everything it needs.
export const VIDEO_SELECT =
  'id, user_id, video_url, video_path, thumbnail_url, thumbnail_path, caption, duration_seconds, likes_count, views_count, created_at, ' +
  'profiles!short_videos_user_id_fkey(full_name, username, profile_image, is_premium, premium_until)'

// Longest video a Premium member may post (admin-editable in app_limits).
export async function fetchMaxVideoSeconds(): Promise<number> {
  try {
    const limits = await fetchLimits()
    const v = limits['video_max_seconds']?.premium
    return v && v > 0 ? v : DEFAULT_MAX_SECONDS
  } catch {
    return DEFAULT_MAX_SECONDS
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function guessType(file: File): string {
  if (file.type) return file.type
  const n = file.name.toLowerCase()
  if (n.endsWith('.webm')) return 'video/webm'
  if (n.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

export type VideoMeta = { duration: number; width: number; height: number }

// Reads the real length of the chosen video on the phone.
export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    const done = () => URL.revokeObjectURL(url)
    v.onloadedmetadata = () => {
      const d = v.duration
      const meta = { duration: d, width: v.videoWidth, height: v.videoHeight }
      done()
      if (!Number.isFinite(d) || d <= 0) reject(new Error('Could not read the length of this video. Please choose an MP4 video.'))
      else resolve(meta)
    }
    v.onerror = () => {
      done()
      reject(new Error('This video cannot be played on your phone. Please choose an MP4 video.'))
    }
    v.src = url
  })
}

// Grabs a still picture from the video to use as its cover. Returns null if the phone cannot do it.
export function captureThumbnail(file: File, atSeconds = 0.5): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    v.playsInline = true
    let finished = false
    const finish = (blob: Blob | null) => {
      if (finished) return
      finished = true
      URL.revokeObjectURL(url)
      resolve(blob)
    }
    const timer = setTimeout(() => finish(null), 6000)
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(atSeconds, Math.max(0, (v.duration || 1) / 2)) } catch { clearTimeout(timer); finish(null) }
    }
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 640 / Math.max(v.videoWidth || 640, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round((v.videoWidth || 640) * scale))
        canvas.height = Math.max(1, Math.round((v.videoHeight || 360) * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { clearTimeout(timer); finish(null); return }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((b) => { clearTimeout(timer); finish(b) }, 'image/jpeg', 0.8)
      } catch {
        clearTimeout(timer)
        finish(null)
      }
    }
    v.onerror = () => { clearTimeout(timer); finish(null) }
    v.src = url
  })
}

function friendlyUploadError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('row-level security') || m.includes('policy')) return 'Only Premium members can post videos. Your Premium may have ended.'
  if (m.includes('exceeded') || m.includes('too large') || m.includes('maximum allowed size')) return 'This video is too large (max 50 MB). Record at a lower quality such as 720p and try again.'
  if (m.includes('mime') || m.includes('not supported')) return 'This video type is not supported. Please choose an MP4 video.'
  return 'Video upload failed. Check your connection and try again.'
}

// Uploads the video (and its cover picture) and creates the video post.
// The database refuses it for non-Premium members, videos that are too long, and when the daily cap is reached.
export async function postShortVideo(args: { file: File; caption: string; duration: number; thumbnail: Blob | null }): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Please log in first.')
  if (args.file.size > MAX_VIDEO_BYTES) throw new Error('This video is too large (max 50 MB). Record at a lower quality such as 720p and try again.')

  const type = guessType(args.file)
  const ext = type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4'
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const videoPath = `${user.id}/videos/${stamp}.${ext}`
  const thumbPath = args.thumbnail ? `${user.id}/videos/${stamp}.jpg` : null

  const up = await supabase.storage.from(VIDEO_BUCKET).upload(videoPath, args.file, { contentType: type, cacheControl: '31536000', upsert: false })
  if (up.error) throw new Error(friendlyUploadError(up.error.message || ''))
  const videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoPath).data.publicUrl

  let thumbUrl: string | null = null
  let savedThumbPath: string | null = null
  if (args.thumbnail && thumbPath) {
    const tu = await supabase.storage.from(VIDEO_BUCKET).upload(thumbPath, args.thumbnail, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
    if (!tu.error) {
      thumbUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(thumbPath).data.publicUrl
      savedThumbPath = thumbPath
    }
  }

  const { data, error } = await supabase
    .from('short_videos')
    .insert({
      user_id: user.id,
      video_url: videoUrl,
      video_path: videoPath,
      thumbnail_url: thumbUrl,
      thumbnail_path: savedThumbPath,
      caption: args.caption.trim() || null,
      duration_seconds: Math.round(args.duration * 100) / 100,
    })
    .select('id')
    .single()

  if (error || !data) {
    // Do not leave orphan files behind when the database refused the post
    await supabase.storage.from(VIDEO_BUCKET).remove([videoPath, ...(savedThumbPath ? [savedThumbPath] : [])])
    throw new Error(error?.message || 'Could not post your video. Please try again.')
  }
  return data.id as string
}

// Removes the post and its files.
export async function deleteShortVideo(video: Pick<VideoRow, 'id' | 'video_path' | 'thumbnail_path'>): Promise<boolean> {
  const { error } = await supabase.from('short_videos').delete().eq('id', video.id)
  if (error) return false
  await supabase.storage.from(VIDEO_BUCKET).remove([video.video_path, ...(video.thumbnail_path ? [video.thumbnail_path] : [])])
  return true
}
