import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { COLORS } from './shared'
import { VIDEO_SELECT } from './videoShared'
import type { VideoRow } from './videoShared'

// A strip of short videos placed deep in the Home feed. It loads only when it is about to be seen,
// and shows nothing when there are no videos or the request fails. Tapping a video opens the Videos page on it.
export default function VideoHook() {
  const navigate = useNavigate()
  const holder = useRef<HTMLDivElement>(null)
  const [videos, setVideos] = useState<VideoRow[] | null>(null)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    let alive = true
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      supabase.from('short_videos').select(VIDEO_SELECT).eq('status', 'active').eq('is_hidden_by_admin', false)
        .order('created_at', { ascending: false }).limit(8)
        .then(({ data, error }: { data: any; error: any }) => { if (alive) setVideos(error ? [] : ((data || []) as VideoRow[])) })
    }, { rootMargin: '500px 0px' })
    io.observe(el)
    return () => { alive = false; io.disconnect() }
  }, [])

  const list = (videos || []).filter((v) => !!v.thumbnail_url)

  return (
    <div ref={holder}>
      {list.length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px 0 12px', margin: '0 0 12px', border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Watch short videos</p>
            <span onClick={() => navigate('/videos')} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>Watch more</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 14px 2px', scrollbarWidth: 'none' }}>
            {list.map((v) => (
              <div key={v.id} onClick={() => navigate(`/videos/${v.id}`)} role="button" style={{ position: 'relative', flex: '0 0 112px', height: 180, borderRadius: '12px', overflow: 'hidden', background: '#111', cursor: 'pointer' }}>
                <img src={v.thumbnail_url as string} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0) 55%)' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                </div>
                <div style={{ position: 'absolute', left: 8, right: 8, bottom: 7 }}>
                  <p style={{ margin: 0, color: 'white', fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.profiles?.full_name || v.profiles?.username || 'Farmxie'}</p>
                  <p style={{ margin: '1px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '10.5px' }}>{v.views_count.toLocaleString()} {v.views_count === 1 ? 'view' : 'views'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
