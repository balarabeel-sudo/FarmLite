import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icons'

// Full-screen photo viewer for one photo. Tap anywhere to close.
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

// Full-screen viewer for a whole post: every photo is shown whole (nothing cropped), one under the other.
// It opens at the photo that was tapped; scroll down to see the others. Tap the X or the empty space to close.
function PhotoViewer({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const startRef = useRef<HTMLDivElement>(null)

  // While the viewer is open the page behind it (and pull-to-refresh) stays still
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const goToStart = () => startRef.current?.scrollIntoView({ block: 'center' })
  useEffect(() => { goToStart() }, [])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 100, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', padding: '60px 0 40px' }}>
        {images.map((url, i) => (
          <div key={url + i} ref={i === start ? startRef : undefined}>
            <img
              src={url}
              alt=""
              onClick={(e) => e.stopPropagation()}
              onLoad={i === start ? goToStart : undefined}
              style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '900px', margin: '0 auto' }}
            />
          </div>
        ))}
      </div>
      <div
        role="button"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{ position: 'fixed', top: '14px', right: '14px', width: '38px', height: '38px', borderRadius: '19px', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name="close" size={19} color="white" />
      </div>
      {images.length > 1 && (
        <div style={{ position: 'fixed', top: '20px', left: '16px', color: 'white', fontSize: '12.5px', fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: '12px', padding: '4px 10px', pointerEvents: 'none' }}>
          {images.length} photos
        </div>
      )}
    </div>
  )
}

const MAX_TILES = 5
const GAP = 3

// How the photos of a post are laid out (the first photo is always the biggest):
//   1 photo  -> shown whole, in its own shape (very tall ones are limited in height)
//   2 photos -> side by side, same size
//   3 photos -> one big on the left, two smaller on the right
//   4 photos -> 2 x 2
//   5+ photos -> two big on top, three smaller below ("+N" on the last one when there are more than 5)
export default function PostImages({ images }: { images: string[] | null | undefined }) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  const list = (images || []).filter(Boolean)
  if (list.length === 0) return null

  const shown = list.slice(0, MAX_TILES)
  const extra = list.length - shown.length

  const tile = (i: number, style: CSSProperties) => (
    <div
      key={shown[i] + i}
      onClick={(e) => { e.stopPropagation(); setOpenAt(i) }}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', background: 'var(--fx-tint-green2)', ...style }}>
      <img src={shown[i]} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {extra > 0 && i === shown.length - 1 && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800 }}>
          +{extra}
        </div>
      )}
    </div>
  )

  let body
  if (shown.length === 1) {
    body = (
      <div onClick={(e) => { e.stopPropagation(); setOpenAt(0) }} style={{ background: 'var(--fx-tint-green2)', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
        <img src={shown[0]} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '460px', objectFit: 'contain' }} />
      </div>
    )
  } else if (shown.length === 2) {
    body = <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>{[0, 1].map((i) => tile(i, { height: '230px' }))}</div>
  } else if (shown.length === 3) {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gridTemplateRows: '1fr 1fr', gap: GAP, height: '260px' }}>
        {tile(0, { gridRow: '1 / span 2' })}
        {tile(1, {})}
        {tile(2, {})}
      </div>
    )
  } else if (shown.length === 4) {
    body = <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>{[0, 1, 2, 3].map((i) => tile(i, { height: '140px' }))}</div>
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>{[0, 1].map((i) => tile(i, { height: '170px' }))}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: GAP }}>{[2, 3, 4].map((i) => tile(i, { height: '105px' }))}</div>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginTop: '10px', borderRadius: '12px', overflow: 'hidden' }}>{body}</div>
      {openAt !== null && <PhotoViewer images={list} start={openAt} onClose={() => setOpenAt(null)} />}
    </>
  )
}
