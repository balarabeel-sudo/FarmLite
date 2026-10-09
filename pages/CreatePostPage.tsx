import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import ImageUploader from '../ImageUploader'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type OwnedCompany = { id: string; name: string; logo_url: string | null }

const CATEGORIES: { value: 'general' | 'crop' | 'livestock' | 'tips'; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'crop', label: 'Crop' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'tips', label: 'Tips' },
]

// Route: /create  (normal post), /create?community=<id>  (post inside a group)
// or /create?company=<id>  (post as one of your companies)
export default function CreatePostPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const communityId = searchParams.get('community')
  const companyParam = searchParams.get('company')

  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'general' | 'crop' | 'livestock' | 'tips'>('general')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [communityName, setCommunityName] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<OwnedCompany[]>([])
  const [postAs, setPostAs] = useState<string>('me') // 'me' or a company id

  useEffect(() => {
    if (!user || communityId) return
    supabase
      .from('companies')
      .select('id, name, logo_url')
      .eq('owner_id', user.id)
      .eq('status', 'verified')
      .order('name')
      .then(({ data }) => {
        const list = (data || []) as OwnedCompany[]
        setCompanies(list)
        if (companyParam && list.some((c) => c.id === companyParam)) setPostAs(companyParam)
      })
  }, [user, communityId, companyParam])

  useEffect(() => {
    if (!communityId) return
    supabase.from('communities').select('name').eq('id', communityId).maybeSingle().then(({ data }) => {
      if (data) setCommunityName(data.name)
    })
  }, [communityId])

  const activeCompany = companies.find((c) => c.id === postAs) || null

  const canPost = !!content.trim() && !posting && !uploading

  const handlePost = async () => {
    if (!user || !canPost) return
    setError('')
    setPosting(true)

    const { error: insertError } = await supabase.from('posts').insert({
      user_id: user.id,
      community_id: communityId || null,
      company_id: !communityId && activeCompany ? activeCompany.id : null,
      category,
      content: content.trim(),
      images: images.length > 0 ? images : null,
      visibility: 'public',
    })

    setPosting(false)

    if (insertError) {
      setError(
        communityId
          ? 'Could not post. Only group members can post in a group.'
          : 'Could not publish your post. Please try again.',
      )
      return
    }

    navigate(
      communityId ? `/communities/${communityId}` : activeCompany ? `/companies/${activeCompany.id}` : '/',
      { replace: true },
    )
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
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
            {activeCompany ? 'New Company Post' : 'New Post'}
          </p>
        </div>
        <div
          onClick={canPost ? handlePost : undefined}
          style={{
            padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'white',
            background: COLORS.green, cursor: canPost ? 'pointer' : 'default', opacity: canPost ? 1 : 0.5,
          }}>
          {posting ? 'Posting...' : uploading ? 'Uploading...' : 'Post'}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {communityId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DCFCE7', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <Icon name="users" size={15} color={COLORS.green} />
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>Posting in {communityName || 'group'}</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11.5px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        {!communityId && companies.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>Post as</p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {[{ id: 'me', name: 'Myself', logo_url: null as string | null }, ...companies].map((o) => {
                const active = postAs === o.id
                return (
                  <div
                    key={o.id}
                    onClick={() => setPostAs(o.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px 6px 6px', borderRadius: '999px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      background: active ? '#DCFCE7' : COLORS.card,
                      border: `1px solid ${active ? COLORS.green : COLORS.border}`,
                    }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', background: COLORS.green,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 800,
                    }}>
                      {o.logo_url
                        ? <img src={o.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : o.name.charAt(0).toUpperCase()}
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{o.name}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto' }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                padding: '7px 14px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
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
          placeholder={
            communityId
              ? 'Share something with the group...'
              : activeCompany
                ? `Share an update from ${activeCompany.name}...`
                : 'Share something with the Farmxie community...'
          }
          rows={6}
          maxLength={2000}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${COLORS.border}`,
            fontSize: '14px', boxSizing: 'border-box', background: COLORS.card, resize: 'none', color: COLORS.text,
          }}
        />

        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '14px 0 8px' }}>Photos (optional)</p>
        <ImageUploader value={images} onChange={setImages} folder="posts" max={4} onBusyChange={setUploading} />
      </div>
    </div>
  )
}
