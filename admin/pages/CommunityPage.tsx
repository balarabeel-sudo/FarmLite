import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

// UI-only screen: everything below runs on local mock data so the layout and every
// interaction state can be reviewed before the backend is connected.
// Set MOCK_ENABLED to false to preview the "no community activity yet" empty state.
const MOCK_ENABLED = true

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441',
  red: '#B91C1C',
}

type PostType = 'Post' | 'Discussion' | 'Announcement' | 'Question' | 'Poll'
type Status = 'Published' | 'Under Review' | 'Hidden' | 'Flagged'
type Report = { reason: string; by: string; at: number }
type HistoryEntry = { action: string; by: string; at: number; note?: string }
type Author = { name: string; handle: string; role: string; since: string; posts: number }
type Item = {
  id: string; body: string; author: Author; type: PostType
  likes: number; comments: number; shares: number; views: number
  reports: Report[]; resolved: boolean; status: Status
  createdAt: number; image: boolean; history: HistoryEntry[]
}
type Filters = { type: string; status: string; range: string; engagement: string; reportStatus: string }

const NOW = Date.now()
const H = 3600 * 1000
const ago = (h: number) => NOW - h * H

const AUTHORS: Record<string, Author> = {
  aminu: { name: 'Aminu Garba', handle: '@aminu.garba', role: 'Farmer', since: 'Mar 2026', posts: 48 },
  hauwa: { name: 'Hauwa Bello', handle: '@hauwa_b', role: 'Agribusiness', since: 'Jan 2026', posts: 112 },
  chidi: { name: 'Chidi Okafor', handle: '@chidi.farms', role: 'Farmer', since: 'Apr 2026', posts: 31 },
  fatima: { name: 'Fatima Sani', handle: '@fatimasani', role: 'Agronomist', since: 'Dec 2025', posts: 204 },
  yusuf: { name: 'Yusuf Danjuma', handle: '@yusuf_d', role: 'Farmer', since: 'May 2026', posts: 17 },
  ngozi: { name: 'Ngozi Eze', handle: '@ngozi.eze', role: 'Buyer', since: 'Jun 2026', posts: 9 },
  ibrahim: { name: 'Ibrahim Musa', handle: '@ibrahimmusa', role: 'Farmer', since: 'Feb 2026', posts: 63 },
  team: { name: 'Farmxie Team', handle: '@farmxie', role: 'Official', since: 'Nov 2025', posts: 36 },
  samuel: { name: 'Samuel Adeyemi', handle: '@sam.adeyemi', role: 'Equipment dealer', since: 'Jul 2026', posts: 22 },
  zainab: { name: 'Zainab Lawal', handle: '@zainab_l', role: 'Farmer', since: 'Aug 2026', posts: 5 },
}

type Extra = [string, string, number, string?]
function mk(
  n: number, body: string, who: string, type: PostType,
  stats: [number, number, number, number], reasons: string[], status: Status,
  hoursAgo: number, opts: { image?: boolean; resolved?: boolean; extra?: Extra[] } = {},
): Item {
  const author = AUTHORS[who]
  const reports = reasons.map((reason, i) => ({ reason, by: `@user${300 + n + i}`, at: ago(Math.max(hoursAgo - 1 - i, 0.2)) }))
  const history: HistoryEntry[] = [{ action: 'Posted', by: author.name, at: ago(hoursAgo) }]
  reports.forEach((r) => history.push({ action: 'Reported', by: r.by, at: r.at, note: r.reason }))
  ;(opts.extra || []).forEach(([action, by, h, note]) => history.push({ action, by, at: ago(h), note }))
  history.sort((a, b) => b.at - a.at)
  return {
    id: `CP-${100200 + n}`, body, author, type,
    likes: stats[0], comments: stats[1], shares: stats[2], views: stats[3],
    reports, resolved: opts.resolved ?? false, status, createdAt: ago(hoursAgo),
    image: !!opts.image, history,
  }
}

