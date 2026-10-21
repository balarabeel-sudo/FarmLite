import { useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Icon from './Icons'
import ImageUploader from './ImageUploader'
import { COLORS, inputStyle, ErrorBanner } from './shared'

const CLOSE_CHOICES: { label: string; hours: number | null }[] = [
  { label: 'No end time', hours: null },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
]

// "Share something with this group..." — text/photo post or a poll. Only shown to members; the database enforces it too.
export default function GroupComposer({ groupId, avatar, onPosted, defaultMode = 'post' }: { groupId: string; avatar: string | null; onPosted: () => void; defaultMode?: 'post' | 'poll' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'post' | 'poll'>('post')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [closeHours, setCloseHours] = useState<number | null>(null)

  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setContent(''); setImages([]); setQuestion(''); setDescription(''); setOptions(['', '']); setMultiple(false); setCloseHours(null)
    setError(''); setMode('post'); setOpen(false)
  }

  const submitPost = async () => {
    if (!user || posting || uploading) return
    const text = content.trim()
    if (!text && images.length === 0) { setError('Write something or add a photo.'); return }
    setPosting(true); setError('')
    const { error: e } = await supabase.from('posts').insert({
      user_id: user.id, community_id: groupId, category: 'general', content: text,
      images: images.length ? images : null, visibility: 'public',
    })
    setPosting(false)
    if (e) { setError('Could not post. Only group members can post in this group.'); return }
    reset(); onPosted()
  }

  const submitPoll = async () => {
    if (posting) return
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (question.trim().length < 3) { setError('Enter a poll question.'); return }
    if (opts.length < 2) { setError('Add at least 2 answer options.'); return }
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) { setError('Poll options must be different.'); return }
    setPosting(true); setError('')
    const closesAt = closeHours ? new Date(Date.now() + closeHours * 3600 * 1000).toISOString() : null
    const { error: e } = await supabase.rpc('group_create_poll', {
      p_community: groupId, p_question: question.trim(), p_description: description.trim() || null,
      p_options: opts, p_multiple: multiple, p_closes_at: closesAt,
    })
    setPosting(false)
    if (e) { setError(e.message); return }
    reset(); onPosted()
  }

  if (!open) {
    return (
      <div style={{ background: COLORS.card, borderRadius: '16px', padding: '12px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--fx-tint-green)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="users" size={16} color={COLORS.green} />}
        </div>
        <div role="button" tabIndex={0} onClick={() => { setMode(defaultMode); setOpen(true) }} onKeyDown={(e) => { if (e.key === 'Enter') { setMode(defaultMode); setOpen(true) } }}
          style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, fontSize: '12.5px', color: COLORS.textMuted, cursor: 'text' }}>
          Share something with this group...
        </div>
        <div role="button" aria-label="Create poll" onClick={() => { setMode('poll'); setOpen(true) }}
          style={{ padding: '8px 10px', borderRadius: '10px', background: 'var(--fx-tint-green3)', color: COLORS.green, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>Poll</div>
      </div>
    )
  }

  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '14px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['post', 'poll'] as const).map((m) => (
          <div key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError('') }}
            style={{ padding: '6px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: mode === m ? COLORS.green : COLORS.bg, color: mode === m ? 'white' : COLORS.textMuted, border: `1px solid ${mode === m ? COLORS.green : COLORS.border}` }}>
            {m === 'post' ? 'Post' : 'Poll'}
          </div>
        ))}
      </div>

      <ErrorBanner text={error} />

      {mode === 'post' ? (
        <>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} rows={4} autoFocus
            placeholder="Share something with this group..." aria-label="Post text" style={{ ...inputStyle, resize: 'none' }} />
          <ImageUploader value={images} onChange={setImages} folder="posts" max={4} onBusyChange={setUploading} />
        </>
      ) : (
        <>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Ask a question, e.g. Which crop are you planting this season?" aria-label="Poll question" style={inputStyle} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} placeholder="Add a description (optional)" aria-label="Poll description" style={{ ...inputStyle, resize: 'none' }} />
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={o} onChange={(e) => setOptions((prev) => prev.map((x, j) => j === i ? e.target.value : x))} maxLength={100} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} style={inputStyle} />
              {options.length > 2 && (
                <div role="button" aria-label="Remove option" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} style={{ marginBottom: '10px', cursor: 'pointer', display: 'flex' }}>
                  <Icon name="close" size={16} color={COLORS.textMuted} />
                </div>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <div role="button" onClick={() => setOptions((prev) => [...prev, ''])} style={{ fontSize: '12px', fontWeight: 700, color: COLORS.green, cursor: 'pointer', marginBottom: '12px' }}>+ Add option</div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, flexShrink: 0 }}>Voting</p>
            {[false, true].map((m) => (
              <div key={String(m)} role="radio" aria-checked={multiple === m} onClick={() => setMultiple(m)}
                style={{ padding: '5px 12px', borderRadius: '14px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: multiple === m ? 'var(--fx-tint-green)' : COLORS.bg, color: multiple === m ? 'var(--fx-green-dark)' : COLORS.textMuted, border: `1px solid ${multiple === m ? COLORS.green : COLORS.border}` }}>
                {m ? 'Multiple choice' : 'Single choice'}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Poll closes</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {CLOSE_CHOICES.map((c) => (
              <div key={c.label} role="radio" aria-checked={closeHours === c.hours} onClick={() => setCloseHours(c.hours)}
                style={{ padding: '5px 12px', borderRadius: '14px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: closeHours === c.hours ? 'var(--fx-tint-green)' : COLORS.bg, color: closeHours === c.hours ? 'var(--fx-green-dark)' : COLORS.textMuted, border: `1px solid ${closeHours === c.hours ? COLORS.green : COLORS.border}` }}>
                {c.label}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <div role="button" onClick={posting ? undefined : reset} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Cancel</div>
        <div role="button" onClick={mode === 'post' ? submitPost : submitPoll}
          style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.green, fontSize: '12.5px', fontWeight: 700, color: 'white', cursor: 'pointer', opacity: posting || uploading ? 0.6 : 1 }}>
          {posting ? 'Posting...' : uploading ? 'Uploading...' : mode === 'post' ? 'Post' : 'Create poll'}
        </div>
      </div>
    </div>
  )
}
