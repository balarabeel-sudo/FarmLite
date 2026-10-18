import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import { COLORS, inputStyle, labelStyle, ErrorBanner } from '../shared'
import { MAX_VIDEO_BYTES, captureThumbnail, fetchVideoPermission, formatDuration, postShortVideo, readVideoMeta, trimVideo } from '../videoShared'

// Route: /videos/new - post a short video. Who may post and how long it can be is decided by the admin settings
// (Premium: longer limit; free members only when the admin allows it). The database enforces it too.
export default function VideoUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [maxSeconds, setMaxSeconds] = useState(20)
  const [postingStage, setPostingStage] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [thumb, setThumb] = useState<Blob | null>(null)
  const [caption, setCaption] = useState('')
  const [checking, setChecking] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      const perm = await fetchVideoPermission()
      if (!alive) return
      setAllowed(perm.allowed)
      if (perm.max_seconds > 0) setMaxSeconds(perm.max_seconds)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [user])

  // Free the preview from memory when it changes or the page closes
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const clearVideo = () => {
    setFile(null)
    setPreviewUrl(null)
    setDuration(0)
    setThumb(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (f: File | null) => {
    if (!f) return
    setError('')
    clearVideo()

    const looksLikeVideo = f.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(f.name)
    if (!looksLikeVideo) { setError('Please choose a video file.'); return }
    if (f.size > MAX_VIDEO_BYTES) { setError('This video is too large (max 50 MB). Record at a lower quality such as 720p and try again.'); return }

    setChecking(true)
    try {
      const meta = await readVideoMeta(f)
      // A longer video is accepted: only the first part (up to the limit) is kept when posting.
      const t = await captureThumbnail(f)
      setFile(f)
      setDuration(meta.duration)
      setThumb(t)
      setPreviewUrl(URL.createObjectURL(f))
    } catch (e) {
      setError((e as Error).message)
    }
    setChecking(false)
  }

  const canPost = !!file && !checking && !posting

  const handlePost = async () => {
    if (!file || !canPost) return
    setError('')
    setPosting(true)
    try {
      let upload: Blob & { name?: string } = file
      let length = duration
      // Longer than the limit: quietly keep only the first part, like a WhatsApp status
      if (duration > maxSeconds + 0.3) {
        setPostingStage('Preparing your video...')
        const trimmed = await trimVideo(file, maxSeconds)
        if (trimmed) { upload = trimmed.blob; length = trimmed.duration }
        else length = maxSeconds // the player stops at this length
      }
      setPostingStage('Uploading your video...')
      await postShortVideo({ file: upload, caption, duration: Math.min(length, maxSeconds), thumbnail: thumb })
      navigate('/?tab=update', { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setPosting(false)
      setPostingStage('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => (posting ? undefined : navigate(-1))} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="close" size={22} color={COLORS.text} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>New Video</p>
        </div>
        {allowed && (
          <div
            onClick={canPost ? handlePost : undefined}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white', background: COLORS.green, cursor: canPost ? 'pointer' : 'default', opacity: canPost ? 1 : 0.5 }}>
            {posting ? 'Posting...' : 'Post'}
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '40px 0' }}>Loading...</p>
        ) : !allowed ? (
          <div style={{ background: COLORS.card, borderRadius: '16px', padding: '28px 18px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10.5 9.5v5l4-2.5-4-2.5Z" fill={COLORS.green} />
              </svg>
            </div>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, marginTop: '14px' }}>Short videos are a Premium feature</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
              Upgrade to Premium to post longer videos. Everyone can watch them.
            </p>
            <div onClick={() => navigate('/premium')} style={{ display: 'inline-block', marginTop: '16px', background: COLORS.green, color: 'white', borderRadius: '12px', padding: '11px 22px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
              Upgrade to Premium
            </div>
          </div>
        ) : (
          <>
            <ErrorBanner text={error} />

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />

            {!file ? (
              <div
                onClick={checking ? undefined : () => inputRef.current?.click()}
                style={{ background: COLORS.card, border: `2px dashed ${COLORS.border}`, borderRadius: '16px', padding: '40px 18px', textAlign: 'center', cursor: checking ? 'default' : 'pointer' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '27px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <Icon name="camera" size={24} color={COLORS.green} />
                </div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginTop: '12px' }}>{checking ? 'Checking video...' : 'Choose or record a video'}</p>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
                  Up to {maxSeconds} seconds and 50 MB. MP4 works best. Longer videos are cut to {maxSeconds} seconds.
                </p>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', background: '#000', borderRadius: '14px', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                  <video src={previewUrl || undefined} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: '60vh', display: 'block', objectFit: 'contain', background: '#000' }} />
                  <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10.5px', fontWeight: 700, borderRadius: '6px', padding: '2px 7px', pointerEvents: 'none' }}>
                    {formatDuration(Math.min(duration, maxSeconds))}
                  </div>
                </div>
                {!posting && (
                  <div onClick={clearVideo} style={{ display: 'inline-block', marginTop: '10px', fontSize: '12.5px', fontWeight: 700, color: COLORS.red, cursor: 'pointer' }}>
                    Choose a different video
                  </div>
                )}

                <div style={{ marginTop: '14px' }}>
                  <p style={labelStyle}>Caption (optional)</p>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, 300))}
                    disabled={posting}
                    rows={3}
                    placeholder="Say something about your video"
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <p style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'right', marginTop: '3px' }}>{caption.length}/300</p>
                </div>

                {posting && (
                  <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                    {postingStage || 'Uploading your video...'} Please keep this page open...
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