const SEED: Item[] = MOCK_ENABLED ? [
  mk(34, 'Maize prices in Kano market have gone up again this week. Bags that sold at 38,000 last month are now going for 44,500. Anyone else seeing this in Katsina or Kaduna? Trying to decide whether to hold my harvest for two more weeks.', 'aminu', 'Discussion', [64, 27, 6, 1480], [], 'Published', 1.5),
  mk(33, 'Invest 50,000 with me and get 200,000 back in one week. Guaranteed farm returns. Message me on WhatsApp now, only 10 slots left!', 'zainab', 'Post', [2, 1, 0, 340], ['Spam or scam', 'Spam or scam', 'Misleading information'], 'Flagged', 3),
  mk(32, 'Rainy season planting guide: when to sow maize, millet and sorghum across the northern zones, and what soil moisture to look for before you plant.', 'team', 'Announcement', [318, 41, 96, 9120], [], 'Published', 6, { image: true }),
  mk(31, 'My tomato leaves are curling and turning yellow from the edges. The fruits are still small. Is this blight or a nutrient problem? Photo attached.', 'chidi', 'Question', [12, 19, 1, 610], [], 'Published', 8, { image: true }),
  mk(30, 'Which crop will you prioritise this season? Voting closes Sunday.', 'hauwa', 'Poll', [47, 33, 4, 1190], [], 'Published', 11),
  mk(29, 'Those who sell fertiliser at the roadside are all thieves. Do not buy from the people in Zaria, I will expose all of them with their phone numbers.', 'yusuf', 'Post', [5, 14, 0, 520], ['Harassment', 'Harassment'], 'Under Review', 14, { extra: [['Sent for review', 'System', 13.5, 'Reported twice within an hour']] }),
  mk(28, 'Poultry vaccination schedule that worked for my 800-bird farm: Newcastle at day 7, Gumboro at day 14 and day 21, booster at week 6. Happy to answer questions.', 'fatima', 'Post', [152, 38, 44, 4270], [], 'Published', 20),
  mk(27, 'Looking for a used 50HP tractor in good condition around Kaduna. Budget is flexible for the right machine. Please send photos and location.', 'ibrahim', 'Question', [9, 11, 2, 430], [], 'Published', 26),
  mk(26, 'Selling premium seed yam, 300 tubers ready. Delivery anywhere in the country, payment on delivery. Text me directly to avoid the marketplace fee.', 'ngozi', 'Post', [3, 2, 0, 275], ['Off-topic', 'Spam or scam'], 'Flagged', 30, { extra: [['Auto-flagged', 'System', 29.5, 'Contains a request to move payment off-platform']] }),
  mk(25, 'Drip irrigation cut my water use by almost half on two hectares of pepper. Setup cost was recovered in a single season. Full breakdown in the comments.', 'fatima', 'Discussion', [221, 62, 58, 6840], [], 'Published', 36, { image: true }),
  mk(24, 'Weekly community guidelines reminder: keep discussions respectful, no pricing offers outside the marketplace, and report anything that looks like a scam.', 'team', 'Announcement', [96, 7, 21, 3980], [], 'Published', 48),
  mk(23, 'Anybody know where to rent a combine harvester near Minna? Harvest starts in about three weeks.', 'samuel', 'Question', [6, 8, 0, 360], [], 'Published', 55),
  mk(22, 'The new price comparison tool in Farmxie is useless and the team is lying about how it works. Whoever built it should be sacked.', 'yusuf', 'Post', [1, 6, 0, 210], ['Harassment'], 'Hidden', 60, { resolved: true, extra: [['Hidden', 'Aisha Mohammed', 58, 'Targeted abuse of named staff']] }),
  mk(21, 'Cassava mosaic is spreading in our area. Resistant varieties TME 419 and TMS 30572 are holding up well so far. Sharing in case it helps neighbours.', 'chidi', 'Post', [88, 16, 25, 2410], [], 'Published', 72),
  mk(20, 'Sorghum or millet for sandy soil with low rainfall? I have 4 hectares and 600mm average annual rain.', 'ibrahim', 'Question', [14, 23, 3, 780], [], 'Published', 80),
  mk(19, 'Free training: organic composting for smallholders. Saturday 10am at the Zaria cooperative hall. Bring your own bag, lunch is provided.', 'hauwa', 'Announcement', [74, 12, 31, 2150], ['Misleading information'], 'Published', 96, { resolved: true, extra: [['Report reviewed', 'Aisha Mohammed', 90, 'Event details confirmed, kept published']] }),
  mk(18, 'Did anyone get the subsidised fertiliser allocation this month? Our cooperative has been waiting for six weeks.', 'aminu', 'Discussion', [39, 44, 5, 1630], [], 'Published', 110),
  mk(17, 'Choose the storage method you trust most for grain after harvest.', 'fatima', 'Poll', [58, 29, 7, 1740], [], 'Published', 130),
  mk(16, 'Buy cheap pesticide here, no registration number needed, works on everything including banned products. Pickup in Kano only.', 'zainab', 'Post', [0, 0, 0, 190], ['Inappropriate content', 'Spam or scam', 'Misleading information', 'Spam or scam'], 'Hidden', 150, { resolved: true, extra: [['Hidden', 'Aisha Mohammed', 148, 'Sale of unregistered agrochemicals']] }),
  mk(15, 'Harvest day on the farm today. 18 tonnes of groundnut from six hectares, up from 14 last year after switching to improved seed.', 'yusuf', 'Post', [133, 21, 18, 3350], [], 'Published', 170, { image: true }),
  mk(14, 'Soil testing results came back with pH 5.2. What is the safest way to raise it before planting maize?', 'ngozi', 'Question', [10, 17, 1, 540], [], 'Published', 190),
  mk(13, 'Goat feed mix that cut my feed cost by 30 percent: groundnut haulms, maize bran, a little cottonseed cake and mineral lick. Details below.', 'samuel', 'Post', [67, 13, 14, 1980], [], 'Published', 220),
  mk(12, 'Reminder: Farmxie will never ask for your password or bank details in a message. Report any account that does.', 'team', 'Announcement', [201, 9, 88, 7420], [], 'Published', 260),
  mk(11, 'How are you handling the armyworm outbreak this season? Sharing what has worked for us and what has not.', 'aminu', 'Discussion', [92, 51, 17, 3010], [], 'Published', 300),
  mk(10, 'Wanted: reliable supplier of improved cowpea seed, 2 tonnes per month. Serious sellers only.', 'hauwa', 'Post', [18, 7, 3, 690], [], 'Published', 340),
  mk(9, 'Best time of day to spray herbicide on maize to avoid drift and leaf burn?', 'chidi', 'Question', [8, 12, 0, 410], [], 'Published', 400),
  mk(8, 'Small update from our greenhouse trial: lettuce and spinach are growing well at 28 degrees with shade netting. Photos coming soon.', 'fatima', 'Post', [45, 6, 5, 1120], [], 'Published', 460, { image: true }),
  mk(7, 'Is anyone using solar pumps for dry-season farming? Looking for honest feedback on cost and maintenance.', 'ibrahim', 'Discussion', [51, 28, 9, 1560], [], 'Published', 540),
  mk(6, 'What would you like Farmxie to build next?', 'team', 'Poll', [143, 86, 12, 4890], [], 'Published', 620),
] : []

