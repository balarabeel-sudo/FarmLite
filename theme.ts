// Light / Dark / System theme. The colors live in CSS variables (see index.html);
// this file only decides which set is active and remembers the choice on this device.
import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'farmxie-theme'
const BAR_LIGHT = '#16A34A'
const BAR_DARK = '#0B100C'

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* storage blocked */ }
  return 'light'
}

let mode: ThemeMode = read()
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function resolveTheme(m: ThemeMode = mode): 'light' | 'dark' {
  if (m === 'system') return media && media.matches ? 'dark' : 'light'
  return m
}

export function applyTheme() {
  if (typeof document === 'undefined') return
  const t = resolveTheme()
  const root = document.documentElement
  root.setAttribute('data-theme', t)
  root.style.colorScheme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'dark' ? BAR_DARK : BAR_LIGHT)
}

export function setThemeMode(next: ThemeMode) {
  mode = next
  try { localStorage.setItem(KEY, next) } catch { /* storage blocked */ }
  applyTheme()
  listeners.forEach((l) => l())
}

export function initTheme() {
  applyTheme()
  if (!media) return
  const onChange = () => { if (mode === 'system') { applyTheme(); listeners.forEach((l) => l()) } }
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange)
  else if (typeof (media as any).addListener === 'function') (media as any).addListener(onChange)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, () => mode, () => mode)
}
