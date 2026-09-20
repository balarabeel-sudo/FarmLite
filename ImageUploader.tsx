import { useRef, useState } from 'react'
import Icon from './Icons'
import { uploadMedia, type MediaFolder } from './imageUpload'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Props = {
  value: string[]
  onChange: (urls: string[]) => void
  folder?: MediaFolder
  max?: number
}

// Multi-photo picker: choose from gallery or camera, shows previews. First photo is the cover.
export default function ImageUploader({ value, onChange, folder = 'listings', max = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    const room = max - value.length
    const picked = Array.from(files).slice(0, Math.max(room, 0))
    if (picked.length === 0) {
      setError(`You can add up to ${max} photos.`)
      return
    }
    setBusy(picked.length)
    const added: string[] = []
    for (const file of picked) {
      try {
        added.push(await uploadMedia(file, folder))
      } catch (e: any) {
        setError(e?.message || 'A photo failed to upload. Try again.')
      } finally {
        setBusy((n) => n - 1)
      }
    }
    if (added.length) onChange([...value, ...added])
  }

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  const makeCover = (i: number) => {
    if (i === 0) return
    const next = [...value]
    const [item] = next.splice(i, 1)
    next.unshift(item)
    onChange(next)
  }

  const tile: React.CSSProperties = {
    width: '84px', height: '84px', borderRadius: '12px', overflow: 'hidden', position: 'relative',
    border: `1px solid ${COLORS.border}`, background: COLORS.bg, flexShrink: 0,
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {value.map((url, i) => (
          <div key={url} style={tile}>
            <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div
              onClick={() => remove(i)}
              style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '11px', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="close" size={12} color="white" />
            </div>
            {i === 0 ? (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'white', background: COLORS.green, padding: '2px 0' }}>
                Cover
              </div>
            ) : (
              <div
                onClick={() => makeCover(i)}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'white', background: 'rgba(0,0,0,0.55)', padding: '2px 0', cursor: 'pointer' }}>
                Make cover
              </div>
            )}
          </div>
        ))}

        {Array.from({ length: busy }).map((_, i) => (
          <div key={`busy-${i}`} style={{ ...tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', color: COLORS.textMuted }}>
            Uploading...
          </div>
        ))}

        {value.length + busy < max && (
          <div
            onClick={() => inputRef.current?.click()}
            style={{ ...tile, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', border: `1.5px dashed ${COLORS.green}`, background: '#F0FDF4', color: COLORS.green, fontSize: '10.5px', fontWeight: 700 }}>
            <Icon name="camera" size={20} color={COLORS.green} />
            Add photo
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>
        {value.length}/{max} photos. The first photo shows on the listing card.
      </p>
      {error && <p style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '4px' }}>{error}</p>}
    </div>
  )
}
