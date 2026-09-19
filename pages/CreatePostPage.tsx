import { useState, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { uploadImage } from '../uploadImage'
import Icon from '../Icons'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

const CATEGORIES: { value: 'general' | 'crop' | 'livestock' | 'tips'; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'crop', label: 'Crop' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'tips', label: 'Tips' },
]

export default function CreatePostPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'general' | 'crop' | 'livestock' | 'tips'>('general')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handlePickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
  }

  const handlePost = async () => {
    if (!user || !content.trim()) return
    setError('')
    setPosting(true)

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'posts')
      }

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        category,
        content: content.trim(),
        images: imageUrl ? [imageUrl] : null,
        visibility: 'public',
      })

      if (insertError) throw insertError

      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Could not publish your post. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
        background: COLORS.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="close" size={22} color={COLORS.text} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>New Post</p>
        </div>
        <div
          onClick={posting || !content.trim() ? undefined : handlePost}
          style={{
            padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white',
            background: COLORS.green, cursor: content.trim() ? 'pointer' : 'default',
            opacity: posting || !content.trim() ? 0.5 : 1,
          }}>
          {posting ? 'Posting...' : 'Post'}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11.5px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                padding: '7px 14px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: category === c.value ? COLORS.green : COLORS.card,
                color: category === c.value ? 'white' : COLORS.textMuted,
                border: `1px solid ${category === c.value ? COLORS.green : COLORS.border}`,
              }}>
              {c.label}
            </div>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with the FarmLite community..."
          rows={6}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${COLORS.border}`,
            fontSize: '14px', boxSizing: 'border-box', background: COLORS.card, resize: 'none', color: COLORS.text,
          }}
        />

        {imagePreview ? (
          <div style={{ position: 'relative', marginTop: '12px' }}>
            <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '14px' }} />
            <div onClick={removeImage} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '14px', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="close" size={14} color="white" />
            </div>
          </div>
        ) : (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px',
            padding: '14px', borderRadius: '14px', border: `1.5px dashed ${COLORS.border}`, cursor: 'pointer', color: COLORS.textMuted,
          }}>
            <Icon name="camera" size={18} color={COLORS.textMuted} />
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Add a photo (optional)</span>
            <input type="file" accept="image/*" onChange={handlePickImage} style={{ display: 'none' }} />
          </label>
        )}
      </div>
    </div>
  )
}