const TYPES: PostType[] = ['Post', 'Discussion', 'Announcement', 'Question', 'Poll']
const STATUSES: Status[] = ['Published', 'Under Review', 'Hidden', 'Flagged']
const NO_FILTERS: Filters = { type: 'all', status: 'all', range: 'all', engagement: 'all', reportStatus: 'all' }
const ROWS = [10, 25, 50]

const score = (i: Item) => i.likes + i.comments * 2 + i.shares * 3
const level = (i: Item) => { const s = score(i); return s === 0 ? 'none' : s < 20 ? 'low' : s < 100 ? 'medium' : 'high' }
const needsAttention = (i: Item) => i.status === 'Flagged' || i.status === 'Under Review'

function relative(ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}
const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const initials = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

function pageList(cur: number, total: number): (number | '…')[] {
  const keep = new Set([1, total, cur - 1, cur, cur + 1])
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

const ICONS: Record<string, string> = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  eye: 'M2 12s3.5-7 10 -7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 7.6A17 17 0 002 12s3.5 6 10 6a10 10 0 004.2-.9M9.9 9.9a3 3 0 004.2 4.2',
  restore: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  message: 'M21 12a8 8 0 01-11.5 7.2L4 20l1.2-4.3A8 8 0 1121 12z',
  share: 'M15 4l6 6-6 6M21 10H9a6 6 0 00-6 6v3',
  image: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM21 16l-5-5-9 9',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-5 6-8 10-10',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
}
function Icon({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  if (name === 'more') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: A.greenTint, color: A.greenDark, border: `1px solid #D3EBDA`, fontSize: size * 0.38, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials(name)}
    </span>
  )
}

