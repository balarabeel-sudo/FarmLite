import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

// Pull down from the top of a list page to refresh it. Shows a small round spinner (like Chrome),
// not the logo, and refreshes the page content in place without reloading the whole app.
// Only list-style pages take part, so a pull can never wipe a form that someone is filling in.

const ENABLED_PATHS = ['/', '/marketplace', '/companies', '/communities', '/equipment', '/notifications', '/saved']
const TRIGGER_PX = 72
const MAX_PULL_PX = 110
const GREEN = '#16A34A'

function hasScrolledAncestor(el: Element | null): boolean {
  let node: Element | null = el
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const scrollable = /(auto|scroll)/.test(style.overflowY)
    if (scrollable && node.scrollHeight > node.clientHeight && node.scrollTop > 0) return true
    node = node.parentElement
  }
  return false
}

export default function PullToRefresh({ children }: { children: (refreshKey: number) => ReactNode }) {
  const { pathname } = useLocation()
  const enabled = ENABLED_PATHS.includes(pathname)

  const [refreshKey, setRefreshKey] = useState(0)
  const [pull, setPull] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)
  const busy = useRef(false)

  // The browser's own pull-to-refresh (which reloads the whole app) is turned off
  useEffect(() => {
    if (!enabled) return
    const prev = document.documentElement.style.overscrollBehaviorY
    document.documentElement.style.overscrollBehaviorY = 'contain'
    return () => { document.documentElement.style.overscrollBehaviorY = prev }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const onStart = (e: TouchEvent) => {
      startY.current = null
      if (busy.current || e.touches.length !== 1) return
      if (window.scrollY > 0 || document.body.style.overflow === 'hidden') return
      const target = e.target as Element | null
      if (target && target.closest('input, textarea, select, [contenteditable="true"], video')) return
      if (hasScrolledAncestor(target)) return
      startY.current = e.touches[0].clientY
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || busy.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) { pullRef.current = 0; setPull(0) }
        return
      }
      const eased = Math.min(MAX_PULL_PX, dy * 0.5)
      pullRef.current = eased
      setPull(eased)
    }

    const onEnd = () => {
      if (startY.current === null) return
      startY.current = null
      const reached = pullRef.current >= TRIGGER_PX * 0.5 * 1.4
      pullRef.current = 0
      if (!reached || busy.current) { setPull(0); return }
      busy.current = true
      setSpinning(true)
      setPull(TRIGGER_PX * 0.7)
      setRefreshKey((k) => k + 1)
      window.setTimeout(() => {
        busy.current = false
        setSpinning(false)
        setPull(0)
      }, 900)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled])

  const show = enabled && (pull > 4 || spinning)
  const progress = Math.min(1, pull / (TRIGGER_PX * 0.7))

  return (
    <>
      {show && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: '50%', zIndex: 9000,
            width: '38px', height: '38px', marginLeft: '-19px', borderRadius: '19px', background: 'var(--fx-card)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translateY(${Math.max(0, pull - 20)}px)`, opacity: spinning ? 1 : Math.max(0.25, progress),
            transition: spinning ? 'transform .2s ease-out' : 'none', pointerEvents: 'none',
          }}>
          <style>{`@keyframes ptrSpin { to { transform: rotate(360deg) } }`}</style>
          <svg
            width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"
            style={{ animation: spinning ? 'ptrSpin .7s linear infinite' : 'none', transform: spinning ? undefined : `rotate(${progress * 300}deg)` }}>
            <path d="M21 12a9 9 0 1 1-6.2-8.55" />
          </svg>
        </div>
      )}
      {children(refreshKey)}
    </>
  )
}
