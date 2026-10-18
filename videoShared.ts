import { supabase } from './supabaseClient'

// Short videos live in their own public "videos" bucket (50 MB per file).
// Who may post, how long a video can be and the daily cap come from the database (set by the admin);
// Premium members get the longer limit. The database enforces all of it.
export const VIDEO_BUCKET = 'videos'
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const DEFAULT_MAX_SECONDS = 20
export const PREMIUM_DEFAULT_SECONDS = 60

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
  comments_count: number
  created_at: string
  profiles: { full_name: string | null; username: string | null; profile_image: string | null; is_premium: boolean; premium_until: string | null } | null
}

// Select string every page should use so VideoCard gets everything it needs.
export const VIDEO_SELECT =
  'id, user_id, video_url, video_path, thumbnail_url, thumbnail_path, caption, duration_seconds, likes_count, views_count, comments_count, created_at, ' +
  'profiles!short_videos_user_id_fkey(full_name, username, profile_image, is_premium, premium_until)'

export type VideoPermission = {
  allowed: boolean // may this person post videos right now
  premium: boolean
  max_seconds: number // longest video this person may post
  per_day: number
  used_today: number
}

// What the signed-in person may do: asked from the database so the numbers are never stale.
export async function fetchVideoPermission(): Promise<VideoPermission> {
  try {
    const { data, error } = await supabase.rpc('my_video_permission')
    if (error || !data) throw error || new Error('no data')
    const d = data as any
    return {
      allowed: !!d.allowed,
      premium: !!d.premium,
      max_seconds: Number(d.max_seconds) || 0,
      per_day: Number(d.per_day) || 0,
      used_today: Number(d.used_today) || 0,
    }
  } catch {
    return { allowed: false, premium: false, max_seconds: 0, per_day: 0, used_today: 0 }
  }
}

// Longest video this person may post (kept for the pages that only need the number).
export async function fetchMaxVideoSeconds(): Promise<number> {
  const p = await fetchVideoPermission()
  return p.max_seconds > 0 ? p.max_seconds : DEFAULT_MAX_SECONDS
}

// Link to one video inside Farmxie.
export const videoLink = (id: string) => `${window.location.origin}/videos/${id}`

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function guessType(file: Blob & { name?: string }): string {
  if (file.type) return file.type.split(';')[0]
  const n = (file.name || '').toLowerCase()
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
  if (m.includes('row-level security') || m.includes('policy')) return 'You cannot post videos right now. Please try again later.'
  if (m.includes('exceeded') || m.includes('too large') || m.includes('maximum allowed size')) return 'This video is too large (max 50 MB). Record at a lower quality such as 720p and try again.'
  if (m.includes('mime') || m.includes('not supported')) return 'This video type is not supported. Please choose an MP4 video.'
  return 'Video upload failed. Check your connection and try again.'
}

// Uploads the video (and its cover picture) and creates the video post.
// The database refuses it for non-Premium members, videos that are too long, and when the daily cap is reached.
export async function postShortVideo(args: { file: Blob & { name?: string }; caption: string; duration: number; thumbnail: Blob | null }): Promise<string> {
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

// Keeps only the first `maxSeconds` of a video, like WhatsApp status does, without showing the user any warning.
// It replays the video on the phone and records the first seconds. Returns null when the phone cannot do this;
// the caller then posts the original file and the player stops it at the limit.
export function trimVideo(file: File, maxSeconds: number): Promise<{ blob: Blob; duration: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video') as any
    const capture = v.captureStream || v.mozCaptureStream
    if (!capture || typeof MediaRecorder === 'undefined') { resolve(null); return }

    const url = URL.createObjectURL(file)
    let ctx: AudioContext | null = null
    let recorder: MediaRecorder | null = null
    let finished = false
    const finish = (r: { blob: Blob; duration: number } | null) => {
      if (finished) return
      finished = true
      try { v.pause() } catch { /* ignore */ }
      try { ctx?.close() } catch { /* ignore */ }
      URL.revokeObjectURL(url)
      resolve(r)
    }

    const candidates = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    const mime = candidates.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } })
    if (!mime) { URL.revokeObjectURL(url); resolve(null); return }

    v.playsInline = true
    v.preload = 'auto'
    v.src = url
    v.onerror = () => finish(null)
    v.onloadeddata = async () => {
      try {
        const stream: MediaStream = capture.call(v)
        // Take the sound through the audio engine so the phone does not play it out loud while recording
        let tracks = [...stream.getVideoTracks()]
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext
          ctx = new AC()
          const src = ctx!.createMediaElementSource(v)
          const dest = ctx!.createMediaStreamDestination()
          src.connect(dest)
          tracks = [...tracks, ...dest.stream.getAudioTracks()]
        } catch {
          tracks = [...tracks, ...stream.getAudioTracks()]
        }
        const chunks: Blob[] = []
        recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 2_500_000 })
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
        const started = Date.now()
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime.split(';')[0] })
          if (blob.size === 0 || blob.size > MAX_VIDEO_BYTES) finish(null)
          else finish({ blob, duration: Math.min(maxSeconds, (Date.now() - started) / 1000) })
        }
        const stop = () => { try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch { finish(null) } }
        v.ontimeupdate = () => { if (v.currentTime >= maxSeconds) stop() }
        v.onended = stop
        recorder.start(500)
        await v.play()
        // safety net in case timeupdate never fires
        setTimeout(stop, (maxSeconds + 2) * 1000)
      } catch {
        finish(null)
      }
    }
  })
}

// Removes the post and its files.
export async function deleteShortVideo(video: Pick<VideoRow, 'id' | 'video_path' | 'thumbnail_path'>): Promise<boolean> {
  const { error } = await supabase.from('short_videos').delete().eq('id', video.id)
  if (error) return false
  await supabase.storage.from(VIDEO_BUCKET).remove([video.video_path, ...(video.thumbnail_path ? [video.thumbnail_path] : [])])
  return true
}
