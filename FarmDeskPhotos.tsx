import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

export const MAX_MESSAGE_PHOTOS = 4

// Shrinks a photo in the browser before upload (max 1600px, JPEG) so chats stay fast on mobile data.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.82)
  })
}

// Uploads the chosen photos to the public "media" bucket under the sender's own folder and returns their URLs.
export async function uploadMessagePhotos(files: File[], userId: string, requestId: string): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const blob = await shrink(files[i])
    const path = `${userId}/farm-desk/${requestId}/${Date.now()}-${i}.jpg`
    const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
  }
  return urls
}

// Thumbnails of the chosen photos (with a remove button), shown above the composer.
export function PhotoPreviews({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  if (previews.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
      {previews.map((src, i) => (
        <div key={src} style={{ position: 'relative', width: '58px', height: '58px' }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
          <div
            onClick={() => onChange(files.filter((_, idx) => idx !== i))}
            style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '10px', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        </div>
      ))}
    </div>
  )
}

// The "add photos" button (up to 4 per message).
export function PhotoButton({ files, onChange, disabled, accent = '#16A34A' }: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  accent?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const full = files.length >= MAX_MESSAGE_PHOTOS

  const pick = (list: FileList | null) => {
    if (!list) return
    const chosen = Array.from(list).filter((f) => f.type.startsWith('image/'))
    onChange([...files, ...chosen].slice(0, MAX_MESSAGE_PHOTOS))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      <div
        onClick={() => { if (!disabled && !full) inputRef.current?.click() }}
        title={full ? `Up to ${MAX_MESSAGE_PHOTOS} photos` : 'Add photos'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', cursor: disabled || full ? 'default' : 'pointer', opacity: disabled || full ? 0.4 : 1, flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" />
        </svg>
      </div>
    </>
  )
}

// Photos inside a message bubble. Tap a photo to view it full screen.
export function MessagePhotos({ images }: { images: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!images || images.length === 0) return null
  const cols = images.length === 1 ? 1 : 2

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', marginBottom: '6px', maxWidth: images.length === 1 ? '220px' : '240px' }}>
        {images.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            onClick={() => setOpen(src)}
            style={{ width: '100%', height: images.length === 1 ? 'auto' : '110px', maxHeight: '240px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', display: 'block' }}
          />
        ))}
      </div>
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={open} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '6px' }} />
        </div>
      )}
    </>
  )
}
