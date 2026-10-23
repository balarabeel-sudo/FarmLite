import { supabase } from './supabaseClient'

// Sends crashes and unexpected errors to the Health Center so staff see problems before users complain.
// Reporting must never break the app: every step is wrapped and failures are ignored.

const recent = new Map<string, number>()
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i, /Non-Error promise rejection/i]

export function reportError(kind: string, error: unknown, extra?: string) {
  try {
    const e = error as { message?: string; stack?: string } | string | null
    const message = (typeof e === 'string' ? e : e?.message || extra || 'Unknown error').toString()
    if (IGNORED.some((r) => r.test(message))) return
    const stack = typeof e === 'object' && e?.stack ? String(e.stack) : extra || ''
    // The same error is sent at most once every 10 seconds from one browser
    const key = `${kind}|${message}`
    const now = Date.now()
    if (now - (recent.get(key) || 0) < 10000) return
    recent.set(key, now)
    if (recent.size > 100) recent.clear()
    void Promise.resolve(
      supabase.rpc('log_client_error', {
        p_kind: kind,
        p_message: message,
        p_stack: stack,
        p_route: location.pathname,
        p_user_agent: navigator.userAgent,
      }),
    ).catch(() => {})
  } catch {
    /* never throw from the reporter */
  }
}

export function initErrorReporting() {
  window.addEventListener('error', (ev) => {
    reportError('js_error', ev.error || ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    reportError('promise', ev.reason)
  })
}