const STATUS_STYLE: Record<Status, { bg: string; color: string; dot: string }> = {
  Published: { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  'Under Review': { bg: '#E8F0FE', color: '#1E40AF', dot: '#3B6FD4' },
  Hidden: { bg: '#F1F3F1', color: '#4B5563', dot: '#9AA39B' },
  Flagged: { bg: A.amberChip, color: A.amber, dot: A.amberLine },
}
function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status === 'Flagged' ? <Icon name="flag" size={11} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />}
      {status}
    </span>
  )
}
function TypeChip({ type }: { type: PostType }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${A.border}`, color: '#374151', background: A.surface, whiteSpace: 'nowrap' }}>{type}</span>
}
function Stat({ icon, value }: { icon: string; value: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: A.textMuted, fontSize: 12 }}>
      <Icon name={icon} size={13} />{compact(value)}
    </span>
  )
}

const CSS = `
.cm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.cm-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; padding-top:7px; }
.cm-tools { display:flex; gap:10px; align-items:center; position:relative; }
.cm-search { position:relative; width:320px; }
.cm-search input { width:100%; box-sizing:border-box; padding:9px 32px 9px 34px; border-radius:8px; border:1px solid ${A.border}; font-size:12.5px; background:${A.surface}; color:${A.text}; }
.cm-stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
.cm-list { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; }
.cm-table-wrap { overflow-x:auto; }
.cm-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:980px; }
.cm-table th { padding:10px 14px; font-size:11.5px; font-weight:700; color:${A.textMuted}; text-align:left; background:${A.bg}; border-bottom:1px solid ${A.border}; white-space:nowrap; }
.cm-table td { padding:12px 14px; border-bottom:1px solid ${A.borderSoft}; vertical-align:middle; }
.cm-row { cursor:pointer; }
.cm-row:hover { background:#FAFBFA; }
.cm-row.attn { background:${A.amberBg}; }
.cm-row.attn:hover { background:#FFF7DD; }
.cm-row.attn td:first-child { box-shadow: inset 3px 0 0 ${A.amberLine}; }
.cm-clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.45; color:${A.text}; }
.cm-cards { display:none; }
.cm-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:8px 14px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; }
.cm-btn:hover { background:${A.bg}; }
.cm-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.cm-btn.primary:hover { background:#15803D; }
.cm-btn.danger { color:${A.red}; }
.cm-btn.danger:hover { background:#FEF2F2; }
.cm-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.cm-btn.solid-danger:hover { background:#991B1B; }
.cm-icon-btn { font-family:inherit; cursor:pointer; width:30px; height:30px; border-radius:7px; border:1px solid transparent; background:transparent; color:${A.textMuted}; display:inline-flex; align-items:center; justify-content:center; }
.cm-icon-btn:hover { background:${A.bg}; border-color:${A.border}; color:${A.text}; }
.cm-menu-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; text-align:left; border-radius:6px; }
.cm-menu-item:hover:not(:disabled) { background:${A.bg}; }
.cm-menu-item:disabled { color:${A.textSoft}; cursor:default; }
.cm-menu-item.danger { color:${A.red}; }
.cm-select { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid ${A.border}; background:${A.surface}; font-size:12.5px; color:${A.text}; font-family:inherit; }
.cm-page { min-width:30px; height:30px; padding:0 8px; border-radius:7px; border:1px solid transparent; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:${A.text}; cursor:pointer; }
.cm-page:hover:not(:disabled) { background:${A.bg}; border-color:${A.border}; }
.cm-page.on { background:${A.greenTint}; border-color:#BFE3CA; color:${A.greenDark}; font-weight:800; }
.cm-page:disabled { color:${A.textSoft}; cursor:default; }
.cm-foot { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid ${A.border}; }
.cm-drawer { position:fixed; top:0; right:0; bottom:0; width:500px; max-width:100%; background:${A.surface}; z-index:61; display:flex; flex-direction:column; box-shadow:-8px 0 28px rgba(15,26,18,0.12); animation:cm-in .18s ease-out; }
@keyframes cm-in { from { transform:translateX(24px); opacity:0; } to { transform:none; opacity:1; } }
.cm-card { padding:14px; border-bottom:1px solid ${A.borderSoft}; }
.cm-card.attn { background:${A.amberBg}; box-shadow: inset 3px 0 0 ${A.amberLine}; }
.cm-card:last-child { border-bottom:none; }
button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:1100px) { .cm-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:960px) {
  .cm-table-wrap { display:none; }
  .cm-cards { display:block; }
}
@media (max-width:720px) {
  .cm-tools { width:100%; }
  .cm-search { flex:1; width:auto; }
}
@media (max-width:480px) { .cm-stats { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .cm-drawer { animation:none; } }
`

type MenuState = { id: string; x: number; y: number; up: boolean } | null
type DrawerState = { id: string; mode: 'view' | 'review' | 'reports' } | null

export default function CommunityPage() {
  const staff = useStaff()
  const [items, setItems] = useState<Item[]>(SEED)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [menu, setMenu] = useState<MenuState>(null)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const reportsRef = useRef<HTMLDivElement | null>(null)

  const activeCount = (Object.keys(applied) as (keyof Filters)[]).filter((k) => applied[k] !== 'all').length

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmDel) setConfirmDel(null)
      else if (menu) setMenu(null)
      else if (filterOpen) setFilterOpen(false)
      else if (drawer) setDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDel, menu, filterOpen, drawer])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menu])

  useEffect(() => {
    if (drawer?.mode === 'reports') reportsRef.current?.scrollIntoView({ block: 'start' })
  }, [drawer])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const rangeMs: Record<string, number> = { today: Date.now() - dayStart.getTime(), '7d': 7 * 24 * H, '30d': 30 * 24 * H }
    return items.filter((i) => {
      if (q && !(i.body.toLowerCase().includes(q) || i.author.name.toLowerCase().includes(q) || i.author.handle.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))) return false
      if (applied.type !== 'all' && i.type !== applied.type) return false
      if (applied.status !== 'all' && i.status !== applied.status) return false
      if (applied.range !== 'all' && Date.now() - i.createdAt > rangeMs[applied.range]) return false
      if (applied.engagement !== 'all' && level(i) !== applied.engagement) return false
      if (applied.reportStatus === 'none' && i.reports.length > 0) return false
      if (applied.reportStatus === 'reported' && i.reports.length === 0) return false
      if (applied.reportStatus === 'open' && !(i.reports.length > 0 && !i.resolved)) return false
      return true
    })
  }, [items, search, applied])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const from = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1
  const to = Math.min(safePage * perPage, filtered.length)

  const stats = useMemo(() => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    return {
      total: items.length,
      today: items.filter((i) => i.createdAt >= dayStart.getTime()).length,
      active: items.filter((i) => i.status !== 'Hidden' && i.comments >= 20 && Date.now() - i.createdAt < 7 * 24 * H).length,
      pending: items.filter(needsAttention).length,
      flagged: items.filter((i) => i.status === 'Flagged').length,
    }
  }, [items])

  const selected = drawer ? items.find((i) => i.id === drawer.id) || null : null
  const toDelete = confirmDel ? items.find((i) => i.id === confirmDel) || null : null

  const record = (id: string, status: Status, action: string, note: string, resolved: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id
      ? { ...i, status, resolved: resolved || i.resolved, history: [{ action, by: staff.fullName || 'Staff', at: Date.now(), note }, ...i.history] }
      : i)))
  }
  const approve = (id: string) => { record(id, 'Published', 'Approved', 'Kept published after review', true); setToast('Content approved') }
  const hide = (id: string) => { record(id, 'Hidden', 'Hidden', 'Removed from public view', true); setToast('Content hidden') }
  const restore = (id: string) => { record(id, 'Published', 'Restored', 'Visible to the community again', false); setToast('Content restored') }
  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setConfirmDel(null)
    setDrawer(null)
    setToast('Content deleted')
  }

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const up = r.bottom + 250 > window.innerHeight
    setMenu({ id, x: Math.max(8, r.right - 208), y: up ? r.top - 4 : r.bottom + 4, up })
  }

  const applyFilters = () => { setApplied(draft); setPage(1); setFilterOpen(false) }
  const clearFilters = () => { setApplied(NO_FILTERS); setDraft(NO_FILTERS); setPage(1); setFilterOpen(false) }

  const menuItem = menu ? items.find((i) => i.id === menu.id) || null : null
  const field = (label: string, key: keyof Filters, options: [string, string][]) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: A.textMuted, marginBottom: 5 }}>{label}</span>
      <select className="cm-select" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )

  const cards: { label: string; value: number; icon: string; note: string; tone: 'up' | 'down' | 'warn' | 'flat' }[] = [
    { label: 'Total Posts', value: stats.total, icon: 'doc', note: '+6.2% this month', tone: 'up' },
    { label: 'Posts Today', value: stats.today, icon: 'clock', note: '+2 vs yesterday', tone: 'up' },
    { label: 'Active Discussions', value: stats.active, icon: 'message', note: '-4% this week', tone: 'down' },
    { label: 'Pending Moderation', value: stats.pending, icon: 'shield', note: stats.flagged > 0 ? `${stats.flagged} flagged, needs attention` : 'Nothing waiting', tone: stats.pending > 0 ? 'warn' : 'flat' },
  ]
  const toneColor = { up: A.green, down: A.textMuted, warn: A.amber, flat: A.textMuted }

  const openDrawer = (id: string, mode: 'view' | 'review' | 'reports') => { setMenu(null); setDrawer({ id, mode }) }

  const rowActions = (i: Item) => (
    <button className="cm-icon-btn" aria-label={`Actions for ${i.id}`} aria-haspopup="menu" onClick={(e) => openMenu(e, i.id)}>
      <Icon name="more" />
    </button>
  )

  const noActivity = items.length === 0

  return (
    <AdminLayout title="Community">
      <style>{CSS}</style>

      <div className="cm-head">
        <p className="cm-sub">Monitor and manage community activity across Farmxie.</p>
        <div className="cm-tools">
          <div className="cm-search">
            <span style={{ position: 'absolute', left: 11, top: 9, color: A.textSoft, display: 'flex' }}><Icon name="search" size={15} /></span>
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search post content, author or post ID" aria-label="Search community"
            />
            {search && (
              <button className="cm-icon-btn" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1) }} style={{ position: 'absolute', right: 3, top: 3, width: 26, height: 26 }}>
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
          <button className="cm-btn" onClick={() => { setDraft(applied); setFilterOpen((o) => !o) }} aria-expanded={filterOpen}>
            <Icon name="filter" size={14} /> Filter
            {activeCount > 0 && <span style={{ background: A.green, color: '#fff', borderRadius: 999, fontSize: 10.5, padding: '1px 7px' }}>{activeCount}</span>}
          </button>

          {filterOpen && (
            <>
              <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div role="dialog" aria-label="Filter community content" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(360px, calc(100vw - 48px))', background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(15,26,18,0.14)', padding: 16, zIndex: 21 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text, marginBottom: 12 }}>Filter content</p>
                {field('Content type', 'type', [['all', 'All types'], ...TYPES.map((t): [string, string] => [t, t])])}
                {field('Status', 'status', [['all', 'All statuses'], ...STATUSES.map((s): [string, string] => [s, s])])}
                {field('Date range', 'range', [['all', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']])}
                {field('Engagement', 'engagement', [['all', 'Any level'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['none', 'None']])}
                {field('Report status', 'reportStatus', [['all', 'Any'], ['none', 'No reports'], ['reported', 'Has reports'], ['open', 'Reports awaiting review']])}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button className="cm-btn" onClick={clearFilters}>Clear Filters</button>
                  <button className="cm-btn primary" onClick={applyFilters}>Apply Filters</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cm-stats">
        {cards.map((c) => (
          <div key={c.label} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: A.textMuted }}>{c.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: c.tone === 'warn' ? A.amberChip : A.greenTint, color: c.tone === 'warn' ? A.amber : A.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={15} />
              </span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: A.text, margin: '6px 0 4px', lineHeight: 1.1 }}>{c.value.toLocaleString()}</p>
            <p style={{ fontSize: 12, color: toneColor[c.tone], display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              {(c.tone === 'up' || c.tone === 'down') && <Icon name={c.tone} size={12} />}
              {c.note}
            </p>
          </div>
        ))}
      </div>

      <div className="cm-list">
        {noActivity ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: A.greenTint, color: A.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon name="leaf" size={26} />
            </span>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 6 }}>No community activity yet</p>
            <p style={{ fontSize: 13, color: A.textMuted, maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
              Community posts and discussions will appear here when users begin interacting on Farmxie.
            </p>
          </div>
        ) : (
          <>
            {(activeCount > 0 || search) && (
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${A.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: A.textMuted }}>
                <span>{filtered.length} {filtered.length === 1 ? 'result' : 'results'}{activeCount > 0 ? ` with ${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} applied` : ''}</span>
                <button className="cm-btn" style={{ padding: '4px 10px' }} onClick={() => { setSearch(''); clearFilters() }}>Clear all</button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: A.text, marginBottom: 6 }}>No content matches your search</p>
                <p style={{ fontSize: 13, color: A.textMuted }}>Try a different keyword, post ID or author, or clear the filters.</p>
              </div>
            ) : (
              <>
                <div className="cm-table-wrap">
                  <table className="cm-table">
                    <thead>
                      <tr>
                        <th style={{ width: '34%' }}>Content</th><th>Author</th><th>Type</th><th>Engagement</th>
                        <th>Reports</th><th>Status</th><th>Date</th><th style={{ width: 52 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => (
                        <tr key={i.id} className={`cm-row${needsAttention(i) ? ' attn' : ''}`} onClick={() => openDrawer(i.id, 'view')}>
                          <td>
                            <div className="cm-clamp" style={{ maxWidth: 380 }}>{i.body}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11.5, color: A.textSoft }}>
                              {i.id}{i.image && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="image" size={12} /> Media</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <Avatar name={i.author.name} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: A.text, whiteSpace: 'nowrap' }}>{i.author.name}</div>
                                <div style={{ fontSize: 11.5, color: A.textMuted }}>{i.author.handle}</div>
                              </div>
                            </div>
                          </td>
                          <td><TypeChip type={i.type} /></td>
                          <td><div style={{ display: 'flex', gap: 10 }}><Stat icon="heart" value={i.likes} /><Stat icon="message" value={i.comments} /><Stat icon="share" value={i.shares} /></div></td>
                          <td>
                            {i.reports.length === 0 ? <span style={{ color: A.textSoft }}>None</span> : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: i.resolved ? A.textMuted : A.amber }}>
                                <Icon name="flag" size={12} />{i.reports.length}
                              </span>
                            )}
                          </td>
                          <td><StatusBadge status={i.status} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ color: A.text }}>{fmtDay(i.createdAt)}</div>
                            <div style={{ fontSize: 11.5, color: A.textMuted }}>{relative(i.createdAt)}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{rowActions(i)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="cm-cards">
                  {rows.map((i) => (
                    <div key={i.id} className={`cm-card${needsAttention(i) ? ' attn' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <Avatar name={i.author.name} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: A.text }}>{i.author.name}</div>
                          <div style={{ fontSize: 11.5, color: A.textMuted }}>{i.author.handle} · {relative(i.createdAt)}</div>
                        </div>
                        <StatusBadge status={i.status} />
                      </div>
                      <div className="cm-clamp" style={{ fontSize: 13, marginBottom: 10 }}>{i.body}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                        <TypeChip type={i.type} />
                        <Stat icon="heart" value={i.likes} /><Stat icon="message" value={i.comments} /><Stat icon="share" value={i.shares} />
                        {i.reports.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: i.resolved ? A.textMuted : A.amber }}>
                            <Icon name="flag" size={12} />{i.reports.length} {i.reports.length === 1 ? 'report' : 'reports'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="cm-btn" onClick={() => openDrawer(i.id, 'view')}><Icon name="eye" size={14} /> View</button>
                        <button className={`cm-btn${needsAttention(i) ? ' primary' : ''}`} onClick={() => openDrawer(i.id, 'review')}><Icon name="shield" size={14} /> Review</button>
                        <span style={{ marginLeft: 'auto' }}>{rowActions(i)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cm-foot">
                  <span style={{ fontSize: 12.5, color: A.textMuted }}>Showing {from}-{to} of {filtered.length} results</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="cm-page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="chevL" size={13} /> Previous</button>
                    {pageList(safePage, totalPages).map((p, idx) => (p === '…'
                      ? <span key={`g${idx}`} style={{ padding: '0 4px', color: A.textSoft }}>…</span>
                      : <button key={p} className={`cm-page${p === safePage ? ' on' : ''}`} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined}>{p}</button>))}
                    <button className="cm-page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <Icon name="chevR" size={13} /></button>
                  </div>
                  <label style={{ fontSize: 12.5, color: A.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Rows per page
                    <select className="cm-select" style={{ width: 'auto' }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>
                      {ROWS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {menu && menuItem && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 64 }} />
          <div role="menu" style={{ position: 'fixed', left: menu.x, top: menu.y, transform: menu.up ? 'translateY(-100%)' : 'none', width: 208, background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(15,26,18,0.16)', padding: 5, zIndex: 65 }}>
            <button role="menuitem" className="cm-menu-item" onClick={() => openDrawer(menuItem.id, 'view')}><Icon name="eye" size={15} /> View</button>
            <button role="menuitem" className="cm-menu-item" onClick={() => openDrawer(menuItem.id, 'review')}><Icon name="shield" size={15} /> Review</button>
            <button role="menuitem" className="cm-menu-item" disabled={menuItem.reports.length === 0} onClick={() => openDrawer(menuItem.id, 'reports')}>
              <Icon name="flag" size={15} /> View Reports{menuItem.reports.length > 0 ? ` (${menuItem.reports.length})` : ''}
            </button>
            <div style={{ height: 1, background: A.borderSoft, margin: '5px 4px' }} />
            {menuItem.status === 'Hidden'
              ? <button role="menuitem" className="cm-menu-item" onClick={() => { setMenu(null); restore(menuItem.id) }}><Icon name="restore" size={15} /> Restore</button>
              : <button role="menuitem" className="cm-menu-item" onClick={() => { setMenu(null); hide(menuItem.id) }}><Icon name="eyeOff" size={15} /> Hide</button>}
            <button role="menuitem" className="cm-menu-item danger" onClick={() => { setMenu(null); setConfirmDel(menuItem.id) }}><Icon name="trash" size={15} /> Delete</button>
          </div>
        </>
      )}

      {selected && drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.38)', zIndex: 60 }} />
          <aside className="cm-drawer" role="dialog" aria-label="Content details">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: A.text }}>{drawer.mode === 'review' ? 'Review content' : 'Content details'}</p>
                <p style={{ fontSize: 12, color: A.textMuted, marginTop: 2 }}>{selected.id} · {selected.type}</p>
              </div>
              <StatusBadge status={selected.status} />
              <button className="cm-icon-btn" aria-label="Close" onClick={() => setDrawer(null)}><Icon name="close" size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {needsAttention(selected) && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: `1px solid #F3E2B8`, borderRadius: 8, padding: '10px 12px', marginBottom: 18, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ marginTop: 1 }}><Icon name="alert" size={15} /></span>
                  <span>
                    {selected.status === 'Flagged' ? 'This content was flagged' : 'This content is under review'}
                    {selected.reports.length > 0 ? ` after ${selected.reports.length} ${selected.reports.length === 1 ? 'report' : 'reports'}` : ''}. Choose to keep it published, hide it or delete it.
                  </span>
                </div>
              )}

              <p style={{ fontSize: 12, fontWeight: 700, color: A.textMuted, marginBottom: 8 }}>Author</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${A.border}`, borderRadius: 10, padding: 12, marginBottom: 20 }}>
                <Avatar name={selected.author.name} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: A.text }}>{selected.author.name}</p>
                  <p style={{ fontSize: 12, color: A.textMuted }}>{selected.author.handle} · {selected.author.role}</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.5, color: A.textMuted, lineHeight: 1.5 }}>
                  <div>Member since {selected.author.since}</div>
                  <div>{selected.author.posts} posts</div>
                </div>
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: A.textMuted, marginBottom: 8 }}>Content</p>
              <div style={{ border: `1px solid ${A.border}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <TypeChip type={selected.type} />
                  <span style={{ fontSize: 12, color: A.textMuted }}>{fmtDay(selected.createdAt)}, {fmtTime(selected.createdAt)}</span>
                </div>
                <p style={{ fontSize: 13.5, color: A.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.body}</p>
                {selected.image && (
                  <div style={{ marginTop: 12, height: 168, borderRadius: 8, background: A.bg, border: `1px dashed ${A.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: A.textSoft, fontSize: 12 }}>
                    <Icon name="image" size={26} />
                    Attached image
                  </div>
                )}
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: A.textMuted, marginBottom: 8 }}>Engagement</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1px solid ${A.border}`, borderRadius: 10, marginBottom: 20 }}>
                {([['Likes', selected.likes], ['Comments', selected.comments], ['Shares', selected.shares], ['Views', selected.views]] as [string, number][]).map(([l, v], idx) => (
                  <div key={l} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: idx ? `1px solid ${A.border}` : 'none' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: A.text }}>{compact(v)}</p>
                    <p style={{ fontSize: 11.5, color: A.textMuted }}>{l}</p>
                  </div>
                ))}
              </div>

              <div ref={reportsRef} style={{ scrollMarginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: A.textMuted, marginBottom: 8 }}>Reports ({selected.reports.length})</p>
                {selected.reports.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: A.textMuted, marginBottom: 20 }}>No one has reported this content.</p>
                ) : (
                  <div style={{ border: `1px solid ${drawer.mode === 'reports' ? A.amberLine : A.border}`, borderRadius: 10, marginBottom: 20 }}>
                    {selected.reports.map((r, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderTop: idx ? `1px solid ${A.borderSoft}` : 'none', fontSize: 12.5 }}>
                        <span style={{ color: A.text, fontWeight: 600 }}>{r.reason}</span>
                        <span style={{ color: A.textMuted, whiteSpace: 'nowrap' }}>{r.by} · {relative(r.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: A.textMuted, marginBottom: 10 }}>Moderation history</p>
              <div style={{ paddingLeft: 4 }}>
                {selected.history.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: idx === selected.history.length - 1 ? 0 : 16 }}>
                    {idx !== selected.history.length - 1 && <span style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 1, background: A.border }} />}
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: h.action === 'Reported' ? A.amberLine : A.green, marginTop: 4, flexShrink: 0, zIndex: 1 }} />
                    <div>
                      <p style={{ fontSize: 12.5, color: A.text }}><b>{h.action}</b> by {h.by}</p>
                      {h.note && <p style={{ fontSize: 12, color: A.textMuted, marginTop: 1 }}>{h.note}</p>}
                      <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 1 }}>{fmtDay(h.at)}, {fmtTime(h.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${A.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', background: A.surface }}>
              <button className="cm-btn primary" onClick={() => approve(selected.id)}>
                <Icon name="check" size={14} /> {selected.status === 'Published' ? 'Keep Published' : 'Approve'}
              </button>
              {selected.status === 'Hidden'
                ? <button className="cm-btn" onClick={() => restore(selected.id)}><Icon name="restore" size={14} /> Restore Content</button>
                : <button className="cm-btn" onClick={() => hide(selected.id)}><Icon name="eyeOff" size={14} /> Hide Content</button>}
              <button className="cm-btn danger" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(selected.id)}><Icon name="trash" size={14} /> Delete Content</button>
            </div>
          </aside>
        </>
      )}

      {toDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmDel(null)}>
          <div role="alertdialog" aria-label="Delete content" onClick={(e) => e.stopPropagation()} style={{ background: A.surface, borderRadius: 12, padding: 22, width: 400, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>Delete this content?</p>
            <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 6 }}>
              {toDelete.id} by {toDelete.author.name} will be permanently removed, along with its comments and reports. This cannot be undone.
            </p>
            <p className="cm-clamp" style={{ fontSize: 12.5, color: A.textMuted, background: A.bg, borderRadius: 8, padding: '8px 10px', margin: '10px 0 18px' }}>{toDelete.body}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="cm-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="cm-btn solid-danger" onClick={() => remove(toDelete.id)}>Delete content</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: A.greenDark, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '10px 16px', borderRadius: 8, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          <Icon name="check" size={14} /> {toast}
        </div>
      )}
    </AdminLayout>
  )
}
