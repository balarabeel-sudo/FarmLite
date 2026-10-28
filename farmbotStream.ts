import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseClient'

// Talks to the FarmBot function with a live stream, so the answer appears while it is being written.
// The function sends small events: meta, status, delta, done, error.

export type StreamExtras = {
  items: { type: 'marketplace' | 'equipment' | 'company'; id: string; title: string; subtitle: string; image: string | null; path: string }[]
  farm_desk: boolean
  farm_desk_request?: string | null
  weather?: WeatherData
}

export type WeatherData = {
  place: string
  approximate: boolean
  now: { temp: number | null; condition: string } | null
  days: { date: string; weekday: string; condition: string; tmax: number | null; tmin: number | null; rain_prob: number | null; rain_mm: number | null }[]
}

export type DonePayload = {
  reply: string
  conversation_id: string
  usage?: { used: number; limit: number; premium: boolean; photos?: number } | null
  extras?: StreamExtras | null
  incomplete?: boolean
}

export type StreamResult =
  // The answer is complete and saved
  | { kind: 'done'; data: DonePayload }
  // The server refused or failed (limits, photos, busy...). `code` and `error` are the same as before.
  | { kind: 'error'; code?: string; error: string; usage?: DonePayload['usage']; started: boolean }
  // No connection at all, nothing was sent
  | { kind: 'network' }
  // The connection dropped after the answer had started; `conversationId` lets the page check what was saved
  | { kind: 'interrupted'; conversationId: string | null }

type Handlers = {
  onDelta: (text: string) => void
  onStatus: (text: string) => void
}

export async function streamFarmbot(body: Record<string, unknown>, h: Handlers): Promise<StreamResult> {
  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token || ''
  } catch { /* handled below */ }
  if (!token) return { kind: 'error', error: 'Please sign in again.', started: false }

  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/farmbot-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ ...body, stream: true }),
    })
  } catch {
    return { kind: 'network' }
  }

  const type = res.headers.get('content-type') || ''
  if (!type.includes('text/event-stream') || !res.body) {
    // Plain JSON: a refusal (limit, photos, paused) or an error that happened before the answer started
    let j: any = null
    try { j = await res.json() } catch { /* ignore */ }
    if (j && j.reply && res.ok) return { kind: 'done', data: j as DonePayload }
    return { kind: 'error', code: j?.code, error: j?.error || 'Something went wrong. Please try again.', usage: j?.usage ?? null, started: false }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let convId: string | null = null
  let started = false
  let result: StreamResult | null = null

  const handle = (raw: string) => {
    let e: any
    try { e = JSON.parse(raw) } catch { return }
    if (e.t === 'meta') convId = e.conversation_id || null
    else if (e.t === 'status') h.onStatus(String(e.text || ''))
    else if (e.t === 'delta') { started = true; h.onDelta(String(e.text || '')) }
    else if (e.t === 'done') { const { t: _t, ...rest } = e; result = { kind: 'done', data: rest as DonePayload } }
    else if (e.t === 'error') result = { kind: 'error', code: e.code, error: e.error || 'Something went wrong. Please try again.', started }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        const line = block.split('\n').find((l) => l.startsWith('data:'))
        if (line) handle(line.slice(5).trim())
      }
    }
  } catch {
    /* the connection dropped; handled below */
  }

  if (result) return result
  return { kind: 'interrupted', conversationId: convId }
}
