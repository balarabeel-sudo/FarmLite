import { useState } from 'react'
import Icon from './Icons'

// Full-screen photo viewer. Tap anywhere to close.
export function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '18px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={18} color="white" />
      </div>
    </div>
  )
}

// Shows up to 4 post photos in a tidy grid; tap a photo to view it full screen.
export default function PostImages({ images }: { images: string[] | null | undefined }) {
  const [open, setOpen] = useState('')
  const list = (images || []).filter(Boolean)
  if (list.length === 0) return null

  const single = list.length === 1
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: single ? '1fr' : '1fr 1fr', gap: '4px', marginTop: '10px', borderRadius: '12px', overflow: 'hidden' }}>
        {list.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            loading="lazy"
            onClick={(e) => { e.stopPropagation(); setOpen(url) }}
            style={{ width: '100%', height: single ? '220px' : '120px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
          />
        ))}
      </div>
      {open && <Lightbox url={open} onClose={() => setOpen('')} />}
    </>
  )
}
